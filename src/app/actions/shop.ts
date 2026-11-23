"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { MAX_PER_LINE } from "@/lib/cart";
import { getCurrentUser, safeNext } from "@/lib/session";
import type { FormState } from "./auth";

const loginUrl = (next: string) => `/login?next=${encodeURIComponent(safeNext(next))}`;

export async function addToCart(_: FormState, form: FormData): Promise<FormState> {
  const next = String(form.get("next") ?? "/");
  const user = await getCurrentUser();
  if (!user) redirect(loginUrl(next));

  const parsed = z.object({ variantId: z.string().min(1), quantity: z.coerce.number().int().min(1).max(MAX_PER_LINE) })
    .safeParse({ variantId: form.get("variantId"), quantity: form.get("quantity") ?? 1 });
  if (!parsed.success) return { error: "Choose a size first" };
  const { variantId, quantity } = parsed.data;

  const variant = await db.variant.findUnique({ where: { id: variantId }, include: { product: { select: { published: true } } } });
  if (!variant || !variant.product.published) return { error: "This item is no longer available" };
  if (variant.stock <= 0) return { error: "This size is out of stock" };

  const existing = await db.cartItem.findUnique({ where: { userId_variantId: { userId: user.id, variantId } } });
  const total = (existing?.quantity ?? 0) + quantity;
  if (total > variant.stock || total > MAX_PER_LINE) {
    const cap = Math.min(variant.stock, MAX_PER_LINE);
    return { error: existing ? `You already have ${existing.quantity} in your cart. The most you can buy is ${cap}.` : `Only ${cap} available` };
  }
  await db.cartItem.upsert({
    where: { userId_variantId: { userId: user.id, variantId } },
    update: { quantity: total },
    create: { userId: user.id, variantId, quantity },
  });
  revalidatePath("/", "layout");
  return { ok: "Added to your cart" };
}

export async function updateCartQuantity(id: string, form: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect(loginUrl("/cart"));
  const q = Math.floor(Number(form.get("quantity")));
  if (!id || !Number.isFinite(q)) return;

  const item = await db.cartItem.findFirst({ where: { id, userId: user.id }, include: { variant: true } });
  if (!item) return;
  const cap = Math.max(0, Math.min(item.variant.stock, MAX_PER_LINE));
  if (q <= 0) await db.cartItem.delete({ where: { id: item.id } });
  else if (cap > 0) await db.cartItem.update({ where: { id: item.id }, data: { quantity: Math.min(q, cap) } });
  revalidatePath("/cart");
  revalidatePath("/", "layout");
}

/** Removes exactly one cart line. The id is bound on the server per button, not read from form fields. */
export async function removeFromCart(id: string) {
  const user = await getCurrentUser();
  if (!user) redirect(loginUrl("/cart"));
  if (!id) return;
  const item = await db.cartItem.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (item) await db.cartItem.delete({ where: { id: item.id } });
  revalidatePath("/cart");
  revalidatePath("/", "layout");
}

export async function toggleWishlist(form: FormData) {
  const next = String(form.get("next") ?? "/wishlist");
  const user = await getCurrentUser();
  if (!user) redirect(loginUrl(next));
  const productId = String(form.get("productId") ?? "");
  const key = { userId_productId: { userId: user.id, productId } };
  if (await db.wishlistItem.findUnique({ where: key })) {
    await db.wishlistItem.delete({ where: key });
  } else if (await db.product.findFirst({ where: { id: productId, published: true } })) {
    await db.wishlistItem.create({ data: { userId: user.id, productId } });
  }
  revalidatePath(safeNext(next));
  revalidatePath("/wishlist");
}
