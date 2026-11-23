"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { saveImage, UploadError } from "@/lib/upload";
import { slugify } from "@/lib/slug";
import { parseImageName, parseProductRows, type RowError } from "@/lib/import-parse";

export type ImportReport = { created: number; updated: number; errors: RowError[]; fatal?: string };
export type UploadReport = { saved: number; errors: { file: string; message: string }[] };

/** Imports one chunk (the browser sends 100 rows at a time so a big file never hits a time limit).
 *  A SKU that already exists is UPDATED: the CSV becomes the source of truth for its price, sizes, colors and stock. */
export async function importProductsCsv(form: FormData): Promise<ImportReport> {
  await requireAdmin();
  const csv = String(form.get("csv") ?? "");
  const offset = Number(form.get("lineOffset") ?? 0) || 0;
  const report: ImportReport = { created: 0, updated: 0, errors: [] };
  if (!csv.trim()) return { ...report, fatal: "The CSV is empty" };
  if (csv.length > 2_000_000) return { ...report, fatal: "That batch is too large" };

  const { rows, errors } = parseProductRows(csv, offset);
  report.errors.push(...errors);
  const categories = new Map<string, string>();

  for (const r of rows) {
    try {
      const key = `${r.gender}|${r.category.toLowerCase()}`;
      let categoryId = categories.get(key);
      if (!categoryId) {
        const slug = slugify(`${r.gender}-${r.category}`);
        categoryId = (await db.category.upsert({ where: { slug }, update: {}, create: { name: r.category, slug, gender: r.gender } })).id;
        categories.set(key, categoryId);
      }
      const data = {
        name: r.name, description: r.description, gender: r.gender, categoryId, published: r.published, featured: r.featured,
        price: Math.round(r.price * 100), salePrice: r.salePrice ? Math.round(r.salePrice * 100) : null,
      };
      const existing = await db.product.findUnique({ where: { sku: r.sku }, include: { variants: { include: { _count: { select: { orderItems: true } } } }, images: true } });

      if (!existing) {
        const base = slugify(r.name);
        const slug = (await db.product.findUnique({ where: { slug: base } })) ? `${base}-${slugify(r.sku)}` : base;
        await db.product.create({
          data: { ...data, sku: r.sku, slug, variants: { create: r.variants }, images: { create: r.imageUrls.map((url, position) => ({ url, alt: r.name, position })) } },
        });
        report.created++;
      } else {
        await db.$transaction(async (tx) => {
          await tx.product.update({ where: { id: existing.id }, data });
          const submitted = new Map(r.variants.map((v) => [`${v.size}|${v.color}`, v]));
          for (const e of existing.variants) {
            const k = `${e.size}|${e.color}`, s = submitted.get(k);
            if (s) { await tx.variant.update({ where: { id: e.id }, data: { stock: s.stock, colorHex: s.colorHex } }); submitted.delete(k); }
            else if (e._count.orderItems > 0) await tx.variant.update({ where: { id: e.id }, data: { stock: 0 } }); // already ordered: keep for history
            else await tx.variant.delete({ where: { id: e.id } });
          }
          for (const v of submitted.values()) await tx.variant.create({ data: { productId: existing.id, ...v } });
          const have = new Set(existing.images.map((i) => i.url));
          let pos = Math.max(-1, ...existing.images.map((i) => i.position)) + 1;
          for (const url of r.imageUrls) if (!have.has(url)) await tx.productImage.create({ data: { productId: existing.id, url, alt: r.name, position: pos++ } });
        });
        report.updated++;
      }
    } catch (e) {
      console.error("import row failed", r.sku, e);
      const clash = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      report.errors.push({ line: r.line, sku: r.sku, message: clash ? "This product name or SKU clashes with another product" : "This row couldn't be saved" });
    }
  }
  revalidatePath("/", "layout");
  return report;
}

const metaSchema = z.array(z.object({ file: z.string().max(300), sku: z.string().min(1).max(60), position: z.number().int().min(1).max(30) })).max(10);
const linksSchema = z.array(z.object({ sku: z.string().min(1).max(60), url: z.string().url().startsWith("https://").max(1000), position: z.number().int().min(1).max(30) })).max(100);

/** Puts a picture in a numbered slot of a product (1 = cover). Using a slot again replaces that picture, so repeats never duplicate. */
async function putImage(productId: string, alt: string, slot: number, url: string) {
  const position = slot - 1;
  const existing = await db.productImage.findFirst({ where: { productId, position } });
  if (existing) await db.productImage.update({ where: { id: existing.id }, data: { url, alt } });
  else await db.productImage.create({ data: { productId, url, alt, position } });
}

/** Uploads pictures. Each file is matched to a product either by an image report (the browser sends `meta`: file name, SKU, slot)
 *  or by its name: SKU.jpg is the cover, SKU_2.jpg the second picture, and so on. */
export async function uploadProductImages(form: FormData): Promise<UploadReport> {
  await requireAdmin();
  const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 6);
  const report: UploadReport = { saved: 0, errors: [] };

  const meta = new Map<string, { sku: string; position: number }>();
  const rawMeta = form.get("meta");
  if (typeof rawMeta === "string" && rawMeta) {
    try { for (const m of metaSchema.parse(JSON.parse(rawMeta))) meta.set(m.file, { sku: m.sku, position: m.position }); }
    catch { return { saved: 0, errors: [{ file: "(batch)", message: "The picture list was invalid. Reload the page and try again." }] }; }
  }

  await Promise.all(files.map(async (file) => {
    const m = meta.get(file.name);
    const target = m ? { sku: m.sku, index: m.position } : parseImageName(file.name);
    if (!target) { report.errors.push({ file: file.name, message: "Name the file like SKU.jpg or SKU_2.jpg, or list it in an image report" }); return; }
    const product = await db.product.findUnique({ where: { sku: target.sku }, select: { id: true, name: true } });
    if (!product) { report.errors.push({ file: file.name, message: `No product with SKU ${target.sku}. Import the products first.` }); return; }
    try {
      await putImage(product.id, product.name, target.index, await saveImage(file));
      report.saved++;
    } catch (e) {
      report.errors.push({ file: file.name, message: e instanceof UploadError ? e.message : "Upload failed. Try this file again." });
    }
  }));
  revalidatePath("/", "layout");
  return report;
}

/** Saves links to pictures that are already online (from an image report's image_url column). Nothing is uploaded. */
export async function attachImageLinks(form: FormData): Promise<UploadReport> {
  await requireAdmin();
  const report: UploadReport = { saved: 0, errors: [] };
  let items: z.infer<typeof linksSchema>;
  try { items = linksSchema.parse(JSON.parse(String(form.get("items") ?? "[]"))); }
  catch { return { saved: 0, errors: [{ file: "(links)", message: "One of the picture links isn't valid. Links must start with https://" }] }; }
  for (const it of items) {
    const product = await db.product.findUnique({ where: { sku: it.sku }, select: { id: true, name: true } });
    if (!product) { report.errors.push({ file: it.url, message: `No product with SKU ${it.sku}. Import the products first.` }); continue; }
    await putImage(product.id, product.name, it.position, it.url);
    report.saved++;
  }
  revalidatePath("/", "layout");
  return report;
}

/** Which of these SKUs don't exist yet? The browser asks before uploading pictures, so nothing is uploaded for a missing product. */
export async function findMissingSkus(skus: string[]): Promise<string[]> {
  await requireAdmin();
  const unique = Array.from(new Set(skus.map((s) => String(s)))).slice(0, 5000);
  const found = new Set<string>();
  for (let i = 0; i < unique.length; i += 500) {
    const rows = await db.product.findMany({ where: { sku: { in: unique.slice(i, i + 500) } }, select: { sku: true } });
    rows.forEach((r) => found.add(r.sku));
  }
  return unique.filter((s) => !found.has(s));
}
