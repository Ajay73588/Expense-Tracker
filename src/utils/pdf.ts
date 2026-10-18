/**
 * Lightweight, in-memory PDF inspection and stream extraction utilities.
 * Completely zero-disk, zero-dependency, and ephemeral.
 */

export const PDF_MAX_BYTES = 10 * 1024 * 1024; // 10 MB safe limit

/**
 * Checks if the bytes represent a valid PDF (%PDF- header).
 */
export function isPdf(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false;
  return (
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d    // -
  );
}

/**
 * Checks if the PDF contains an encryption dictionary (/Encrypt).
 * Checks both the header objects and trailer dictionary.
 */
export function isPdfEncrypted(bytes: Uint8Array): boolean {
  const headProbe = new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(bytes.length, 32768)));
  const trailerProbe = new TextDecoder("latin1").decode(
    bytes.subarray(Math.max(0, bytes.length - 16384))
  );
  return headProbe.includes("/Encrypt") || trailerProbe.includes("/Encrypt");
}

/**
 * Extracts visible text streams from uncompressed or partially compressed PDF objects.
 */
export function extractPdfTextStreams(bytes: Uint8Array): string {
  const text = new TextDecoder("latin1").decode(bytes);
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  const chunks: string[] = [];

  while ((match = streamRegex.exec(text)) !== null) {
    const rawContent = match[1];
    // Check for BT ... ET blocks (Text objects)
    const btRegex = /BT([\s\S]*?)ET/g;
    let btMatch: RegExpExecArray | null;
    while ((btMatch = btRegex.exec(rawContent)) !== null) {
      // Extract string literals in parentheses (text)
      const parenRegex = /\(([^)]+)\)/g;
      let pMatch: RegExpExecArray | null;
      while ((pMatch = parenRegex.exec(btMatch[1])) !== null) {
        chunks.push(pMatch[1]);
      }
    }
  }

  // Fallback to raw text strings in parentheses if no stream blocks found
  if (chunks.length === 0) {
    const parenRegex = /\(([\s\S]*?)\)/g;
    let pMatch: RegExpExecArray | null;
    while ((pMatch = parenRegex.exec(text)) !== null) {
      if (pMatch[1].trim().length > 0) {
        chunks.push(pMatch[1]);
      }
    }
  }

  return chunks.join("\n").replace(/[ \t]+/g, " ").trim();
}
