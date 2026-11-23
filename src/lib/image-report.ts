import { normaliseHeader } from "./csv";

export type ReportEntry = { line: number; sku: string; position: number; file?: string; url?: string };
export type ReportError = { line: number; message: string };

const ALIASES: Record<string, string> = {
  file: "image_file", filename: "image_file", file_name: "image_file", image: "image_file", image_name: "image_file", picture: "image_file",
  url: "image_url", link: "image_url", image_link: "image_url", product_sku: "sku", style_code: "sku",
  order: "position", image_no: "position", image_number: "position", pos: "position",
};
export const MAX_REPORT_ROWS = 5000;

/** An image report says which picture belongs to which product, so pictures can have ANY file name.
 *  Columns: image_file (or image_url), sku, position (1 = cover, optional). */
export function parseImageReport(rows: string[][]): { entries: ReportEntry[]; errors: ReportError[] } {
  const entries: ReportEntry[] = [], errors: ReportError[] = [];
  if (rows.length === 0) return { entries, errors: [{ line: 1, message: "The image report is empty" }] };

  const header = rows[0].map((h) => { const n = normaliseHeader(h); return ALIASES[n] ?? n; });
  const iFile = header.indexOf("image_file"), iUrl = header.indexOf("image_url"), iSku = header.indexOf("sku"), iPos = header.indexOf("position");
  if (iSku < 0 || (iFile < 0 && iUrl < 0)) return { entries, errors: [{ line: 1, message: "The report needs a sku column and an image_file (or image_url) column" }] };
  if (rows.length - 1 > MAX_REPORT_ROWS) return { entries, errors: [{ line: 1, message: `Too many rows (maximum ${MAX_REPORT_ROWS})` }] };

  const slots = new Set<string>(), files = new Set<string>();
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const get = (ix: number) => (ix >= 0 ? (r[ix] ?? "").trim() : "");
    const fail = (message: string) => { errors.push({ line, message }); };
    const sku = get(iSku), file = get(iFile), url = get(iUrl), posRaw = get(iPos);

    if (!sku) return fail("sku is empty");
    if (!file && !url) return fail("Enter an image_file or an image_url");
    if (file && url) return fail("Use either image_file or image_url, not both");
    if (url && !/^https:\/\//i.test(url)) return fail("image_url must start with https://");
    let position = 1;
    if (posRaw !== "") {
      const n = Number(posRaw);
      if (!Number.isInteger(n) || n < 1 || n > 30) return fail("position must be a whole number from 1 to 30");
      position = n;
    }
    if (slots.has(`${sku}#${position}`)) return fail(`${sku} already has a picture in position ${position}`);
    slots.add(`${sku}#${position}`);
    if (file) {
      if (files.has(file.toLowerCase())) return fail(`${file} is listed twice`);
      files.add(file.toLowerCase());
    }
    entries.push({ line, sku, position, file: file || undefined, url: url || undefined });
  });
  return { entries, errors };
}
