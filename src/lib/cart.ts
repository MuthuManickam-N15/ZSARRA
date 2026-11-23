import "server-only";
import { db } from "./db";

export const MAX_PER_LINE = 10;

export async function getCart(userId: string) {
  const rows = await db.cartItem.findMany({
    where: { userId },
    orderBy: { id: "asc" },
    include: { variant: { include: { product: { include: { images: { orderBy: { position: "asc" }, take: 1 } } } } } },
  });

  const lines = rows.map((r) => {
    const { variant: v } = r;
    const p = v.product;
    const unitPrice = p.salePrice ?? p.price; // display only; checkout recomputes on the server
    const issue =
      !p.published ? "No longer available" :
      v.stock <= 0 ? "Out of stock" :
      r.quantity > v.stock ? `Only ${v.stock} left` : null;
    return {
      id: r.id, quantity: r.quantity, unitPrice, issue,
      maxQty: Math.min(v.stock, MAX_PER_LINE),
      name: p.name, slug: p.slug, size: v.size, color: v.color,
      image: p.images[0]?.url ?? null,
      lineTotal: issue ? 0 : unitPrice * r.quantity,
    };
  });

  return {
    lines,
    subtotal: lines.reduce((n, l) => n + l.lineTotal, 0),
    count: lines.reduce((n, l) => n + l.quantity, 0),
    hasIssues: lines.some((l) => l.issue),
  };
}

export async function getCartCount(userId: string) {
  const r = await db.cartItem.aggregate({ where: { userId }, _sum: { quantity: true } });
  return r._sum.quantity ?? 0;
}
