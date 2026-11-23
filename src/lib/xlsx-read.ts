/** Reads the FIRST sheet of an .xlsx file into rows of text. An .xlsx is a zip of XML files; this reads just what a product list needs
 *  (text, numbers, yes/no cells) with no third-party code. Needs DecompressionStream (all current browsers and Node 18+). */
const td = new TextDecoder();
type Entry = { method: number; compSize: number; offset: number };

const u16 = (v: DataView, o: number) => v.getUint16(o, true);
const u32 = (v: DataView, o: number) => v.getUint32(o, true);

function listEntries(buf: Uint8Array): Map<string, Entry> {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) if (u32(v, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("This doesn't look like an Excel (.xlsx) file.");
  const count = u16(v, eocd + 10);
  let p = u32(v, eocd + 16);
  const map = new Map<string, Entry>();
  for (let n = 0; n < count; n++) {
    if (u32(v, p) !== 0x02014b50) throw new Error("The Excel file is damaged.");
    const nameLen = u16(v, p + 28), extraLen = u16(v, p + 30), commentLen = u16(v, p + 32);
    map.set(td.decode(buf.subarray(p + 46, p + 46 + nameLen)), { method: u16(v, p + 10), compSize: u32(v, p + 20), offset: u32(v, p + 42) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return map;
}

async function readEntry(buf: Uint8Array, e: Entry): Promise<string> {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const start = e.offset + 30 + u16(v, e.offset + 26) + u16(v, e.offset + 28);
  const data = buf.subarray(start, start + e.compSize);
  if (e.method === 0) return td.decode(data);
  if (e.method !== 8) throw new Error("This Excel file uses an unsupported compression.");
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return td.decode(await new Response(stream).arrayBuffer());
}

const unescapeXml = (s: string) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

const textOf = (xml: string) =>
  Array.from(xml.replace(/<rPh[\s\S]*?<\/rPh>/g, "").matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g), (m) => unescapeXml(m[1])).join("");

const attr = (tag: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];
const colIndex = (ref: string) => [...ref.replace(/\d+/g, "")].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

export async function readXlsxRows(data: ArrayBuffer | Uint8Array): Promise<string[][]> {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const entries = listEntries(buf);
  const read = async (name: string) => { const e = entries.get(name); return e ? readEntry(buf, e) : null; };

  const workbook = await read("xl/workbook.xml");
  if (!workbook) throw new Error("This doesn't look like an Excel (.xlsx) file.");
  const firstSheet = /<sheet\b[^>]*>/.exec(workbook)?.[0] ?? "";
  const rid = /r:id="([^"]+)"/.exec(firstSheet)?.[1];
  let sheetPath = "xl/worksheets/sheet1.xml";
  const rels = await read("xl/_rels/workbook.xml.rels");
  if (rid && rels) {
    for (const rel of rels.match(/<Relationship\b[^>]*>/g) ?? []) {
      if (attr(rel, "Id") === rid) { const t = attr(rel, "Target") ?? ""; sheetPath = t.startsWith("/") ? t.slice(1) : `xl/${t}`; }
    }
  }
  const sheet = await read(sheetPath);
  if (!sheet) throw new Error("Couldn't find the first sheet in this Excel file.");

  const sharedXml = await read("xl/sharedStrings.xml");
  const shared = sharedXml ? Array.from(sharedXml.matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g), (m) => (m[1] ? textOf(m[1]) : "")) : [];

  const cells = new Map<string, string>();
  let maxRow = -1, maxCol = -1;
  for (const m of sheet.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const ref = attr(m[1], "r");
    if (!ref || m[2] === undefined) continue;
    const type = attr(m[1], "t");
    const v = /<v>([\s\S]*?)<\/v>/.exec(m[2])?.[1];
    let value = "";
    if (type === "s") value = shared[Number(v)] ?? "";
    else if (type === "inlineStr") value = textOf(m[2]);
    else if (type === "str") value = unescapeXml(v ?? "");
    else if (type === "b") value = v === "1" ? "TRUE" : "FALSE";
    else if (type === "e") value = "";
    else if (v !== undefined) { const n = Number(v); value = Number.isFinite(n) ? String(n) : v; }
    if (value === "") continue;
    const row = Number(ref.replace(/\D/g, "")) - 1, col = colIndex(ref);
    cells.set(`${row}:${col}`, value);
    if (row > maxRow) maxRow = row;
    if (col > maxCol) maxCol = col;
  }
  const rows: string[][] = [];
  for (let r = 0; r <= maxRow; r++) rows.push(Array.from({ length: maxCol + 1 }, (_, c) => cells.get(`${r}:${c}`) ?? ""));
  return rows;
}
