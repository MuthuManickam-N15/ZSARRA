import { normaliseHeader, parseCsv } from "./csv";
import { firstError, productSchema } from "./validation";

export type ImportVariant = { size: string; color: string; colorHex: string; stock: number };
export type ImportRow = {
  line: number; sku: string; name: string; description: string; gender: "MEN" | "WOMEN" | "UNISEX"; category: string;
  price: number; salePrice?: number; published: boolean; featured: boolean; variants: ImportVariant[]; imageUrls: string[];
};
export type RowError = { line: number; sku: string; message: string };

export const MAX_ROWS = 2000;
export const HEADERS = ["sku", "name", "description", "gender", "category", "price", "sale_price", "sizes", "colors", "stock", "published", "featured", "image_urls"];
const HEADER_ALIASES: Record<string, string> = { image_url: "image_urls", images: "image_urls", saleprice: "sale_price", mrp: "price" };
const REQUIRED = ["sku", "name", "description", "gender", "category", "price", "sizes", "stock"];

const COLOR_HEX: Record<string, string> = {
  black: "#000000", white: "#FFFFFF", ivory: "#E9E7DB", cream: "#F5F0E1", beige: "#D9C7A3", brown: "#6B4A2B", bronze: "#967751", tan: "#C19A6B",
  khaki: "#BDB76B", grey: "#808080", gray: "#808080", charcoal: "#36454F", navy: "#1F2A44", blue: "#2F5DA8", red: "#C0262D", maroon: "#6D1F2B",
  pink: "#E58FA8", orange: "#E07B2D", yellow: "#E8C547", green: "#3C7A4B", olive: "#6B6B2F", purple: "#6A4C93",
};

const splitList = (v: string) => v.split(/[|;]/).map((s) => s.trim()).filter(Boolean);
const flag = (v: string, dflt: boolean) => (v.trim() === "" ? dflt : /^(1|y|yes|true)$/i.test(v.trim()));

export function normaliseGender(v: string): "MEN" | "WOMEN" | "UNISEX" | null {
  const s = v.trim().toLowerCase();
  if (["men", "man", "mens", "male", "m"].includes(s)) return "MEN";
  if (["women", "woman", "womens", "female", "ladies", "w"].includes(s)) return "WOMEN";
  return s === "unisex" ? "UNISEX" : null;
}

/** "SKU.jpg" is the cover image, "SKU_2.jpg" the second one, and so on. */
export function parseImageName(filename: string): { sku: string; index: number } | null {
  const m = /^(.+?)(?:_(\d{1,2}))?\.(?:jpe?g|png|webp)$/i.exec(filename.trim());
  if (!m) return null;
  return { sku: m[1], index: Math.max(1, Number(m[2] ?? 1)) };
}

/** Stock can be one number for every variant ("10"), per size ("S:5|M:8") or per size and color ("S/Black:3|M/White:2"). */
function stockLookup(spec: string): { stockFor: (size: string, color: string) => number } | { bad: string } {
  const entries = splitList(spec);
  if (entries.length === 1 && !entries[0].includes(":")) {
    const n = Number(entries[0]);
    return Number.isFinite(n) ? { stockFor: () => n } : { bad: `Stock "${entries[0]}" isn't a number` };
  }
  const map = new Map<string, number>();
  for (const e of entries) {
    const i = e.lastIndexOf(":"), n = Number(e.slice(i + 1));
    if (i < 1 || !Number.isFinite(n)) return { bad: `Bad stock entry "${e}". Use 10, S:5|M:8 or S/Black:3` };
    map.set(e.slice(0, i).trim().toLowerCase(), n);
  }
  return { stockFor: (size, color) => map.get(`${size}/${color}`.toLowerCase()) ?? map.get(size.toLowerCase()) ?? 0 };
}

/** Turns CSV text into validated rows plus a list of per-row problems. `lineOffset` is how many data rows came before this chunk. */
export function parseProductRows(text: string, lineOffset = 0): { rows: ImportRow[]; errors: RowError[] } {
  const rows: ImportRow[] = [], errors: RowError[] = [];
  const table = parseCsv(text);
  if (table.length === 0) return { rows, errors: [{ line: 1, sku: "", message: "The file is empty" }] };

  const header = table[0].map((h) => { const n = normaliseHeader(h); return HEADER_ALIASES[n] ?? n; });
  const missing = REQUIRED.filter((h) => !header.includes(h));
  if (missing.length) return { rows, errors: [{ line: 1, sku: "", message: `Missing column(s): ${missing.join(", ")}` }] };
  if (table.length - 1 > MAX_ROWS) return { rows, errors: [{ line: 1, sku: "", message: `Too many rows (maximum ${MAX_ROWS} per file)` }] };

  const seen = new Set<string>();
  table.slice(1).forEach((cells, i) => {
    const line = i + 2 + lineOffset;
    const get = (name: string) => (cells[header.indexOf(name)] ?? "").trim();
    const sku = get("sku");
    const fail = (message: string) => { errors.push({ line, sku, message }); };

    if (!sku) return fail("SKU is empty");
    if (seen.has(sku)) return fail("This SKU appears twice in the file");
    seen.add(sku);

    const gender = normaliseGender(get("gender"));
    if (!gender) return fail(`Gender must be men, women or unisex (got "${get("gender")}")`);
    if (!get("category")) return fail("Category is empty");

    const sizes = splitList(get("sizes"));
    if (sizes.length === 0) return fail("Add at least one size, like S|M|L");
    const colorList = splitList(get("colors"));
    const colors = (colorList.length ? colorList : ["Black"]).map((c) => {
      const [name, hex] = c.split(":");
      const n = name.trim();
      return { color: n, colorHex: hex && /^#[0-9a-fA-F]{6}$/.test(hex.trim()) ? hex.trim() : COLOR_HEX[n.toLowerCase()] ?? "#888888" };
    });
    const stock = stockLookup(get("stock"));
    if ("bad" in stock) return fail(stock.bad);
    const variants = colors.flatMap((c) => sizes.map((size) => ({ size, color: c.color, colorHex: c.colorHex, stock: stock.stockFor(size, c.color) })));

    const imageUrls = splitList(get("image_urls"));
    const badUrl = imageUrls.find((u) => !/^https:\/\//i.test(u) && !u.startsWith("/uploads/"));
    if (badUrl) return fail(`Image link "${badUrl}" must start with https://`);

    const parsed = productSchema.safeParse({
      name: get("name"), sku, description: get("description"), gender, categoryId: "import",
      price: get("price"), salePrice: get("sale_price"), published: flag(get("published"), true), featured: flag(get("featured"), false), variants,
    });
    if (!parsed.success) return fail(firstError(parsed.error));
    const d = parsed.data;
    rows.push({ line, sku, name: d.name, description: d.description, gender, category: get("category"), price: d.price, salePrice: d.salePrice, published: d.published, featured: d.featured, variants: d.variants, imageUrls });
  });
  return { rows, errors };
}
