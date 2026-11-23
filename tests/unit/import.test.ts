import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "@/lib/csv";
import { HEADERS, parseImageName, parseProductRows } from "@/lib/import-parse";
import { img, sortSizes } from "@/lib/img";

const header = HEADERS.join(",");
const row = (o: Record<string, string> = {}) => {
  const d: Record<string, string> = { sku: "A-1", name: "Shirt", description: "A nice long description", gender: "men", category: "Shirts", price: "1999", sale_price: "", sizes: "S|M", colors: "Black|White", stock: "10", published: "", featured: "", image_urls: "", ...o };
  return HEADERS.map((h) => d[h]).join(",");
};
const parse = (...rows: string[]) => parseProductRows([header, ...rows].join("\n"));

describe("CSV reader and writer", () => {
  it("reads quotes, commas and line breaks inside quotes", () => {
    expect(parseCsv('a,"b,c","d ""e"" f"\n"x\ny",2,3')).toEqual([["a", "b,c", 'd "e" f'], ["x\ny", "2", "3"]]);
  });
  it("handles Windows line endings, a BOM and blank lines", () => {
    expect(parseCsv("\uFEFFa,b\r\n\r\n1,2\r\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("round-trips awkward values", () => {
    const rows = [["name", "note"], ['He said "hi"', "a,b\nc"], ["", "x"]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe("parseProductRows", () => {
  it("creates one variant per size and color, with sensible defaults", () => {
    const { rows, errors } = parse(row());
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ sku: "A-1", gender: "MEN", category: "Shirts", price: 1999, published: true, featured: false });
    expect(rows[0].variants).toHaveLength(4);
    expect(rows[0].variants.every((v) => v.stock === 10)).toBe(true);
    expect(rows[0].variants.find((v) => v.color === "White")?.colorHex).toBe("#FFFFFF");
  });
  it("reads stock per size", () => {
    const v = parse(row({ stock: "S:5|M:8" })).rows[0].variants;
    expect(v.filter((x) => x.size === "S").every((x) => x.stock === 5)).toBe(true);
    expect(v.filter((x) => x.size === "M").every((x) => x.stock === 8)).toBe(true);
  });
  it("reads stock per size and color", () => {
    const v = parse(row({ stock: "S/Black:1|S/White:2|M/Black:3|M/White:4" })).rows[0].variants;
    expect(v.map((x) => x.stock).sort()).toEqual([1, 2, 3, 4]);
    expect(v.find((x) => x.size === "S" && x.color === "White")?.stock).toBe(2);
  });
  it("accepts explicit color swatches and normalises gender words", () => {
    const r = parse(row({ colors: "Ivory:#E9E7DB|Teal:#008080", gender: "Ladies", sale_price: "1499", featured: "yes" })).rows[0];
    expect(r.variants.map((x) => x.colorHex)).toContain("#008080");
    expect(r).toMatchObject({ gender: "WOMEN", salePrice: 1499, featured: true });
  });
  it("reports problems per row and keeps the good rows", () => {
    const { rows, errors } = parse(
      row({ sku: "OK-1" }),
      row({ sku: "B-1", sale_price: "2500" }),
      row({ sku: "B-2", gender: "kids" }),
      row({ sku: "B-3", sizes: "" }),
      row({ sku: "B-4", stock: "lots" }),
      row({ sku: "B-5", image_urls: "ftp://x/y.jpg" }),
      row({ sku: "OK-1" }),
    );
    expect(rows.map((r) => r.sku)).toEqual(["OK-1"]);
    expect(errors.map((e) => e.sku)).toEqual(["B-1", "B-2", "B-3", "B-4", "B-5", "OK-1"]);
    expect(errors[0].message).toMatch(/Sale price/);
    expect(errors[5].message).toMatch(/twice/);
  });
  it("numbers lines like a spreadsheet (header is line 1) and honours the chunk offset", () => {
    const { errors } = parse(row({ sku: "X", price: "0" }));
    expect(errors[0].line).toBe(2);
    expect(parseProductRows([header, row({ sku: "X", price: "0" })].join("\n"), 300).errors[0].line).toBe(302);
  });
  it("refuses a file with missing columns or no content", () => {
    expect(parseProductRows("sku,name\nA,B").errors[0].message).toMatch(/Missing column/);
    expect(parseProductRows("").errors[0].message).toMatch(/empty/);
  });
  it("keeps picture links, including local ones", () => {
    expect(parse(row({ image_urls: "https://res.cloudinary.com/x/a.jpg|/uploads/b.png" })).rows[0].imageUrls).toHaveLength(2);
  });
});

describe("parseImageName", () => {
  it.each([
    ["ZM-001.jpg", "ZM-001", 1], ["ZM-001_2.JPG", "ZM-001", 2], ["a b.png", "a b", 1], ["X_10.webp", "X", 10], ["ZM_001.jpeg", "ZM_001", 1],
  ])("reads %s", (name, sku, index) => expect(parseImageName(name)).toEqual({ sku, index }));
  it.each(["notes.txt", "photo.gif", ".jpg", "noext"])("rejects %s", (name) => expect(parseImageName(name)).toBeNull());
});

describe("image helpers", () => {
  it("asks Cloudinary for a smaller web copy, once", () => {
    const u = "https://res.cloudinary.com/demo/image/upload/v1/zsarra/a.jpg";
    expect(img(u, 600)).toBe("https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_600,c_limit/v1/zara/a.jpg");
    expect(img(img(u, 600), 900)).toBe(img(u, 600));
  });
  it("leaves local and other images alone", () => {
    expect(img("/uploads/a.png")).toBe("/uploads/a.png");
    expect(img("https://example.com/a.jpg")).toBe("https://example.com/a.jpg");
  });
  it("orders sizes sensibly", () => expect(sortSizes(["XL", "S", "M", "XS", "L"])).toEqual(["XS", "S", "M", "L", "XL"]));
});
