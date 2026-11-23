"use server";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { allow, clearLimit } from "@/lib/rate-limit";
import { createSession, requireAdmin } from "@/lib/session";
import { parseDirectUrls, saveImage, UploadError } from "@/lib/upload";
import { slugify } from "@/lib/slug";
import { categorySchema, firstError, loginSchema, productSchema } from "@/lib/validation";
import type { FormState } from "./auth";

const MAX_IMAGES = 8;
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);
const refresh = () => revalidatePath("/", "layout");
const isUnique = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

export async function adminLogin(_: FormState, form: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter your email and password" };
  const { email, password } = parsed.data;
  const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `admin:${email}:${ip}`;
  if (!allow(key, 5, 15 * 60_000)) return { error: "Too many attempts. Try again in 15 minutes." };

  const user = await db.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || !user.active || user.role !== "ADMIN") return { error: "Email or password is incorrect" };
  clearLimit(key);
  await createSession(user.id);
  redirect("/admin");
}

export async function saveProduct(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const id = String(form.get("id") ?? "") || null;

  let variants: unknown;
  try { variants = JSON.parse(String(form.get("variants") ?? "[]")); } catch { return { error: "Variants couldn't be read. Reload and try again." }; }

  const parsed = productSchema.safeParse({
    name: form.get("name"), sku: form.get("sku"), description: form.get("description"),
    gender: form.get("gender"), categoryId: form.get("categoryId"),
    price: form.get("price"), salePrice: form.get("salePrice"),
    published: form.get("published") === "on", featured: form.get("featured") === "on", variants,
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  const data = {
    name: d.name, sku: d.sku, description: d.description, gender: d.gender, categoryId: d.categoryId,
    price: Math.round(d.price * 100), salePrice: d.salePrice ? Math.round(d.salePrice * 100) : null,
    published: d.published, featured: d.featured,
  };

  const removeIds = form.getAll("removeImage").map(String);
  const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  const keptCount = id ? (await db.productImage.count({ where: { productId: id, id: { notIn: removeIds } } })) : 0;
  const direct = parseDirectUrls(form.get("imageUrls"));
  if (direct === null) return { error: "One of the uploaded pictures has an invalid link. Please try again." };
  if (keptCount + files.length + direct.length > MAX_IMAGES) return { error: `A product can have at most ${MAX_IMAGES} images` };

  let urls: string[];
  try { urls = [...(await Promise.all(files.map(saveImage))), ...direct]; }
  catch (e) { return { error: e instanceof UploadError ? e.message : "Image upload failed. Nothing was saved." }; }

  try {
    if (!id) {
      const base = slugify(d.name);
      const slug = (await db.product.findUnique({ where: { slug: base } })) ? `${base}-${slugify(d.sku)}` : base;
      await db.product.create({
        data: { ...data, slug, variants: { create: d.variants }, images: { create: urls.map((url, position) => ({ url, alt: d.name, position })) } },
      });
    } else {
      await db.$transaction(async (tx) => {
        await tx.product.update({ where: { id }, data });
        const existing = await tx.variant.findMany({ where: { productId: id }, include: { _count: { select: { orderItems: true } } } });
        const submitted = new Map(d.variants.map((v) => [`${v.size}|${v.color}`, v]));
        for (const e of existing) {
          const k = `${e.size}|${e.color}`, s = submitted.get(k);
          if (s) { await tx.variant.update({ where: { id: e.id }, data: { stock: s.stock, colorHex: s.colorHex } }); submitted.delete(k); }
          // Variants that appear in past orders can't be deleted; they're set to zero stock instead.
          else if (e._count.orderItems > 0) await tx.variant.update({ where: { id: e.id }, data: { stock: 0 } });
          else await tx.variant.delete({ where: { id: e.id } });
        }
        for (const v of submitted.values()) await tx.variant.create({ data: { productId: id, ...v } });
        if (removeIds.length) await tx.productImage.deleteMany({ where: { productId: id, id: { in: removeIds } } });
        const last = await tx.productImage.aggregate({ where: { productId: id }, _max: { position: true } });
        let pos = (last._max.position ?? -1) + 1;
        for (const url of urls) await tx.productImage.create({ data: { productId: id, url, alt: d.name, position: pos++ } });
      });
    }
  } catch (e) {
    if (isUnique(e)) return { error: "That SKU or product name is already used by another product" };
    throw e;
  }
  refresh();
  redirect("/admin/products");
}

export async function setPublished(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  await db.product.update({ where: { id }, data: { published: form.get("publish") === "1" } });
  refresh();
}

export async function deleteProduct(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const ordered = await db.orderItem.count({ where: { variant: { productId: id } } });
  if (ordered > 0) redirect("/admin/products?error=ordered"); // keep order history intact: unpublish instead
  await db.product.delete({ where: { id } });
  refresh();
}

export async function createCategory(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = categorySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  try {
    await db.category.create({ data: { name: parsed.data.name, gender: parsed.data.gender, slug: slugify(`${parsed.data.gender}-${parsed.data.name}`) } });
  } catch (e) { if (isUnique(e)) return { error: "That category already exists" }; throw e; }
  refresh();
  return { ok: "Category added" };
}

export async function renameCategory(form: FormData) {
  await requireAdmin();
  const parsed = categorySchema.safeParse({ name: form.get("name"), gender: form.get("gender") });
  if (!parsed.success) return;
  try { await db.category.update({ where: { id: String(form.get("id")) }, data: parsed.data }); } catch (e) { if (!isUnique(e)) throw e; }
  refresh();
}

export async function deleteCategory(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  if ((await db.product.count({ where: { categoryId: id } })) > 0) redirect("/admin/categories?error=inuse");
  await db.category.delete({ where: { id } });
  refresh();
}
