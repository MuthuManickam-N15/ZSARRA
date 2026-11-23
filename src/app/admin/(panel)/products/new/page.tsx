import type { Metadata } from "next";
import ProductForm from "@/components/ProductForm";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Add product", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewProduct() {
  const categories = await db.category.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold md:text-2xl">Add product</h1>
      {categories.length === 0 && <p className="border border-ink bg-paper p-3 text-sm">Create a category first.</p>}
      <ProductForm categories={categories} initial={{ name: "", sku: "", description: "", gender: "WOMEN", categoryId: "", price: "", salePrice: "", published: false, featured: false, images: [], variants: [{ size: "M", color: "Black", colorHex: "#000000", stock: 0 }] }} />
    </div>
  );
}
