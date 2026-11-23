import type { Metadata } from "next";
import Link from "next/link";
import { RatingBars } from "@/components/ReviewsSection";
import Stars from "@/components/Stars";
import { db } from "@/lib/db";
import { img } from "@/lib/img";
import { displayName, getReviewSummary } from "@/lib/reviews";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Customer reviews" };
export const dynamic = "force-dynamic";
const PAGE = 10;
const date = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function ReviewsPage({ searchParams }: { searchParams: { rating?: string; product?: string; page?: string } }) {
  const user = await getCurrentUser();
  const product = searchParams.product ? await db.product.findFirst({ where: { slug: searchParams.product, published: true }, select: { id: true, name: true, slug: true } }) : null;
  const rating = ["1", "2", "3", "4", "5"].includes(searchParams.rating ?? "") ? Number(searchParams.rating) : null;
  const page = Math.max(1, Number(searchParams.page) || 1);
  const where = { hidden: false, product: { published: true, ...(product ? { id: product.id } : {}) }, ...(rating ? { rating } : {}) };

  const [summary, total, reviews, purchased] = await Promise.all([
    getReviewSummary(product ? { productId: product.id } : {}),
    db.review.count({ where }),
    db.review.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE,
      include: { user: { select: { name: true } }, product: { select: { name: true, slug: true, images: { orderBy: { position: "asc" }, take: 1 } } } },
    }),
    user && !product
      ? db.product.findMany({ where: { published: true, variants: { some: { orderItems: { some: { order: { userId: user.id, status: { not: "CANCELLED" }, payments: { some: { status: "SUCCESS" } } } } } } } }, select: { name: true, slug: true }, take: 12 })
      : Promise.resolve([] as { name: string; slug: string }[]),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE));
  const href = (r: number | null, pg = 1) => {
    const sp = new URLSearchParams();
    if (product) sp.set("product", product.slug);
    if (r) sp.set("rating", String(r));
    if (pg > 1) sp.set("page", String(pg));
    const q = sp.toString();
    return `/reviews${q ? `?${q}` : ""}`;
  };
  const chip = (active: boolean) => `rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-colors ${active ? "border-ink bg-ink text-white" : "border-ink/20 hover:border-ink"}`;

  return (
    <div className="container-page py-6 md:py-8">
      <nav aria-label="Breadcrumb" className="text-xs text-ink/60"><Link href="/" className="hover:text-ink">Home</Link> <span aria-hidden>/</span> <span className="font-semibold text-ink">Reviews</span></nav>
      <h1 className="mt-3 text-2xl font-bold md:text-3xl">{product ? `Reviews for ${product.name}` : "Customer reviews"}</h1>
      {product && <p className="mt-1 text-sm"><Link href={`/products/${product.slug}`} className="font-bold text-bronze hover:underline">View product</Link> · <Link href="/reviews" className="text-ink/60 hover:text-ink">All reviews</Link></p>}

      <div className="mt-8 grid gap-10 lg:grid-cols-[17rem_1fr]">
        <aside className="space-y-8">
          <div>
            {summary.count === 0 ? <p className="text-sm text-ink/60">No ratings yet.</p> : (
              <>
                <p className="flex items-end gap-2"><span className="text-5xl font-bold leading-none">{summary.average.toFixed(1)}</span><span aria-hidden className="pb-1 text-2xl text-bronze">★</span></p>
                <p className="mt-1 text-sm text-ink/60">{summary.count} {summary.count === 1 ? "rating" : "ratings"}</p>
                <RatingBars summary={summary} />
              </>
            )}
          </div>
          {!product && (
            <div className="border border-ink/15 bg-white p-4 text-sm">
              <h2 className="text-[13px] font-bold uppercase tracking-[0.08em]">Share your opinion</h2>
              {user ? (
                purchased.length > 0 ? (
                  <>
                    <p className="mt-2 text-ink/70">Review something you bought:</p>
                    <ul className="mt-2 space-y-1.5">{purchased.map((p) => <li key={p.slug}><Link href={`/products/${p.slug}#reviews`} className="font-bold text-bronze hover:underline">{p.name}</Link></li>)}</ul>
                  </>
                ) : <p className="mt-2 text-ink/70">Open any product page and use “Write a review”. Reviews from buyers carry a ✓ Verified purchase tag.</p>
              ) : <p className="mt-2 text-ink/70"><Link href={`/login?next=${encodeURIComponent("/reviews")}`} className="font-bold text-bronze hover:underline">Log in</Link> to write a review.</p>}
            </div>
          )}
        </aside>

        <div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by rating">
            <Link href={href(null)} className={chip(!rating)} aria-current={!rating ? "true" : undefined}>All</Link>
            {[5, 4, 3, 2, 1].map((n) => <Link key={n} href={href(n)} className={chip(rating === n)} aria-current={rating === n ? "true" : undefined}>{n} ★</Link>)}
          </div>
          <p className="mt-4 text-sm text-ink/60" aria-live="polite">{total} {total === 1 ? "review" : "reviews"}</p>

          {reviews.length === 0 ? (
            <div className="mt-4 border border-ink/15 bg-white p-10 text-center text-sm">
              <p>{rating || product ? "No reviews match this filter." : "No reviews yet. Be the first to review a product you love."}</p>
              <Link href={product ? "/reviews" : "/new-arrivals"} className="btn-outline mt-4">{product ? "See all reviews" : "Browse new arrivals"}</Link>
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-ink/10">
              {reviews.map((r) => (
                <li key={r.id} className="flex gap-4 py-5">
                  <Link href={`/products/${r.product.slug}`} className="block h-24 w-[4.5rem] shrink-0 overflow-hidden bg-ivory/50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r.product.images[0] ? <img src={img(r.product.images[0].url, 200)} alt="" className="h-full w-full object-cover" /> : <span aria-hidden className="flex h-full items-center justify-center text-3xl font-light text-ink/15">{r.product.name[0]}</span>}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/products/${r.product.slug}`} className="text-sm font-bold hover:text-bronze">{r.product.name}</Link>
                    <div className="mt-1 flex flex-wrap items-center gap-3"><Stars value={r.rating} />{r.title && <p className="font-bold">{r.title}</p>}</div>
                    <p className="mt-2 whitespace-pre-line text-sm text-ink/80">{r.body}</p>
                    <p className="mt-2 text-xs text-ink/55">{displayName(r.user.name)} · {date(r.createdAt)}{r.verified && <span className="ml-2 font-bold text-bronze">✓ Verified purchase</span>}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {pages > 1 && (
            <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-8 text-sm font-semibold">
              {page > 1 && <Link href={href(rating, page - 1)} className="link-u">Previous</Link>}
              <span className="font-normal text-ink/60">Page {page} of {pages}</span>
              {page < pages && <Link href={href(rating, page + 1)} className="link-u">Next</Link>}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
