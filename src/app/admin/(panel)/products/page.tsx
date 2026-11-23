import type { Metadata } from "next";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import ConfirmButton from "@/components/ConfirmButton";
import { deleteProduct, setPublished } from "@/app/actions/admin";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Products", robots: { index: false } };
export const dynamic = "force-dynamic";
const SIZE = 15;

type SP = { q?: string; gender?: string; status?: string; page?: string; error?: string };

export default async function Products({ searchParams: sp }: { searchParams: SP }) {
  const where: Prisma.ProductWhereInput = {
    ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { sku: { contains: sp.q, mode: "insensitive" } }] } : {}),
    ...(["MEN", "WOMEN", "UNISEX"].includes(sp.gender ?? "") ? { gender: sp.gender as "MEN" } : {}),
    ...(sp.status === "published" ? { published: true } : sp.status === "draft" ? { published: false } : {}),
  };
  const page = Math.max(1, Number(sp.page) || 1);
  const [items, total] = await Promise.all([
    db.product.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * SIZE, take: SIZE, include: { variants: { select: { stock: true, size: true } }, category: true } }),
    db.product.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / SIZE));
  const link = (n: number) => `/admin/products?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.gender ? { gender: sp.gender } : {}), ...(sp.status ? { status: sp.status } : {}), page: String(n) })}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold md:text-2xl">Products</h1>
        <Link href="/admin/products/new" className="btn-primary">Add product</Link>
      </div>
      {sp.error === "ordered" && <p role="alert" className="border border-ink bg-paper p-3 text-sm">This product appears in past orders and can't be deleted. Unpublish it instead.</p>}
      <form className="flex flex-wrap gap-2 text-sm" role="search">
        <input name="q" defaultValue={sp.q} placeholder="Search name or SKU" className="field max-w-xs" aria-label="Search products" />
        <select name="gender" defaultValue={sp.gender ?? ""} className="field w-auto" aria-label="Collection"><option value="">All collections</option><option value="MEN">Men</option><option value="WOMEN">Women</option><option value="UNISEX">Unisex</option></select>
        <select name="status" defaultValue={sp.status ?? ""} className="field w-auto" aria-label="Status"><option value="">Any status</option><option value="published">Published</option><option value="draft">Unpublished</option></select>
        <button className="btn-outline">Filter</button>
      </form>
      {items.length === 0 ? <p className="border border-ink/20 bg-paper p-10 text-center text-sm">No products found.</p> : (
        <div className="overflow-x-auto border border-ink/20 bg-paper">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-ink/20"><tr><th className="p-3">Product</th><th className="p-3">Price</th><th className="p-3">Stock</th><th className="p-3">Status</th><th className="p-3"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody className="divide-y divide-ink/10">
              {items.map((p) => {
                const stock = p.variants.reduce((n, v) => n + v.stock, 0);
                return (
                  <tr key={p.id}>
                    <td className="p-3"><Link href={`/admin/products/${p.id}/edit`} className="font-medium hover:text-bronze">{p.name}</Link><div className="text-xs text-ink/60">{p.sku} · {p.gender.toLowerCase()} · {p.category.name}</div></td>
                    <td className="p-3">{p.salePrice ? <><span className="text-bronze">{formatPrice(p.salePrice)}</span> <s className="text-ink/50">{formatPrice(p.price)}</s></> : formatPrice(p.price)}</td>
                    <td className="p-3">{stock === 0 ? "Sold out" : stock}</td>
                    <td className="p-3">{p.published ? "Published" : "Unpublished"}</td>
                    <td className="flex gap-4 p-3">
                      <form action={setPublished}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="publish" value={p.published ? "0" : "1"} /><button className="underline hover:text-bronze">{p.published ? "Unpublish" : "Publish"}</button></form>
                      <form action={deleteProduct}><input type="hidden" name="id" value={p.id} /><ConfirmButton message={`Delete “${p.name}” permanently? This can't be undone.`} className="underline hover:text-bronze">Delete</ConfirmButton></form>
                    </td>
                  </tr>);
              })}
            </tbody>
          </table>
        </div>)}
      {pages > 1 && <nav aria-label="Pagination" className="flex justify-center gap-6 text-sm">{page > 1 && <Link href={link(page - 1)}>Previous</Link>}<span>Page {page} of {pages}</span>{page < pages && <Link href={link(page + 1)}>Next</Link>}</nav>}
    </div>
  );
}
