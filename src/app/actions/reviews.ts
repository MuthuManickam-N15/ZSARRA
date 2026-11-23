"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { allow } from "@/lib/rate-limit";
import { isVerifiedBuyer } from "@/lib/reviews";
import { getCurrentUser, requireAdmin } from "@/lib/session";
import { firstError, reviewSchema } from "@/lib/validation";
import type { FormState } from "./auth";

const refresh = () => revalidatePath("/", "layout");

/** One review per customer per product: submitting again edits it. */
export async function submitReview(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in to write a review." };
  if (!allow(`review:${user.id}`, 10, 3_600_000)) return { error: "You've sent a lot of reviews. Please try again later." };

  const parsed = reviewSchema.safeParse({ productId: form.get("productId"), rating: form.get("rating"), title: form.get("title") ?? "", body: form.get("body") });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { productId, rating, title, body } = parsed.data;

  if (!(await db.product.findFirst({ where: { id: productId, published: true }, select: { id: true } }))) return { error: "This product isn't available for reviews." };
  const verified = await isVerifiedBuyer(user.id, productId);
  const key = { productId_userId: { productId, userId: user.id } };
  const existing = await db.review.findUnique({ where: key, select: { id: true } });
  await db.review.upsert({
    where: key,
    update: { rating, title: title ?? "", body, verified }, // a review an admin hid stays hidden
    create: { productId, userId: user.id, rating, title: title ?? "", body, verified },
  });
  refresh();
  return { ok: existing ? "Your review was updated." : "Thanks! Your review is published." };
}

export async function deleteMyReview(form: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  await db.review.deleteMany({ where: { id: String(form.get("id") ?? ""), userId: user.id } }); // userId in the filter: only your own
  refresh();
}

export async function setReviewHidden(form: FormData) {
  await requireAdmin();
  await db.review.update({ where: { id: String(form.get("id") ?? "") }, data: { hidden: form.get("hide") === "1" } });
  refresh();
}

export async function deleteReview(form: FormData) {
  await requireAdmin();
  await db.review.deleteMany({ where: { id: String(form.get("id") ?? "") } });
  refresh();
}
