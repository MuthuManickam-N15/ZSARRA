import "server-only";
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { MAX_PER_LINE } from "./cart";
import { getSettings, priceOrder } from "./settings";
import { reserveStock } from "./payments";

export class CheckoutError extends Error {}

export type Ship = { fullName: string; phone: string; line1: string; line2?: string | null; city: string; state: string; pincode: string };

const orderNumber = () => `ZR${new Date().toISOString().slice(2, 10).replace(/-/g, "")}${crypto.randomInt(10000, 99999)}`;
const isUnique = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

/** Prices, shipping and tax are all recalculated here from the database. Nothing from the browser is trusted. */
export async function createOrderFromCart(userId: string, ship: Ship, key: string) {
  const existing = await db.order.findUnique({ where: { idempotencyKey: key } });
  if (existing) {
    if (existing.userId !== userId) throw new CheckoutError("Please reload the checkout page");
    return existing;
  }
  const settings = await getSettings();

  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const cart = await tx.cartItem.findMany({ where: { userId }, include: { variant: { include: { product: true } } } });
        if (cart.length === 0) throw new CheckoutError("Your cart is empty");

        let subtotal = 0;
        const items = cart.map((c) => {
          const v = c.variant, p = v.product;
          if (!p.published) throw new CheckoutError(`${p.name} is no longer available`);
          if (c.quantity > MAX_PER_LINE || v.stock < c.quantity) throw new CheckoutError(`${p.name} (${v.size}) doesn't have enough stock`);
          const unitPrice = p.salePrice ?? p.price;
          subtotal += unitPrice * c.quantity;
          return { variantId: v.id, name: p.name, size: v.size, color: v.color, unitPrice, quantity: c.quantity };
        });

        try { await reserveStock(tx, items); } catch { throw new CheckoutError("Some items just sold out. Please review your cart."); }

        const order = await tx.order.create({
          data: {
            number: orderNumber(), userId, ...priceOrder(subtotal, settings), idempotencyKey: key,
            shipName: ship.fullName, shipPhone: ship.phone, shipLine1: ship.line1, shipLine2: ship.line2 || null,
            shipCity: ship.city, shipState: ship.state, shipPincode: ship.pincode,
            items: { create: items },
          },
        });
        await tx.cartItem.deleteMany({ where: { userId } });
        return order;
      });
    } catch (e) {
      if (isUnique(e)) { // double-click race on the idempotency key, or a rare order-number clash
        const dup = await db.order.findUnique({ where: { idempotencyKey: key } });
        if (dup && dup.userId === userId) return dup;
        if (attempt < 3) continue;
      }
      throw e;
    }
  }
}

/** Creates the payment record for a QR (UPI) order, or returns the one that already exists. The amount comes from our own order row. */
export async function ensureQrPayment(orderId: string, userId: string) {
  const order = await db.order.findFirst({ where: { id: orderId, userId }, select: { id: true, number: true, total: true } });
  if (!order) throw new CheckoutError("Order not found");
  const gatewayOrderId = `qr_${order.number}`;
  return db.payment.upsert({ where: { gatewayOrderId }, update: {}, create: { orderId: order.id, gateway: "upi_qr", gatewayOrderId, amount: order.total } });
}
