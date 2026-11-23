import type { Metadata } from "next";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import ConfirmButton from "@/components/ConfirmButton";
import Stars from "@/components/Stars";
import { deleteReview, setReviewHidden } from "@/app/actions/reviews";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Reviews", robots: { index: false } };
export const dynamic = "force-dynamic";
const SIZE = 20;

export default async function AdminReviews({ searchParams: sp }: { searchParams: { q?: string; rating?: string; status?: string; page?: string } }) {
  const where: Prisma.ReviewWhereInput = {
    ...(["1", "2", "3", "4", "5"].includes(sp.rating ?? "") ? { rating: Number(sp.rating) } : {}),
    ...(sp.status === "visible" ? { hidden: false } : sp.status === "hidden" ? { hidden: true } : {}),
    ...(sp.q ? { OR: [{ body: { contains: sp.q, mode: "insensitive" } }, { title: { contains: sp.q, mode: "insensitive" } }, { product: { name: { contains: sp.q, mode: "insensitive" } } }, { user: { email: { contains: sp.q, mode: "insensitive" } } }] } : {}),
  };
  const page = Math.max(1, Number(sp.page) || 1);
  const [rows, total] = await Promise.all([
    db.review.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * SIZE, take: SIZE, include: { user: { select: { name: true, email: true } }, product: { select: { name: true, slug: true } } } }),
    db.review.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / SIZE));
  const link = (n: number) => `/admin/reviews?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.rating ? { rating: sp.rating } : {}), ...(sp.status ? { status: sp.status } : {}), page: String(n) })}`;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold md:text-2xl">Reviews</h1>
      <p className="text-sm text-ink/70">Customers can post reviews immediately. Hide a review to remove it from the store (and from the ratings) without deleting it, or delete it for good.</p>
      <form className="flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={sp.q} placeholder="Search text, product or customer email" aria-label="Search reviews" className="field max-w-xs" />
        <select name="rating" defaultValue={sp.rating ?? ""} aria-label="Rating" className="field w-auto"><option value="">Any rating</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}</select>
        <select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className="field w-auto"><option value="">Any status</option><option value="visible">Visible</option><option value="hidden">Hidden</option></select>
        <button className="btn-outline">Filter</button>
      </form>
      {rows.length === 0 ? <p className="border border-ink/15 bg-white p-10 text-center text-sm">No reviews found.</p> : (
        <div className="overflow-x-auto border border-ink/15 bg-white">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="border-b border-ink/15"><tr><th className="p-3">Review</th><th className="p-3">Product</th><th className="p-3">Customer</th><th className="p-3">Status</th><th className="p-3"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody className="divide-y divide-ink/10">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="max-w-xs p-3"><Stars value={r.rating} />{r.title && <p className="mt-1 font-bold">{r.title}</p>}<p className="mt-1 line-clamp-3 text-ink/80">{r.body}</p><p className="mt-1 text-xs text-ink/50">{r.createdAt.toLocaleDateString("en-IN")}{r.verified ? " · Verified purchase" : ""}</p></td>
                  <td className="p-3"><Link href={`/products/${r.product.slug}`} className="hover:text-bronze">{r.product.name}</Link></td>
                  <td className="p-3">{r.user.name}<div className="text-xs text-ink/60">{r.user.email}</div></td>
                  <td className="p-3">{r.hidden ? "Hidden" : "Visible"}</td>
                  <td className="p-3"><div className="flex gap-4">
                    <form action={setReviewHidden}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="hide" value={r.hidden ? "0" : "1"} /><button className="underline hover:text-bronze">{r.hidden ? "Show" : "Hide"}</button></form>
                    <form action={deleteReview}><input type="hidden" name="id" value={r.id} /><ConfirmButton message="Delete this review permanently?" className="underline hover:text-bronze">Delete</ConfirmButton></form>
                  </div></td>
                </tr>))}
            </tbody>
          </table>
        </div>)}
      {pages > 1 && <nav aria-label="Pagination" className="flex justify-center gap-6 text-sm">{page > 1 && <Link href={link(page - 1)}>Previous</Link>}<span>Page {page} of {pages}</span>{page < pages && <Link href={link(page + 1)}>Next</Link>}</nav>}
    </div>
  );
}
