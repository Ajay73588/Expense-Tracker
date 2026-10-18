import type {
  AdapterContext, AdapterResult, Broker, CandidateRow, Cell, ImportAdapter, ImportAssetClass, RowIssue, Sheet,
} from "./base.adapter";
import { BROKER_LABEL } from "./base.adapter";
import { fatal, findHeader, sliceTable, warn, type HeaderMatch } from "./parse-utils";

export interface TableAdapterConfig {
  broker: Broker;
  assetClass: ImportAssetClass;
  /** canonical key → accepted normalized header aliases (see normHeader). */
  required: Record<string, string[]>;
  optional?: Record<string, string[]>;
  /** Human-readable names of required columns, for error messages. */
  expectedColumns: string[];
  /** Column whose text decides whether a row is a footer/total (default: first column). */
  labelColumnKey: string;
  mapRow(cells: Cell[], cols: HeaderMatch["cols"], row: number): CandidateRow;
  /** Optional cross-checks against totals printed in the file (warnings only). */
  reconcile?(sheet: Sheet, rows: CandidateRow[]): RowIssue[];
  /** Extra per-row warnings (e.g. derived-value mismatches). */
  rowWarnings?(candidate: CandidateRow, cells: Cell[], cols: HeaderMatch["cols"]): RowIssue[];
  emptyMessage: string;
}

/** Factory for "metadata block, then one header row, then holdings rows, then footer" exports. */
export function defineTableAdapter(cfg: TableAdapterConfig): ImportAdapter {
  const id = `${cfg.broker}:${cfg.assetClass}`;

  const locate = (sheets: Sheet[]): { sheet: Sheet; header: HeaderMatch } | null => {
    for (const sheet of sheets) {
      const header = findHeader(sheet, cfg.required, cfg.optional);
      if (header) return { sheet, header };
    }
    return null;
  };

  return {
    id,
    broker: cfg.broker,
    assetClass: cfg.assetClass,
    expectedColumns: cfg.expectedColumns,
    matches: (sheets) => locate(sheets) !== null,

    parse(sheets: Sheet[], _ctx: AdapterContext): AdapterResult {
      const found = locate(sheets);
      if (!found) {
        return {
          sheetName: sheets[0]?.name ?? "",
          rows: [],
          fatal: [
            fatal(
              `Could not find a ${BROKER_LABEL[cfg.broker]} holdings table. Required columns: ${cfg.expectedColumns.join(", ")}.`
            ),
          ],
          warnings: [],
        };
      }
      const { sheet, header } = found;
      const slice = sliceTable(sheet, header.rowIndex, header.cols[cfg.labelColumnKey] ?? 0);
      const warnings: RowIssue[] = [];
      const rows: CandidateRow[] = [];

      for (const [rowNo, cells] of slice.dataRows) {
        const cand = cfg.mapRow(cells, header.cols, rowNo);
        rows.push(cand);
        if (cfg.rowWarnings) warnings.push(...cfg.rowWarnings(cand, cells, header.cols));
      }
      for (const r of slice.stray) {
        warnings.push(warn("Unexpected content after the holdings table was ignored.", r));
      }
      if (rows.length === 0) warnings.push(warn(cfg.emptyMessage));
      else if (cfg.reconcile) warnings.push(...cfg.reconcile(sheet, rows));

      return { sheetName: sheet.name, rows, fatal: [], warnings };
    },
  };
}
