import { describe, expect, it } from "vitest";
import { addressSchema, bannerSchema, loginSchema, productSchema, registerSchema, settingsSchema } from "@/lib/validation";

const reg = { name: "Asha Rao", email: " ASHA@Example.com ", password: "abcdefg1", confirm: "abcdefg1" };
const msgs = (r: { success: boolean; error?: { issues: { message: string }[] } }) => (r.success ? [] : r.error!.issues.map((i) => i.message));

describe("registerSchema", () => {
  it("accepts valid input and normalises the email", () => {
    const r = registerSchema.safeParse(reg);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("asha@example.com");
  });
  it("treats an empty phone as not provided", () => {
    const r = registerSchema.safeParse({ ...reg, phone: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBeUndefined();
  });
  it.each([
    ["too short", { password: "abc1", confirm: "abc1" }, "at least 8"],
    ["no number", { password: "abcdefgh", confirm: "abcdefgh" }, "needs a number"],
    ["no letter", { password: "12345678", confirm: "12345678" }, "needs a letter"],
    ["too long for bcrypt", { password: "a1" + "x".repeat(71), confirm: "a1" + "x".repeat(71) }, "too long"],
    ["mismatch", { confirm: "different1" }, "don't match"],
    ["bad email", { email: "not-an-email" }, "valid email"],
    ["bad phone", { phone: "abc" }, "valid phone"],
  ])("rejects %s", (_n, patch, text) => {
    expect(msgs(registerSchema.safeParse({ ...reg, ...patch })).join(" ")).toContain(text);
  });
});

describe("loginSchema", () => {
  it("requires an email and a password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });
});

describe("addressSchema", () => {
  const a = { fullName: "Asha Rao", phone: "9876543210", line1: "12 Main Road", city: "Chennai", state: "Tamil Nadu", pincode: "600001" };
  it("accepts a valid address", () => expect(addressSchema.safeParse(a).success).toBe(true));
  it.each(["12345", "1234567", "60000a", ""])("rejects pincode %j", (pincode) => expect(addressSchema.safeParse({ ...a, pincode }).success).toBe(false));
  it("rejects a bad phone and a missing street", () => {
    expect(addressSchema.safeParse({ ...a, phone: "12" }).success).toBe(false);
    expect(addressSchema.safeParse({ ...a, line1: "" }).success).toBe(false);
  });
});

describe("productSchema", () => {
  const p = { name: "Shirt", sku: "SKU-1", description: "A nice long description", gender: "MEN", categoryId: "c1", price: "1999", salePrice: "", published: true, featured: false, variants: [{ size: "M", color: "Black", colorHex: "#000000", stock: "5" }] };
  const issuePaths = (v: unknown) => { const r = productSchema.safeParse(v); return r.success ? [] : r.error.issues.map((i) => i.path.join(".")); };

  it("accepts a valid product and coerces form strings", () => {
    const r = productSchema.safeParse(p);
    expect(r.success).toBe(true);
    if (r.success) { expect(r.data.price).toBe(1999); expect(r.data.salePrice).toBeUndefined(); expect(r.data.variants[0].stock).toBe(5); }
  });
  it("requires the sale price to be lower than the price", () => {
    expect(issuePaths({ ...p, salePrice: "1999" })).toContain("salePrice");
    expect(issuePaths({ ...p, salePrice: "2500" })).toContain("salePrice");
    expect(productSchema.safeParse({ ...p, salePrice: "1499" }).success).toBe(true);
  });
  it("rejects a zero or negative price", () => {
    expect(productSchema.safeParse({ ...p, price: "0" }).success).toBe(false);
    expect(productSchema.safeParse({ ...p, price: "-5" }).success).toBe(false);
  });
  it("rejects duplicate size and color pairs, ignoring case", () => {
    const v = { size: "M", color: "Black", colorHex: "#000000", stock: 1 };
    expect(issuePaths({ ...p, variants: [v, { ...v, color: "black" }] })).toContain("variants");
    expect(productSchema.safeParse({ ...p, variants: [v, { ...v, size: "L" }] }).success).toBe(true);
  });
  it("rejects bad stock, bad colors and an empty variant list", () => {
    const v = { size: "M", color: "Black", colorHex: "#000000", stock: 1 };
    expect(productSchema.safeParse({ ...p, variants: [{ ...v, stock: -1 }] }).success).toBe(false);
    expect(productSchema.safeParse({ ...p, variants: [{ ...v, stock: 1.5 }] }).success).toBe(false);
    expect(productSchema.safeParse({ ...p, variants: [{ ...v, colorHex: "red" }] }).success).toBe(false);
    expect(productSchema.safeParse({ ...p, variants: [] }).success).toBe(false);
  });
  it("rejects unknown collections and short descriptions", () => {
    expect(productSchema.safeParse({ ...p, gender: "KIDS" }).success).toBe(false);
    expect(productSchema.safeParse({ ...p, description: "short" }).success).toBe(false);
  });
});

describe("settingsSchema", () => {
  const s = { storeName: "ZSARRA", storeEmail: "a@b.co", shippingCharge: "99", freeShippingThreshold: "1999", taxPercent: "5", upiId: "shop@okbank", upiName: "ZSARRA" };
  it("accepts valid settings", () => expect(settingsSchema.safeParse(s).success).toBe(true));
  it("rejects negative shipping and tax above 40%", () => {
    expect(settingsSchema.safeParse({ ...s, shippingCharge: "-1" }).success).toBe(false);
    expect(msgs(settingsSchema.safeParse({ ...s, taxPercent: "50" }))).toContain("Tax can't be above 40%");
  });
  it.each(["shop@okbank", "my.shop-1@ybl", "9876543210@paytm", "name_x@upi"])("accepts the UPI ID %s", (upiId) => expect(settingsSchema.safeParse({ ...s, upiId }).success).toBe(true));
  it.each(["", "no-at-sign", "@bank", "a b@upi", "shop@", "shop@x", "https://x.com"])("rejects the UPI ID %j", (upiId) => {
    const r = settingsSchema.safeParse({ ...s, upiId });
    expect(r.success).toBe(false);
    expect(msgs(r)).toContain("Enter a UPI ID like name@bank");
  });
  it("needs a name on the UPI account", () => expect(settingsSchema.safeParse({ ...s, upiName: " " }).success).toBe(false));
});

describe("bannerSchema links", () => {
  const b = (href: string) => bannerSchema.safeParse({ title: "Sale", href }).success;
  it("allows on-site paths and an empty link", () => { expect(b("/sale")).toBe(true); expect(b("")).toBe(true); });
  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)"])("rejects %s", (href) => expect(b(href)).toBe(false));
});
