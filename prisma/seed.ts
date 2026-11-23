import { PrismaClient, Gender } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) {
    throw new Error("Set ADMIN_EMAIL and an ADMIN_PASSWORD of 12+ characters in .env");
  }
  await db.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Store Admin", role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) },
  });

  const cats = [
    { name: "Shirts", slug: "men-shirts", gender: Gender.MEN },
    { name: "Trousers", slug: "men-trousers", gender: Gender.MEN },
    { name: "Dresses", slug: "women-dresses", gender: Gender.WOMEN },
    { name: "Tops", slug: "women-tops", gender: Gender.WOMEN },
    { name: "Hoodies", slug: "men-hoodies", gender: Gender.MEN },
    { name: "Jeans", slug: "men-jeans", gender: Gender.MEN },
    { name: "Kurtis", slug: "women-kurtis", gender: Gender.WOMEN },
    { name: "Leggings", slug: "women-leggings", gender: Gender.WOMEN },
  ];
  for (const c of cats) await db.category.upsert({ where: { slug: c.slug }, update: {}, create: c });

  const sample = [
    { slug: "linen-overshirt", sku: "ZM-001", name: "Linen overshirt", cat: "men-shirts", gender: Gender.MEN, price: 349900, sale: undefined as number | undefined },
    { slug: "tailored-trousers", sku: "ZM-002", name: "Tailored trousers", cat: "men-trousers", gender: Gender.MEN, price: 299900, sale: 249900 },
    { slug: "satin-midi-dress", sku: "ZW-001", name: "Satin midi dress", cat: "women-dresses", gender: Gender.WOMEN, price: 449900, sale: undefined },
    { slug: "ribbed-knit-top", sku: "ZW-002", name: "Ribbed knit top", cat: "women-tops", gender: Gender.WOMEN, price: 149900, sale: undefined },
  ];
  for (const s of sample) {
    const category = await db.category.findUniqueOrThrow({ where: { slug: s.cat } });
    await db.product.upsert({
      where: { slug: s.slug },
      update: {},
      create: {
        slug: s.slug, sku: s.sku, name: s.name, gender: s.gender, categoryId: category.id,
        description: "Sample description. Replace it from the admin dashboard.",
        price: s.price, salePrice: s.sale ?? null, published: true, featured: true,
        variants: { create: ["S", "M", "L"].map((size) => ({ size, color: "Black", colorHex: "#000000", stock: 10 })) },
      },
    });
  }
  // Products with real photos (files live in public/catalog and match the sample import files).
  // Men's prices sit between the older samples so the existing price-sort tests keep their order.
  const photos = [
    { slug: "pista-green-textured-shirt", sku: "ZM-201", name: "Pista green textured shirt", cat: "men-shirts", gender: Gender.MEN, price: 319900, sale: undefined as number | undefined,
      sizes: { S: 10, M: 10, L: 10, XL: 10 }, color: "Pista green", hex: "#B9D7A8", image: "/catalog/ZM-201.jpg",
      description: "Full-sleeve shirt in a textured weave with a button front and a spread collar. Roll the sleeves up for a relaxed look." },
    { slug: "classic-white-hoodie", sku: "ZM-202", name: "Classic white hoodie", cat: "men-hoodies", gender: Gender.MEN, price: 329900, sale: undefined,
      sizes: { S: 10, M: 10, L: 10, XL: 10, XXL: 10 }, color: "White", hex: "#FFFFFF", image: "/catalog/ZM-202.jpg",
      description: "Pullover hoodie with a drawstring hood, a front pocket and ribbed cuffs and hem." },
    { slug: "faded-blue-slim-jeans", sku: "ZM-203", name: "Faded blue slim jeans", cat: "men-jeans", gender: Gender.MEN, price: 339900, sale: undefined,
      sizes: { "28": 10, "30": 10, "32": 10, "34": 10, "36": 10 }, color: "Washed blue", hex: "#6E9BC9", image: "/catalog/ZM-203.jpg",
      description: "Slim-fit jeans in a faded blue wash with subtle floral detailing and classic five-pocket styling." },
    { slug: "embroidered-yellow-kurti", sku: "ZW-201", name: "Embroidered yellow kurti", cat: "women-kurtis", gender: Gender.WOMEN, price: 189900, sale: 149900,
      sizes: { S: 6, M: 10, L: 10, XL: 4 }, color: "Mustard", hex: "#E0A526", image: "/catalog/ZW-201.jpg",
      description: "Long-sleeve kurti with contrast embroidery at the neckline, cuffs and hem, and side slits for easy movement." },
    { slug: "high-waist-seamless-leggings", sku: "ZW-202", name: "High-waist seamless leggings", cat: "women-leggings", gender: Gender.WOMEN, price: 159900, sale: undefined,
      sizes: { XS: 10, S: 10, M: 10, L: 10, XL: 10 }, color: "Charcoal", hex: "#4A4A4E", image: "/catalog/ZW-202.jpg",
      description: "High-waist leggings with a smooth, stretchy fit and a wide waistband that stays put." },
  ];
  for (const x of photos) {
    const category = await db.category.findUniqueOrThrow({ where: { slug: x.cat } });
    const product = await db.product.upsert({
      where: { slug: x.slug },
      update: {},
      create: {
        slug: x.slug, sku: x.sku, name: x.name, gender: x.gender, categoryId: category.id, description: x.description,
        price: x.price, salePrice: x.sale ?? null, published: true, featured: true,
        variants: { create: Object.entries(x.sizes).map(([size, stock]) => ({ size, color: x.color, colorHex: x.hex, stock })) },
      },
    });
    if ((await db.productImage.count({ where: { productId: product.id } })) === 0) {
      await db.productImage.create({ data: { productId: product.id, url: x.image, alt: x.name, position: 0 } });
    }
  }
  console.log("Seeded admin, categories and sample products.");
}

main().finally(() => db.$disconnect());
