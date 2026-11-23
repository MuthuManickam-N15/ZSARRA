import { expect, test } from "@playwright/test";
import { ADMIN_STATE, db, PNG } from "./helpers";

test.use({ storageState: ADMIN_STATE });

const HEADER = "sku,name,description,gender,category,price,sale_price,sizes,colors,stock,published,featured,image_urls";

test("bulk import creates products from a CSV, attaches images by SKU, updates on re-import, and exports", async ({ page }) => {
  test.setTimeout(120_000);
  const stamp = Date.now(), a = `E2EIMP-${stamp}-A`, b = `E2EIMP-${stamp}-B`;
  const csv = [
    HEADER,
    `${a},Import Tee A,A soft cotton tee for the tests,men,Shirts,999,799,S|M,Black,5,yes,no,`,
    `${b},Import Tee B,Another test tee for the tests,women,Tops,1299,,S,Black|White,3,yes,no,`,
    `E2EIMP-${stamp}-BAD,Broken row,A row with a bad sale price,men,Shirts,500,900,S,Black,1,yes,no,`,
  ].join("\n");
  try {
    await page.goto("/admin/import");
    await page.getByLabel("Product file (Excel or CSV)").setInputFiles({ name: "products.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await page.getByRole("button", { name: "Import products" }).click();
    await expect(page.getByText("2 created, 0 updated")).toBeVisible();
    await expect(page.getByText(/Sale price must be lower than the price/)).toBeVisible(); // the bad row is reported, the good rows still went in

    const pa = await db.product.findUniqueOrThrow({ where: { sku: a }, include: { variants: true } });
    expect(pa.variants).toHaveLength(2);
    expect(pa.price).toBe(99900);
    expect(pa.salePrice).toBe(79900);
    expect((await db.product.findUniqueOrThrow({ where: { sku: b }, include: { variants: true } })).variants).toHaveLength(2);

    await page.getByLabel("Product image files").setInputFiles([
      { name: `${a}.png`, mimeType: "image/png", buffer: PNG },
      { name: `${a}_2.png`, mimeType: "image/png", buffer: PNG },
      { name: `${b}.png`, mimeType: "image/png", buffer: PNG },
      { name: "unknown-sku.png", mimeType: "image/png", buffer: PNG },
    ]);
    await page.getByRole("button", { name: "Upload images" }).click();
    await expect(page.getByText("3 images saved")).toBeVisible();
    await expect(page.getByText(/No product with SKU unknown-sku/)).toBeVisible();
    expect(await db.productImage.count({ where: { product: { sku: a } } })).toBe(2);

    // Uploading the same picture again replaces it instead of duplicating it.
    await page.getByLabel("Product image files").setInputFiles([{ name: `${a}.png`, mimeType: "image/png", buffer: PNG }]);
    await page.getByRole("button", { name: "Upload images" }).click();
    await expect(page.getByText("1 image saved")).toBeVisible();
    expect(await db.productImage.count({ where: { product: { sku: a } } })).toBe(2);

    // The product shows up on the storefront.
    await page.goto(`/search?q=${a}`);
    await expect(page.getByText("Import Tee A")).toBeVisible();

    // Importing the same file again updates instead of duplicating.
    await page.goto("/admin/import");
    await page.getByLabel("Product file (Excel or CSV)").setInputFiles({ name: "products.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await page.getByRole("button", { name: "Import products" }).click();
    await expect(page.getByText("0 created, 2 updated")).toBeVisible();
    expect(await db.product.count({ where: { sku: { startsWith: `E2EIMP-${stamp}` } } })).toBe(2);

    // The export is a CSV that includes the new products (and is admin-only).
    const res = await page.request.get("/admin/export/products");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    const body = await res.text();
    expect(body).toContain(a);
    expect(body).toContain(b);
  } finally {
    await db.product.deleteMany({ where: { sku: { startsWith: `E2EIMP-${stamp}` } } });
  }
});

test("the export is not available to visitors", async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: "http://localhost:3100", storageState: { cookies: [], origins: [] } });
  const res = await ctx.request.get("/admin/export/products", { maxRedirects: 0 });
  expect([307, 308, 404]).toContain(res.status()); // sent to the admin login (or hidden), never served
  await ctx.close();
});

test("the Excel sample imports, and the sample files can be downloaded", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/admin/import");
  await expect(page.getByRole("heading", { name: "Sample files" })).toBeVisible();
  for (const f of ["zsarra-products-sample.xlsx", "zsarra-products-sample.csv", "zsarra-image-report-sample.xlsx", "zsarra-image-report-sample.csv", "zsarra-sample-images.zip"]) {
    const res = await page.request.get(`/samples/${f}`);
    expect(res.status(), f).toBe(200);
  }
  await page.getByLabel("Product file (Excel or CSV)").setInputFiles("public/samples/zsarra-products-sample.xlsx");
  await page.getByRole("button", { name: "Import products" }).click();
  await expect(page.getByText(/5 of 5 rows processed/)).toBeVisible();
  await expect(page.getByText(/\b0 with problems|, 0 with problems/)).toBeVisible();
  const kurti = await db.product.findUniqueOrThrow({ where: { sku: "ZW-201" }, include: { variants: true } });
  expect(kurti.salePrice).toBe(149900);
  expect(Object.fromEntries(kurti.variants.map((v) => [v.size, v.stock]))).toEqual({ S: 6, M: 10, L: 10, XL: 4 });
  expect((await db.product.findUniqueOrThrow({ where: { sku: "ZM-201" } })).price).toBe(319900);
});

test("an image report matches pictures with any file name, and accepts links", async ({ page }) => {
  test.setTimeout(120_000);
  const stamp = Date.now(), sku = `E2EIMP-${stamp}-R`;
  const csv = [HEADER, `${sku},Report Tee,A test tee for the image report,men,Shirts,999,,S,Black,5,yes,no,`].join("\n");
  const report = ["image_file,sku,position,image_url", `front.png,${sku},1,`, `BACK.png,${sku},2,`, `,${sku},3,https://example.com/e2e-photo.jpg`, `missing.png,${sku},4,`].join("\n");
  try {
    await page.goto("/admin/import");
    await page.getByLabel("Product file (Excel or CSV)").setInputFiles({ name: "p.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await page.getByRole("button", { name: "Import products" }).click();
    await expect(page.getByText("1 created, 0 updated")).toBeVisible();

    await page.getByLabel("Product image files").setInputFiles([
      { name: "front.png", mimeType: "image/png", buffer: PNG },
      { name: "back.png", mimeType: "image/png", buffer: PNG },
      { name: "unlisted.png", mimeType: "image/png", buffer: PNG },
    ]);
    await page.getByLabel("Image report (optional, Excel or CSV)").setInputFiles({ name: "report.csv", mimeType: "text/csv", buffer: Buffer.from(report) });
    await page.getByRole("button", { name: "Upload images" }).click();

    await expect(page.getByText("3 images saved")).toBeVisible();
    await expect(page.getByText(/missing\.png: Listed in the report but not among the selected pictures/)).toBeVisible();
    await expect(page.getByText(/unlisted\.png: Selected but not listed in the report/)).toBeVisible();
    const images = await db.productImage.findMany({ where: { product: { sku } }, orderBy: { position: "asc" } });
    expect(images.map((i) => i.position)).toEqual([0, 1, 2]);
    expect(images[2].url).toBe("https://example.com/e2e-photo.jpg");
  } finally {
    await db.product.deleteMany({ where: { sku: { startsWith: `E2EIMP-${stamp}` } } });
  }
});
