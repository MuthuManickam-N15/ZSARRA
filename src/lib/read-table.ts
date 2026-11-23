import { parseCsv } from "./csv";
import { readXlsxRows } from "./xlsx-read";

/** Reads an uploaded Excel (.xlsx) or CSV file into rows of text, dropping completely empty rows. */
export async function readTable(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  let rows: string[][];
  if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) rows = await readXlsxRows(await file.arrayBuffer());
  else if (name.endsWith(".csv") || name.endsWith(".txt")) rows = parseCsv(await file.text());
  else if (name.endsWith(".xls")) throw new Error("Old .xls files aren't supported. In Excel choose File > Save As > Excel Workbook (.xlsx), or save as CSV.");
  else throw new Error("Choose an Excel (.xlsx) or CSV file.");
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}
