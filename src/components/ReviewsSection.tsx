import Link from "next/link";
import { deleteMyReview } from "@/app/actions/reviews";
import { db } from "@/lib/db";
import { displayName, isVerifiedBuyer, type RatingSummary } from "@/lib/reviews";
import ConfirmButton from "./ConfirmButton";
import ReviewForm from "./ReviewForm";
import Stars from "./Stars";

const date = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const PREVIEW = 6;

export function RatingBars({ summary }: { summary: RatingSummary }) {
  return (
    <ul className="mt-4 space-y-1.5" aria-label="Ratings breakdown">
      {([5, 4, 3, 2, 1] as const).map((n) => {
        const pct = summary.count ? (summary.distribution[n] / summary.count) * 100 : 0;
        return (
          <li key={n} className="flex items-center gap-2 text-xs">
            <span className="w-3 text-right">{n}</span><span aria-hidden className="text-bronze">★</span>
            <span className="h-1.5 flex-1 bg-ink/10"><span className="block h-full bg-bronze" style={{ width: `${pct}%` }} /></span>
            <span className="w-8 text-right text-ink/60">{summary.distribution[n]}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default async function ReviewsSection({ product, user, summary }: { product: { id: string; slug: string }; user: { id: string } | null; summary: RatingSummary }) {
  const [reviews, mine, verified] = await Promise.all([
    db.review.findMany({ where: { productId: product.id, hidden: false }, orderBy: { createdAt: "desc" }, take: PREVIEW, include: { user: { select: { name: true } } } }),
    user ? db.review.findUnique({ where: { productId_userId: { productId: product.id, userId: user.id } } }) : null,
    user ? isVerifiedBuyer(user.id, product.id) : false,
  ]);
  const loginHref = `/login?next=${encodeURIComponent(`/products/${product.slug}#reviews`)}`;

  return (
    <section id="reviews" aria-labelledby="reviews-title" className="mt-16 border-t border-ink/10 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="reviews-title" className="section-title">Ratings &amp; reviews</h2>
        {summary.count > PREVIEW && <Link href={`/reviews?product=${product.slug}`} className="text-sm font-bold text-bronze hover:underline">See all {summary.count} reviews</Link>}
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[17rem_1fr] lg:gap-12">
        <div>
          {summary.count === 0 ? (
            <p className="text-sm text-ink/60">No ratings yet.</p>
          ) : (
            <>
              <p className="flex items-end gap-2"><span className="text-5xl font-bold leading-none">{summary.average.toFixed(1)}</span><span aria-hidden className="pb-1 text-2xl text-bronze">★</span></p>
              <p className="mt-1 text-sm text-ink/60">{summary.count} {summary.count === 1 ? "rating" : "ratings"}</p>
              <RatingBars summary={summary} />
            </>
          )}
        </div>

        <div>
          <div className="border border-ink/15 bg-white p-5">
            <h3 className="text-base font-bold">{mine ? "Your review" : "Write a review"}</h3>
            {user ? (
              <>
                {verified && <p className="mt-1 text-xs font-bold text-bronze">✓ Verified purchase</p>}
                {mine?.hidden && <p className="mt-1 text-xs text-ink/60">An admin has hidden your review from the public.</p>}
                <div className="mt-4"><ReviewForm productId={product.id} existing={mine ? { rating: mine.rating, title: mine.title, body: mine.body } : null} /></div>
                {mine && (
                  <form action={deleteMyReview} className="mt-3">
                    <input type="hidden" name="id" value={mine.id} />
                    <ConfirmButton message="Delete your review?" className="text-sm font-semibold text-ink/60 underline hover:text-ink">Delete my review</ConfirmButton>
                  </form>
                )}
              </>
            ) : (
              <p className="mt-2 text-sm text-ink/70"><Link href={loginHref} className="font-bold text-bronze hover:underline">Log in</Link> to write a review.</p>
            )}
          </div>

          {reviews.length === 0 ? (
            <p className="mt-6 text-sm text-ink/60">No reviews yet. Be the first to share what you think.</p>
          ) : (
            <ul className="mt-2 divide-y divide-ink/10">
              {reviews.map((r) => (
                <li key={r.id} className="py-5">
                  <div className="flex flex-wrap items-center gap-3"><Stars value={r.rating} />{r.title && <p className="font-bold">{r.title}</p>}</div>
                  <p className="mt-2 whitespace-pre-line text-sm text-ink/80">{r.body}</p>
                  <p className="mt-2 text-xs text-ink/55">{displayName(r.user.name)} · {date(r.createdAt)}{r.verified && <span className="ml-2 font-bold text-bronze">✓ Verified purchase</span>}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
