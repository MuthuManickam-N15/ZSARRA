/** Small RFC 4180 CSV reader/writer: handles quotes, commas and line breaks inside quotes, CRLF and a leading BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  const endRow = () => { row.push(cell); cell = ""; if (row.length > 1 || row[0].trim() !== "") rows.push(row); row = []; };
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && src[i + 1] === "\n") i++; endRow(); }
    else cell += c;
  }
  if (cell !== "" || row.length > 0) endRow();
  return rows;
}

export function toCsv(rows: (string | number | boolean | null | undefined)[][]): string {
  const esc = (v: string | number | boolean | null | undefined) => { const s = v == null ? "" : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return rows.map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
}

/** "Sale Price", "sale-price" and "sale_price" all mean the same column. */
export const normaliseHeader = (h: string) => h.trim().toLowerCase().replace(/[\s-]+/g, "_");
