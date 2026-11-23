import crypto from "node:crypto";
import fs from "node:fs";
import bcrypt from "bcryptjs";
import { expect, type Page } from "@playwright/test";
import { OrderStatus, PrismaClient } from "@prisma/client";

export const db = new PrismaClient();
export const PASSWORD = "Testpass123";
export const ADMIN = { email: process.env.ADMIN_EMAIL ?? "", password: process.env.ADMIN_PASSWORD ?? "" };
export const CUSTOMER_STATE = "e2e/.auth/customer.json";
export const ADMIN_STATE = "e2e/.auth/admin.json";
export const LOGGED_OUT = { cookies: [], origins: [] };
// A real 1x1 PNG, used for upload tests.
export const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

export const uniqueEmail = (prefix: string) => `${prefix}+${Date.now()}${crypto.randomInt(1000)}@example.test`;
export const customerEmail = () => fs.readFileSync("e2e/.auth/customer-email.txt", "utf8").trim();
export const formatINR = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;
export const alertWith = (page: Page, text: string | RegExp) => page.getByRole("alert").filter({ hasText: text }); // Next adds its own empty role=alert element
export const statusWith = (page: Page, text: string | RegExp) => page.getByRole("status").filter({ hasText: text });

export async function addToCart(page: Page, slug: string, size: string) {
  await page.goto(`/products/${slug}`);
  await page.getByRole("button", { name: size, exact: true }).click();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(statusWith(page, "Added to your cart")).toBeVisible();
}

export async function emptyCart(page: Page) {
  await page.goto("/cart");
  const remove = page.getByRole("button", { name: /^Remove / });
  for (let i = 0; i < 20; i++) {
    const n = await remove.count();
    if (n === 0) break;
    await remove.first().click();
    await expect(remove).toHaveCount(n - 1);
  }
}

export const variantOf = (slug: string, size: string) => db.variant.findFirstOrThrow({ where: { size, product: { slug } } });

export async function createUser(prefix = "victim") {
  const email = uniqueEmail(prefix);
  const user = await db.user.create({ data: { email, name: "Victim Test", passwordHash: await bcrypt.hash(PASSWORD, 10) } });
  return { ...user, email, password: PASSWORD };
}

export async function createOrder(o: { userId: string; variantId: string; qty?: number; status?: OrderStatus; payment?: "SUCCESS" | "PENDING" | null; reference?: string }) {
  const v = await db.variant.findUniqueOrThrow({ where: { id: o.variantId }, include: { product: true } });
  const unit = v.product.salePrice ?? v.product.price, qty = o.qty ?? 1, tag = `${Date.now()}${crypto.randomInt(1000)}`;
  return db.order.create({
    data: {
      number: `E2E${tag}`, userId: o.userId, status: o.status ?? "PENDING", subtotal: unit * qty, shipping: 0, tax: 0, total: unit * qty,
      shipName: "E2E Buyer", shipPhone: "9876543210", shipLine1: "1 Test Street", shipCity: "Chennai", shipState: "Tamil Nadu", shipPincode: "600001",
      idempotencyKey: crypto.randomUUID(),
      items: { create: [{ variantId: v.id, name: v.product.name, size: v.size, color: v.color, unitPrice: unit, quantity: qty }] },
      ...(o.payment ? { payments: { create: { gateway: "upi_qr", gatewayOrderId: `qr_E2E${tag}`, amount: unit * qty, status: o.payment, gatewayPaymentId: o.reference ?? (o.payment === "SUCCESS" ? `PAYE2E${tag}` : null) } } } : {}),
    },
    include: { payments: true },
  });
}

export async function deleteOrders(ids: string[]) {
  await db.payment.deleteMany({ where: { orderId: { in: ids } } });
  await db.order.deleteMany({ where: { id: { in: ids } } });
}

/** Mirrors the store's shipping/tax rule, reading the same Setting rows. */
export async function expectedTotals(subtotal: number) {
  const rows = Object.fromEntries((await db.setting.findMany()).map((r) => [r.key, Number(r.value)]));
  const charge = rows.shippingCharge ?? 9900, threshold = rows.freeShippingThreshold ?? 199900, pct = rows.taxPercent ?? 0;
  const shipping = threshold > 0 && subtotal >= threshold ? 0 : charge, tax = Math.round((subtotal * pct) / 100);
  return { shipping, tax, total: subtotal + shipping + tax };
}


/** Opens a page, retrying if the dev server interrupts the navigation (it can reload a page while it compiles another one). */
export async function visit(page: Page, path: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      await page.goto(path, { timeout: 120_000, waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
      return;
    } catch (e) {
      if (attempt >= 3) throw e;
      await page.waitForTimeout(1500);
    }
  }
}
