import { z } from "zod";

const phone = z.string().trim().regex(/^[0-9+\-\s]{10,15}$/, "Enter a valid phone number");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(120),
  phone: phone.optional().or(z.literal("").transform(() => undefined)),
  password: z.string().min(8, "Password needs at least 8 characters").max(72, "Password is too long")
    .regex(/[A-Za-z]/, "Password needs a letter").regex(/[0-9]/, "Password needs a number"),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(72),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  phone: phone.optional().or(z.literal("").transform(() => undefined)),
});

export const addressSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the recipient's name").max(80),
  phone,
  line1: z.string().trim().min(3, "Enter the street address").max(120),
  line2: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2, "Enter the city").max(60),
  state: z.string().trim().min(2, "Enter the state").max(60),
  pincode: z.string().trim().regex(/^\d{6}$/, "Pincode must be 6 digits"),
});

export const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "Check the form and try again";

// ---------- Admin ----------
const rupees = z.coerce.number().positive("Enter a price above 0").max(10_000_000);

export const variantSchema = z.object({
  size: z.string().trim().min(1, "Every variant needs a size").max(20),
  color: z.string().trim().min(1, "Every variant needs a color").max(30),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color swatch must look like #1A2B3C"),
  stock: z.coerce.number().int("Stock must be a whole number").min(0, "Stock can't be negative").max(100000),
});

export const productSchema = z.object({
  name: z.string().trim().min(2, "Enter a product name").max(120),
  sku: z.string().trim().min(2, "Enter a SKU").max(40),
  description: z.string().trim().min(10, "Write a description of at least 10 characters").max(5000),
  gender: z.enum(["MEN", "WOMEN", "UNISEX"]),
  categoryId: z.string().min(1, "Choose a category"),
  price: rupees,
  salePrice: z.preprocess((v) => (v === "" || v == null ? undefined : v), rupees.optional()),
  published: z.boolean(),
  featured: z.boolean(),
  variants: z.array(variantSchema).min(1, "Add at least one size and color").max(60),
}).refine((d) => d.salePrice === undefined || d.salePrice < d.price, { message: "Sale price must be lower than the price", path: ["salePrice"] })
  .refine((d) => new Set(d.variants.map((v) => `${v.size.toLowerCase()}|${v.color.toLowerCase()}`)).size === d.variants.length, { message: "Two variants have the same size and color", path: ["variants"] });

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Enter a category name").max(60),
  gender: z.enum(["MEN", "WOMEN", "UNISEX"]),
});

export const settingsSchema = z.object({
  storeName: z.string().trim().min(1, "Enter the store name").max(60),
  storeEmail: z.string().trim().email("Enter a valid contact email"),
  shippingCharge: z.coerce.number().min(0, "Shipping can't be negative").max(100000),
  freeShippingThreshold: z.coerce.number().min(0).max(10_000_000),
  taxPercent: z.coerce.number().min(0, "Tax can't be negative").max(40, "Tax can't be above 40%"),
  upiId: z.string().trim().regex(/^[a-zA-Z0-9._-]{2,64}@[a-zA-Z0-9.-]{2,32}$/, "Enter a UPI ID like name@bank"),
  upiName: z.string().trim().min(1, "Enter the name shown on your UPI account").max(60),
});

export const bannerSchema = z.object({
  title: z.string().trim().min(2, "Enter a banner title").max(60),
  subtitle: z.string().trim().max(100).optional(),
  href: z.string().trim().refine((v) => v === "" || (v.startsWith("/") && !v.startsWith("//") && !v.includes("\\")), "Link must be a page on this site, like /sale"),
});

export const reviewSchema = z.object({
  productId: z.string().min(1),
  rating: z.coerce.number().int("Choose a star rating").min(1, "Choose a star rating").max(5, "Choose a star rating"),
  title: z.string().trim().max(80, "Keep the title under 80 characters").optional(),
  body: z.string().trim().min(10, "Write at least 10 characters").max(1500, "Keep your review under 1,500 characters"),
});
