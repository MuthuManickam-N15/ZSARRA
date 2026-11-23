"use server";
import { revalidatePath } from "next/cache";
import { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { isOwnImageUrl, saveImage, UploadError } from "@/lib/upload";
import { ORDER_TRANSITIONS as NEXT } from "@/lib/orders";
import { bannerSchema, firstError, settingsSchema } from "@/lib/validation";
import type { FormState } from "./auth";

const refresh = () => revalidatePath("/", "layout");

export async function setCustomerActive(form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const active = form.get("active") === "1";
  if (id === admin.id) return;
  // Only customer accounts can be switched here, never other admins.
  await db.user.updateMany({ where: { id, role: "CUSTOMER" }, data: { active } });
  if (!active) await db.session.deleteMany({ where: { userId: id } });
  refresh();
}


export async function updateOrderStatus(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const target = String(form.get("status") ?? "") as OrderStatus;
  const tracking = String(form.get("trackingNumber") ?? "").trim().slice(0, 60);

  const order = await db.order.findUnique({ where: { id }, include: { items: true, payments: true } });
  if (!order) return { error: "Order not found" };

  if (target === order.status) {
    if (order.status === "SHIPPED" && tracking) {
      await db.order.update({ where: { id }, data: { trackingNumber: tracking } });
      refresh();
      return { ok: "Tracking number saved" };
    }
    return { error: "Choose a new status" };
  }
  if (!NEXT[order.status].includes(target)) return { error: `An order that is ${order.status.toLowerCase()} can't move to ${target.toLowerCase()}` };
  if (target !== "CANCELLED" && !order.payments.some((p) => p.status === "SUCCESS")) {
    return { error: "This order has no verified payment yet, so it can't be confirmed or shipped" };
  }
  if (target === "SHIPPED" && !(tracking || order.trackingNumber)) return { error: "Enter a tracking number before marking as shipped" };

  const done = await db.$transaction(async (tx) => {
    // Compare-and-set: fails if another admin changed the status in the meantime.
    const r = await tx.order.updateMany({ where: { id, status: order.status }, data: { status: target, ...(tracking ? { trackingNumber: tracking } : {}) } });
    if (r.count === 0) return false;
    if (target === "CANCELLED") {
      // Stock is reserved when an order is placed (stage 6), so cancelling returns it.
      for (const it of order.items) await tx.variant.update({ where: { id: it.variantId }, data: { stock: { increment: it.quantity } } });
    }
    return true;
  });
  if (!done) return { error: "This order was just changed by someone else. Reload and try again." };
  refresh();
  const paid = order.payments.some((p) => p.status === "SUCCESS");
  return { ok: target === "CANCELLED" && paid ? "Order cancelled and stock returned. This order was paid, so a refund is still needed." : "Status updated" };
}

export async function saveSettings(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  const values: Record<string, string> = {
    storeName: d.storeName, storeEmail: d.storeEmail,
    shippingCharge: String(Math.round(d.shippingCharge * 100)),
    freeShippingThreshold: String(Math.round(d.freeShippingThreshold * 100)),
    taxPercent: String(d.taxPercent),
    upiId: d.upiId, upiName: d.upiName,
    paymentsEnabled: form.get("paymentsEnabled") === "on" ? "1" : "0",
  };
  await db.$transaction(Object.entries(values).map(([key, value]) => db.setting.upsert({ where: { key }, update: { value }, create: { key, value } })));
  refresh();
  return { ok: "Settings saved" };
}

export async function createBanner(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = bannerSchema.safeParse({ title: form.get("title"), subtitle: form.get("subtitle") || undefined, href: form.get("href") ?? "" });
  if (!parsed.success) return { error: firstError(parsed.error) };
  if ((await db.banner.count()) >= 12) return { error: "Delete an old banner before adding more" };
  const direct = String(form.get("imageUrl") ?? "");
  let imageUrl: string;
  if (direct) {
    if (!isOwnImageUrl(direct)) return { error: "The uploaded picture has an invalid link. Please try again." };
    imageUrl = direct;
  } else {
    const file = form.get("image");
    if (!(file instanceof File) || file.size === 0) return { error: "Choose a banner image" };
    try { imageUrl = await saveImage(file); } catch (e) { return { error: e instanceof UploadError ? e.message : "Image upload failed" }; }
  }
  try {
    const last = await db.banner.aggregate({ _max: { position: true } });
    await db.banner.create({ data: { title: parsed.data.title, subtitle: parsed.data.subtitle ?? "", href: parsed.data.href || "/", imageUrl, position: (last._max.position ?? -1) + 1 } });
  } catch (e) {
    console.error("createBanner failed", e);
    return { error: "The banner couldn't be saved. Check the terminal running the site for details." };
  }
  refresh();
  return { ok: "Banner added. It's listed above and appears on the home page." };
}

export async function toggleBanner(form: FormData) {
  await requireAdmin();
  await db.banner.update({ where: { id: String(form.get("id")) }, data: { active: form.get("active") === "1" } });
  refresh();
}

export async function deleteBanner(form: FormData) {
  await requireAdmin();
  await db.banner.deleteMany({ where: { id: String(form.get("id")) } });
  refresh();
}

/** Saves a new payment QR picture. It replaces the default file (public/payment/upi-qr.png) for customers without a redeploy. */
export async function saveQrImage(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const direct = String(form.get("imageUrl") ?? "");
  let url: string;
  if (direct) {
    if (!isOwnImageUrl(direct)) return { error: "The uploaded picture has an invalid link. Please try again." };
    url = direct;
  } else {
    const file = form.get("image");
    if (!(file instanceof File) || file.size === 0) return { error: "Choose your QR code image" };
    try { url = await saveImage(file); } catch (e) { return { error: e instanceof UploadError ? e.message : "Image upload failed" }; }
  }
  await db.setting.upsert({ where: { key: "qrImageUrl" }, update: { value: url }, create: { key: "qrImageUrl", value: url } });
  refresh();
  return { ok: "QR code updated. Customers now see this one." };
}

export async function resetQrImage() {
  await requireAdmin();
  await db.setting.deleteMany({ where: { key: "qrImageUrl" } });
  refresh();
}
