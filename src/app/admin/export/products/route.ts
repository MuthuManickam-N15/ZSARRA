import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { HEADERS } from "@/lib/import-parse";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Every product as a CSV in exactly the format the Bulk import page reads, so it doubles as a catalogue backup. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new Response("Not found", { status: 404 });

  const products = await db.product.findMany({
    orderBy: { createdAt: "asc" },
    include: { category: true, variants: { orderBy: [{ color: "asc" }, { size: "asc" }] }, images: { orderBy: { position: "asc" } } },
  });
  const money = (paise: number) => String(paise / 100);
  const rows = products.map((p) => [
    p.sku, p.name, p.description, p.gender.toLowerCase(), p.category.name, money(p.price), p.salePrice ? money(p.salePrice) : "",
    Array.from(new Set(p.variants.map((v) => v.size))).join("|"),
    Array.from(new Map(p.variants.map((v) => [v.color, `${v.color}:${v.colorHex}`])).values()).join("|"),
    p.variants.map((v) => `${v.size}/${v.color}:${v.stock}`).join("|"),
    p.published ? "yes" : "no", p.featured ? "yes" : "no",
    p.images.map((i) => i.url).join("|"),
  ]);
  const body = "\uFEFF" + toCsv([HEADERS, ...rows]);
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="zsarra-products-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
