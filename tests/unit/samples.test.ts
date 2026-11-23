import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "@/lib/csv";
import { parseImageReport } from "@/lib/image-report";
import { parseProductRows } from "@/lib/import-parse";
import { readXlsxRows } from "@/lib/xlsx-read";

const file = (name: string) => `public/samples/${name}`;
const xlsx = (name: string) => readXlsxRows(new Uint8Array(fs.readFileSync(file(name))));
const csv = (name: string) => parseCsv(fs.readFileSync(file(name), "utf8"));

describe("the sample files shipped with Bulk import", () => {
  it("the Excel products sample imports without a single problem", async () => {
    const { rows, errors } = parseProductRows(toCsv(await xlsx("zsarra-products-sample.xlsx")));
    expect(errors).toEqual([]);
    expect(rows.map((r) => r.sku)).toEqual(["ZM-201", "ZM-202", "ZM-203", "ZW-201", "ZW-202"]);
  });
  it("the CSV products sample imports without a single problem", () => {
    const { rows, errors } = parseProductRows(toCsv(csv("zsarra-products-sample.csv")));
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(5);
  });
  it("the Excel and CSV samples describe exactly the same products", async () => {
    const strip = (t: string[][]) => parseProductRows(toCsv(t)).rows;
    expect(strip(await xlsx("zsarra-products-sample.xlsx"))).toEqual(strip(csv("zsarra-products-sample.csv")));
  });
  it("the sample shows per-size stock and a sale price", async () => {
    const kurti = parseProductRows(toCsv(await xlsx("zsarra-products-sample.xlsx"))).rows.find((r) => r.sku === "ZW-201")!;
    expect(kurti.salePrice).toBe(1499);
    expect(Object.fromEntries(kurti.variants.map((v) => [v.size, v.stock]))).toEqual({ S: 6, M: 10, L: 10, XL: 4 });
  });
  it("both image report samples are valid and match each other", async () => {
    const a = parseImageReport(await xlsx("zsarra-image-report-sample.xlsx"));
    const b = parseImageReport(csv("zsarra-image-report-sample.csv"));
    expect(a.errors).toEqual([]);
    expect(a.entries).toHaveLength(5);
    expect(a.entries.map(({ file, sku, position }) => ({ file, sku, position }))).toEqual(b.entries.map(({ file, sku, position }) => ({ file, sku, position })));
  });
  it("every picture named in the image report is inside the sample ZIP", () => {
    const zip = fs.readFileSync(file("zsarra-sample-images.zip")).toString("latin1");
    for (const e of parseImageReport(csv("zsarra-image-report-sample.csv")).entries) expect(zip).toContain(`2-use-with-image-report/${e.file}`);
    for (const sku of ["ZM-201", "ZM-202", "ZM-203", "ZW-201", "ZW-202"]) expect(zip).toContain(`1-named-by-sku/${sku}.jpg`);
  });
  it("every sample SKU has a photo in the store's catalog folder", () => {
    for (const sku of ["ZM-201", "ZM-202", "ZM-203", "ZW-201", "ZW-202"]) expect(fs.existsSync(`public/catalog/${sku}.jpg`)).toBe(true);
  });
});

describe("readXlsxRows", () => {
  it("refuses files that aren't Excel workbooks", async () => {
    await expect(readXlsxRows(new TextEncoder().encode("sku,name\nA,B"))).rejects.toThrow(/Excel/);
    await expect(readXlsxRows(new Uint8Array(0))).rejects.toThrow();
  });
});

describe("parseImageReport", () => {
  const parse = (...lines: string[]) => parseImageReport(lines.map((l) => l.split(",")));
  it("accepts file names, links and optional positions", () => {
    const { entries, errors } = parse("image_file,sku,position,image_url", "a.jpg,S1,,", "b.jpg,S1,2,", ",S2,1,https://example.com/x.jpg");
    expect(errors).toEqual([]);
    expect(entries).toEqual([
      { line: 2, sku: "S1", position: 1, file: "a.jpg", url: undefined },
      { line: 3, sku: "S1", position: 2, file: "b.jpg", url: undefined },
      { line: 4, sku: "S2", position: 1, file: undefined, url: "https://example.com/x.jpg" },
    ]);
  });
  it("understands friendly column names", () => {
    const { entries, errors } = parse("File Name,Product SKU,Order", "a.jpg,S1,3");
    expect(errors).toEqual([]);
    expect(entries[0]).toMatchObject({ file: "a.jpg", sku: "S1", position: 3 });
  });
  it.each([
    ["no sku", "image_file,sku", "a.jpg,", /sku is empty/],
    ["nothing to attach", "image_file,sku,image_url", ",S1,", /image_file or an image_url/],
    ["both file and link", "image_file,sku,image_url", "a.jpg,S1,https://x.com/a.jpg", /not both/],
    ["insecure link", "image_file,sku,image_url", ",S1,http://x.com/a.jpg", /https/],
    ["bad position", "image_file,sku,position", "a.jpg,S1,0", /position/],
    ["fractional position", "image_file,sku,position", "a.jpg,S1,1.5", /position/],
  ])("reports %s", (_n, head, row, msg) => {
    const { entries, errors } = parse(head, row);
    expect(entries).toEqual([]);
    expect(errors[0].message).toMatch(msg);
    expect(errors[0].line).toBe(2);
  });
  it("catches two pictures for the same slot and the same file twice", () => {
    const { errors } = parse("image_file,sku,position", "a.jpg,S1,1", "b.jpg,S1,1", "A.JPG,S2,1");
    expect(errors.map((e) => e.message)).toEqual([expect.stringMatching(/already has a picture in position 1/), expect.stringMatching(/listed twice/)]);
  });
  it("rejects a report without the needed columns, or an empty one", () => {
    expect(parse("name,price", "x,1").errors[0].message).toMatch(/needs a sku column/);
    expect(parseImageReport([]).errors[0].message).toMatch(/empty/);
  });
});

describe("product headers from Excel", () => {
  it("accepts friendly header spellings", () => {
    const header = "SKU,Name,Description,Gender,Category,Price,Sale Price,Sizes,Colors,Stock";
    const row = "A-1,Shirt,A nice long description,Men,Shirts,1999,1499,S|M,Black,5";
    const { rows, errors } = parseProductRows(`${header}\n${row}`);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ sku: "A-1", price: 1999, salePrice: 1499 });
  });
});
