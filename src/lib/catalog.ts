import { Gender, Prisma } from "@prisma/client";
import { db } from "./db";
import { attachRatings } from "./reviews";

export const PAGE_SIZE = 12;

export type CatalogParams = {
  gender?: Gender;
  saleOnly?: boolean;
  q?: string;
  category?: string;
  size?: string;
  color?: string;
  min?: string;
  max?: string;
  inStock?: string;
  sort?: string;
  page?: string;
};

export async function getProducts(p: CatalogParams) {
  const variantFilter: Prisma.VariantWhereInput = {};
  if (p.size) variantFilter.size = p.size;
  if (p.color) variantFilter.color = p.color;
  if (p.inStock === "1") variantFilter.stock = { gt: 0 };

  const price: Prisma.IntFilter = {};
  const min = Number(p.min), max = Number(p.max);
  if (p.min && Number.isFinite(min)) price.gte = Math.round(min * 100);
  if (p.max && Number.isFinite(max)) price.lte = Math.round(max * 100);

  const where: Prisma.ProductWhereInput = {
    published: true,
    ...(p.gender ? { gender: { in: [p.gender, "UNISEX"] } } : {}),
    ...(p.saleOnly ? { salePrice: { not: null } } : {}),
    ...(p.category ? { category: { slug: p.category } } : {}),
    ...(p.q ? { OR: [{ name: { contains: p.q, mode: "insensitive" } }, { description: { contains: p.q, mode: "insensitive" } }, { sku: { contains: p.q, mode: "insensitive" } }] } : {}),
    ...(Object.keys(price).length ? { price } : {}),
    ...(Object.keys(variantFilter).length ? { variants: { some: variantFilter } } : {}),
  };

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    p.sort === "price-asc" ? { price: "asc" } :
    p.sort === "price-desc" ? { price: "desc" } :
    p.sort === "popular" ? { popularity: "desc" } : { createdAt: "desc" };

  const page = Math.max(1, Number(p.page) || 1);
  const [items, total] = await Promise.all([
    db.product.findMany({
      where, orderBy, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      include: { images: { orderBy: { position: "asc" }, take: 1 }, variants: { select: { stock: true, size: true } } },
    }),
    db.product.count({ where }),
  ]);
  return { items: await attachRatings(items), total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getFacets(gender?: Gender) {
  const productWhere: Prisma.ProductWhereInput = { published: true, ...(gender ? { gender: { in: [gender, "UNISEX"] } } : {}) };
  const [categories, variants] = await Promise.all([
    db.category.findMany({ where: gender ? { gender: { in: [gender, "UNISEX"] } } : {}, orderBy: { name: "asc" } }),
    db.variant.findMany({ where: { product: productWhere }, select: { size: true, color: true }, distinct: ["size", "color"] }),
  ]);
  return {
    categories,
    sizes: Array.from(new Set(variants.map((v) => v.size))),
    colors: Array.from(new Set(variants.map((v) => v.color))),
  };
}
