import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";

class ReserveError extends Error {}
type Item = { variantId: string; quantity: number };

/** Atomically takes stock; throws (rolling back the whole transaction) if any line is short. */
export async function reserveStock(tx: Prisma.TransactionClient, items: Item[]) {
  for (const it of items) {
    const r = await tx.variant.updateMany({ where: { id: it.variantId, stock: { gte: it.quantity } }, data: { stock: { decrement: it.quantity } } });
    if (r.count === 0) throw new ReserveError();
  }
}
export async function releaseStock(tx: Prisma.TransactionClient, items: Item[]) {
  for (const it of items) await tx.variant.update({ where: { id: it.variantId }, data: { stock: { increment: it.quantity } } });
}

export type Paid = { gatewayOrderId: string; gatewayPaymentId: string; amount: number };

async function apply(p: Paid, reserve: boolean) {
  return db.$transaction(async (tx) => {
    const pay = await tx.payment.findUnique({ where: { gatewayOrderId: p.gatewayOrderId }, include: { order: { include: { items: true } } } });
    if (!pay) return "unknown" as const;
    if (pay.amount !== p.amount) return "mismatch" as const; // never accept a different amount than we asked for
    // Compare-and-set makes this safe to run twice (a double click or a repeated request can't confirm it twice).
    const r = await tx.payment.updateMany({ where: { id: pay.id, status: { in: ["PENDING", "FAILED"] } }, data: { status: "SUCCESS", gatewayPaymentId: p.gatewayPaymentId } });
    if (r.count === 0) return "already" as const;
    if (pay.order.status === "PENDING") {
      await tx.order.updateMany({ where: { id: pay.orderId, status: "PENDING" }, data: { status: "CONFIRMED" } });
      return "paid" as const;
    }
    if (pay.order.status === "CANCELLED" && reserve) { // order expired before the money arrived: try to take the stock back
      await reserveStock(tx, pay.order.items);
      await tx.order.update({ where: { id: pay.orderId }, data: { status: "CONFIRMED" } });
      return "paid" as const;
    }
    return "paid-but-cancelled" as const; // admin sees a paid + cancelled order and refunds it
  });
}

export async function markPaymentSuccess(p: Paid) {
  try { return await apply(p, true); }
  catch (e) { if (e instanceof ReserveError) return apply(p, false); throw e; }
}

export async function markPaymentFailed(gatewayOrderId: string) {
  await db.payment.updateMany({ where: { gatewayOrderId, status: "PENDING" }, data: { status: "FAILED" } });
}

export async function markRefunded(gatewayPaymentId: string) {
  await db.payment.updateMany({ where: { gatewayPaymentId, status: "SUCCESS" }, data: { status: "REFUNDED" } });
}

/** Orders with no payment details hold stock for 1 hour, then are cancelled and the stock is returned.
 *  Once a customer has sent a payment reference the order waits for an admin to verify it and is never auto-cancelled. */
export async function expireStaleOrders(minutes = 60) {
  const cutoff = new Date(Date.now() - minutes * 60_000);
  const stale = await db.order.findMany({ where: { status: "PENDING", createdAt: { lt: cutoff }, payments: { none: { OR: [{ status: "SUCCESS" }, { gatewayPaymentId: { not: null } }] } } }, include: { items: true }, take: 50 });
  let n = 0;
  for (const o of stale) {
    await db.$transaction(async (tx) => {
      const r = await tx.order.updateMany({ where: { id: o.id, status: "PENDING" }, data: { status: "CANCELLED" } });
      if (r.count === 1) { await releaseStock(tx, o.items); n++; }
    });
  }
  return n;
}
