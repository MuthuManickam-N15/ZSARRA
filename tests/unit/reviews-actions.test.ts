import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  user: vi.fn(), admin: vi.fn(), product: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn(), update: vi.fn(), verified: vi.fn(), revalidate: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { product: { findFirst: m.product }, review: { findUnique: m.findUnique, upsert: m.upsert, deleteMany: m.deleteMany, update: m.update } } }));
vi.mock("@/lib/session", () => ({ getCurrentUser: m.user, requireAdmin: m.admin }));
vi.mock("@/lib/reviews", () => ({ isVerifiedBuyer: m.verified }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));

import { deleteMyReview, deleteReview, setReviewHidden, submitReview } from "@/app/actions/reviews";

const form = (o: Record<string, string>) => { const f = new FormData(); Object.entries(o).forEach(([k, v]) => f.set(k, v)); return f; };
const good = { productId: "p1", rating: "5", title: "Lovely", body: "Great fit and soft fabric." };
let n = 0;
const signIn = () => m.user.mockResolvedValue({ id: `user-${++n}` }); // a fresh id each test, so the rate limiter never interferes

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.product.mockResolvedValue({ id: "p1" }); m.findUnique.mockResolvedValue(null); m.verified.mockResolvedValue(false);
  m.admin.mockResolvedValue({ id: "admin" });
});

describe("submitReview", () => {
  it("asks anonymous visitors to log in and touches nothing", async () => {
    m.user.mockResolvedValue(null);
    expect(await submitReview(undefined, form(good))).toEqual({ error: "Please log in to write a review." });
    expect(m.upsert).not.toHaveBeenCalled();
  });
  it("rejects a missing rating or a too-short review", async () => {
    signIn();
    expect((await submitReview(undefined, form({ ...good, rating: "" })))?.error).toBe("Choose a star rating");
    expect((await submitReview(undefined, form({ ...good, body: "meh" })))?.error).toMatch(/at least 10/);
    expect(m.upsert).not.toHaveBeenCalled();
  });
  it("won't review a product that isn't published", async () => {
    signIn(); m.product.mockResolvedValue(null);
    expect((await submitReview(undefined, form(good)))?.error).toMatch(/isn't available/);
    expect(m.upsert).not.toHaveBeenCalled();
  });
  it("publishes a new review and marks buyers as verified", async () => {
    signIn(); m.verified.mockResolvedValue(true);
    expect(await submitReview(undefined, form(good))).toEqual({ ok: "Thanks! Your review is published." });
    const arg = m.upsert.mock.calls[0][0];
    expect(arg.create).toMatchObject({ productId: "p1", rating: 5, title: "Lovely", verified: true });
    expect(arg.create.userId).toMatch(/^user-/);
    expect(m.revalidate).toHaveBeenCalled();
  });
  it("editing updates the same review and never un-hides one an admin hid", async () => {
    signIn(); m.findUnique.mockResolvedValue({ id: "r1" });
    expect(await submitReview(undefined, form({ ...good, rating: "3" }))).toEqual({ ok: "Your review was updated." });
    const arg = m.upsert.mock.calls[0][0];
    expect(arg.update).toMatchObject({ rating: 3 });
    expect(arg.update).not.toHaveProperty("hidden");
    expect(arg.where.productId_userId.productId).toBe("p1");
  });
  it("limits how many reviews one person can send per hour", async () => {
    signIn();
    for (let i = 0; i < 10; i++) expect((await submitReview(undefined, form(good)))?.ok).toBeTruthy();
    expect((await submitReview(undefined, form(good)))?.error).toMatch(/a lot of reviews/);
  });
});

describe("deleting and moderating", () => {
  it("a customer can only delete their own review", async () => {
    m.user.mockResolvedValue(null);
    await deleteMyReview(form({ id: "r1" }));
    expect(m.deleteMany).not.toHaveBeenCalled();
    m.user.mockResolvedValue({ id: "u9" });
    await deleteMyReview(form({ id: "r1" }));
    expect(m.deleteMany).toHaveBeenCalledWith({ where: { id: "r1", userId: "u9" } });
  });
  it("hiding and deleting need an admin", async () => {
    m.admin.mockRejectedValue(new Error("REDIRECT:/admin/login"));
    await expect(setReviewHidden(form({ id: "r1", hide: "1" }))).rejects.toThrow("REDIRECT");
    await expect(deleteReview(form({ id: "r1" }))).rejects.toThrow("REDIRECT");
    expect(m.update).not.toHaveBeenCalled();
    expect(m.deleteMany).not.toHaveBeenCalled();
  });
  it("an admin can hide, show and delete", async () => {
    await setReviewHidden(form({ id: "r1", hide: "1" }));
    await setReviewHidden(form({ id: "r1", hide: "0" }));
    expect(m.update.mock.calls.map((c) => c[0].data.hidden)).toEqual([true, false]);
    await deleteReview(form({ id: "r1" }));
    expect(m.deleteMany).toHaveBeenCalledWith({ where: { id: "r1" } });
  });
});
