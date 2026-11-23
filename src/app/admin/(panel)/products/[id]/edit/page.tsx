import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductForm from "@/components/ProductForm";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Edit product", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditProduct({ params }: { params: { id: string } }) {
  const [p, categories] = await Promise.all([
    db.product.findUnique({ where: { id: params.id }, include: { variants: { orderBy: [{ color: "asc" }, { size: "asc" }] }, images: { orderBy: { position: "asc" } } } }),
    db.category.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!p) notFound();
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold md:text-2xl">Edit {p.name}</h1>
      <ProductForm categories={categories} initial={{
        id: p.id, name: p.name, sku: p.sku, description: p.description, gender: p.gender, categoryId: p.categoryId,
        price: String(p.price / 100), salePrice: p.salePrice ? String(p.salePrice / 100) : "", published: p.published, featured: p.featured,
        images: p.images.map((i) => ({ id: i.id, url: i.url })),
        variants: p.variants.map((v) => ({ size: v.size, color: v.color, colorHex: v.colorHex, stock: v.stock })),
      }} />
    </div>
  );
}
