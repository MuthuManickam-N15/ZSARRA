import type { Metadata } from "next";
import Link from "next/link";
import { toggleWishlist } from "@/app/actions/shop";
import ProductCard from "@/components/ProductCard";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { attachRatings } from "@/lib/reviews";

export const metadata: Metadata = { title: "Wishlist" };
export const dynamic = "force-dynamic";

export default async function Wishlist() {
  const user = await requireUser("/wishlist");
  const items = await db.wishlistItem.findMany({
    where: { userId: user.id, product: { published: true } },
    include: { product: { include: { images: { orderBy: { position: "asc" }, take: 1 }, variants: { select: { stock: true, size: true } } } } },
  });

  const rated = await attachRatings(items.map((i) => i.product));
  const ratingOf = new Map(rated.map((p) => [p.id, p.rating]));
  return (
    <div className="container-page py-12">
      <h1 className="text-2xl font-bold md:text-3xl">Wishlist</h1>
      {items.length === 0 ? (
        <div className="mt-8 border border-ink/20 bg-paper p-12 text-center">
          <p>You haven't saved anything yet. Use “Save to wishlist” on a product page.</p>
          <Link href="/new-arrivals" className="btn-primary mt-4">Browse new arrivals</Link>
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
          {items.map(({ product }) => (
            <li key={product.id}>
              <ProductCard product={{ ...product, rating: ratingOf.get(product.id) ?? null }} />
              <form action={toggleWishlist} className="mt-2">
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="next" value="/wishlist" />
                <button className="text-sm underline hover:text-bronze">Remove</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
