import "server-only";
import { db } from "./db";

export type RatingSummary = { count: number; average: number; distribution: Record<1 | 2 | 3 | 4 | 5, number> };

/** Turns per-star counts into totals and an average rounded to one decimal. Pure, so it is easy to test. */
export function summarise(rows: { rating: number; count: number }[]): RatingSummary {
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let count = 0, sum = 0;
  for (const r of rows) {
    if (r.rating < 1 || r.rating > 5) continue;
    distribution[r.rating as 1 | 2 | 3 | 4 | 5] += r.count;
    count += r.count; sum += r.rating * r.count;
  }
  return { count, average: count ? Math.round((sum / count) * 10) / 10 : 0, distribution };
}

/** "Asha Rao" becomes "Asha R." so reviews don't expose full names. */
export function displayName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Customer";
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/** Ratings for one product, or for the whole store when no product is given. Hidden reviews never count. */
export async function getReviewSummary(scope: { productId?: string } = {}) {
  const rows = await db.review.groupBy({
    by: ["rating"],
    where: { hidden: false, ...(scope.productId ? { productId: scope.productId } : { product: { published: true } }) },
    _count: { rating: true },
  });
  return summarise(rows.map((r) => ({ rating: r.rating, count: r._count.rating })));
}

/** Adds { rating: { avg, count } | null } to each product, for the small badge on product cards. */
export async function attachRatings<T extends { id: string }>(items: T[]): Promise<(T & { rating: { avg: number; count: number } | null })[]> {
  if (items.length === 0) return [];
  const rows = await db.review.groupBy({ by: ["productId"], where: { hidden: false, productId: { in: items.map((i) => i.id) } }, _avg: { rating: true }, _count: { rating: true } });
  const byId = new Map(rows.map((r) => [r.productId, { avg: Math.round((r._avg.rating ?? 0) * 10) / 10, count: r._count.rating }]));
  return items.map((i) => ({ ...i, rating: byId.get(i.id) ?? null }));
}

/** A "verified purchase" is a paid, not-cancelled order that contains this product. */
export async function isVerifiedBuyer(userId: string, productId: string) {
  const n = await db.orderItem.count({ where: { variant: { productId }, order: { userId, status: { not: "CANCELLED" }, payments: { some: { status: "SUCCESS" } } } } });
  return n > 0;
}
