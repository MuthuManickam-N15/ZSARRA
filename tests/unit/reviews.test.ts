import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ groupBy: vi.fn(), count: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { review: { groupBy: h.groupBy }, orderItem: { count: h.count } } }));

import { attachRatings, displayName, getReviewSummary, isVerifiedBuyer, summarise } from "@/lib/reviews";
import { reviewSchema } from "@/lib/validation";

beforeEach(() => { h.groupBy.mockReset(); h.count.mockReset(); });

describe("summarise", () => {
  it("handles no reviews", () => expect(summarise([])).toEqual({ count: 0, average: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }));
  it("counts stars and rounds the average to one decimal", () => {
    const s = summarise([{ rating: 4, count: 2 }, { rating: 5, count: 1 }]);
    expect(s).toMatchObject({ count: 3, average: 4.3 });
    expect(s.distribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 2, 5: 1 });
    expect(summarise([{ rating: 5, count: 3 }, { rating: 4, count: 1 }]).average).toBe(4.8);
  });
  it("ignores ratings outside 1 to 5", () => {
    expect(summarise([{ rating: 0, count: 9 }, { rating: 6, count: 9 }, { rating: 3, count: 1 }])).toMatchObject({ count: 1, average: 3 });
  });
});

describe("displayName", () => {
  it.each([["Asha Rao", "Asha R."], ["  asha   rao kumar ", "asha K."], ["Asha", "Asha"], ["", "Customer"], ["   ", "Customer"]])("%j becomes %j", (a, b) => expect(displayName(a)).toBe(b));
});

describe("review queries", () => {
  it("summarises one product and never counts hidden reviews", async () => {
    h.groupBy.mockResolvedValue([{ rating: 5, _count: { rating: 2 } }, { rating: 1, _count: { rating: 1 } }]);
    expect(await getReviewSummary({ productId: "p1" })).toMatchObject({ count: 3, average: 3.7 });
    expect(h.groupBy.mock.calls[0][0].where).toEqual({ hidden: false, productId: "p1" });
  });
  it("summarises the whole store using published products only", async () => {
    h.groupBy.mockResolvedValue([]);
    await getReviewSummary();
    expect(h.groupBy.mock.calls[0][0].where).toEqual({ hidden: false, product: { published: true } });
  });
  it("adds a rating to each product, or null when it has none, without querying for an empty list", async () => {
    expect(await attachRatings([])).toEqual([]);
    expect(h.groupBy).not.toHaveBeenCalled();
    h.groupBy.mockResolvedValue([{ productId: "a", _avg: { rating: 4.26 }, _count: { rating: 5 } }]);
    const out = await attachRatings([{ id: "a" }, { id: "b" }]);
    expect(out).toEqual([{ id: "a", rating: { avg: 4.3, count: 5 } }, { id: "b", rating: null }]);
    expect(h.groupBy.mock.calls[0][0].where).toMatchObject({ hidden: false, productId: { in: ["a", "b"] } });
  });
  it("calls a buyer verified only for a paid order that wasn't cancelled", async () => {
    h.count.mockResolvedValue(1);
    expect(await isVerifiedBuyer("u1", "p1")).toBe(true);
    expect(h.count.mock.calls[0][0].where).toEqual({ variant: { productId: "p1" }, order: { userId: "u1", status: { not: "CANCELLED" }, payments: { some: { status: "SUCCESS" } } } });
    h.count.mockResolvedValue(0);
    expect(await isVerifiedBuyer("u1", "p1")).toBe(false);
  });
});

describe("reviewSchema", () => {
  const ok = { productId: "p1", rating: "5", title: " Great ", body: "  Lovely fit and soft fabric.  " };
  it("accepts a good review and trims text", () => {
    const r = reviewSchema.safeParse(ok);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toMatchObject({ rating: 5, title: "Great", body: "Lovely fit and soft fabric." });
  });
  it.each([[null], [""], ["0"], ["6"], ["2.5"], ["abc"]])("rejects the rating %j with a clear message", (rating) => {
    const r = reviewSchema.safeParse({ ...ok, rating });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Choose a star rating");
  });
  it("needs a real review text and a short title", () => {
    expect(reviewSchema.safeParse({ ...ok, body: "short" }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...ok, body: "x".repeat(1501) }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...ok, title: "t".repeat(81) }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...ok, title: "" }).success).toBe(true);
  });
});
