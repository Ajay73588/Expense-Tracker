import Papa from "papaparse";
import * as XLSX from "@e965/xlsx";
import type { Cell, Sheet } from "./base.adapter";
import { ValidationError } from "../lib/errors";

/**
 * Untrusted-file → Sheet[] reader. Nothing here is executed, evaluated or written to disk.
 * Defences: extension allow-list, byte-signature check (extension must match content), size cap,
 * row/column caps, no formula evaluation, no macros/external links, parse errors → ValidationError.
 */
export const IMPORT_LIMITS = {
  maxBytes: 5 * 1024 * 1024, // 5 MB
  maxRows: 5000, // per sheet
  maxCols: 60,
  maxSheets: 10,
} as const;

export type FileKind = "csv" | "xls" | "xlsx";

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // .xlsx is a ZIP container
const CFB_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // legacy .xls (OLE2)

const startsWith = (buf: Uint8Array, magic: number[]) => magic.every((b, i) => buf[i] === b);

export function detectKind(fileName: string, buf: Uint8Array): FileKind {
  const ext = /\.([a-z0-9]+)$/i.exec(fileName.trim())?.[1]?.toLowerCase();
  if (!ext || !["csv", "xls", "xlsx"].includes(ext)) {
    throw new ValidationError("Unsupported file type. Upload a .csv, .xls or .xlsx file.");
  }
  if (buf.byteLength === 0) throw new ValidationError("The uploaded file is empty.");
  if (buf.byteLength > IMPORT_LIMITS.maxBytes) {
    throw new ValidationError(
      `File is too large (max ${IMPORT_LIMITS.maxBytes / 1024 / 1024} MB).`
    );
  }
  if (ext === "xlsx" && !startsWith(buf, ZIP_MAGIC)) {
    throw new ValidationError("This file is named .xlsx but is not a valid Excel (.xlsx) workbook.");
  }
  if (ext === "xls" && !startsWith(buf, CFB_MAGIC)) {
    throw new ValidationError("This file is named .xls but is not a valid legacy Excel (.xls) workbook.");
  }
  if (ext === "csv") {
    // Binary content (spreadsheets/executables renamed .csv) contains NUL bytes; text never does.
    const probe = buf.subarray(0, Math.min(buf.byteLength, 8192));
    if (probe.includes(0) || startsWith(buf, ZIP_MAGIC) || startsWith(buf, CFB_MAGIC)) {
      throw new ValidationError("This file is named .csv but does not contain plain text CSV data.");
    }
  }
  return ext as FileKind;
}

function capSheet(name: string, rows: Cell[][]): Sheet {
  if (rows.length > IMPORT_LIMITS.maxRows) {
    throw new ValidationError(
      `Sheet "${name}" has more than ${IMPORT_LIMITS.maxRows} rows. Split the file or remove unrelated data.`
    );
  }
  return { name, rows: rows.map((r) => r.slice(0, IMPORT_LIMITS.maxCols)) };
}

function readCsv(buf: Uint8Array): Sheet[] {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(buf).replace(/^\uFEFF/, "");
  const parsed = Papa.parse<string[]>(text, { header: false, skipEmptyLines: false });
  if (parsed.errors.some((e) => e.type === "Quotes")) {
    throw new ValidationError("The CSV file is malformed (unbalanced quotes).");
  }
  const rows = parsed.data.map((r) => r.map((c) => (c === "" ? null : c)));
  return [capSheet("CSV", rows)];
}

function readWorkbook(buf: Uint8Array): Sheet[] {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, {
      type: "array",
      cellFormula: false, // never keep formulas
      cellHTML: false,
      bookVBA: false, // never load macros
      sheetRows: IMPORT_LIMITS.maxRows + 1,
      dense: false,
    });
  } catch {
    throw new ValidationError("The spreadsheet could not be read. It may be corrupted or password-protected.");
  }
  if (!wb.SheetNames.length) throw new ValidationError("The workbook contains no sheets.");
  if (wb.SheetNames.length > IMPORT_LIMITS.maxSheets) {
    throw new ValidationError(`The workbook has too many sheets (max ${IMPORT_LIMITS.maxSheets}).`);
  }
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    // header:1 → array of arrays; blankrows:true keeps row numbers aligned with the spreadsheet.
    const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: true,
    });
    return capSheet(name, rows);
  });
}

export function readSheets(fileName: string, buf: Uint8Array): { kind: FileKind; sheets: Sheet[] } {
  const kind = detectKind(fileName, buf);
  const sheets = kind === "csv" ? readCsv(buf) : readWorkbook(buf);
  return { kind, sheets };
}
