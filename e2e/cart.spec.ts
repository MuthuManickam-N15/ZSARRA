import { expect, test } from "@playwright/test";
import { addToCart, alertWith, CUSTOMER_STATE, customerEmail, db, emptyCart, formatINR, statusWith, variantOf } from "./helpers";

test.use({ storageState: CUSTOMER_STATE });
test.beforeEach(async ({ page }) => { await emptyCart(page); });

test("totals and quantities update correctly", async ({ page }) => {
  await addToCart(page, "linen-overshirt", "M");       // 3,499
  await addToCart(page, "tailored-trousers", "L");     // sale price 2,499
  await page.goto("/cart");
  await expect(page.getByText("Subtotal (2 items)")).toBeVisible();
  await expect(page.locator("aside")).toContainText(formatINR(349900 + 249900));

  const row = page.locator("li", { hasText: "Linen overshirt" });
  await row.locator("select").selectOption("2");
  await row.getByRole("button", { name: "Update" }).click();
  await expect(page.getByText("Subtotal (3 items)")).toBeVisible();
  await expect(page.locator("aside")).toContainText(formatINR(2 * 349900 + 249900));
});

test("removing one item leaves the others in the cart", async ({ page }) => {
  await addToCart(page, "linen-overshirt", "S");
  await addToCart(page, "linen-overshirt", "M");
  await addToCart(page, "tailored-trousers", "L");
  await page.goto("/cart");
  await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(3);

  await page.getByRole("button", { name: "Remove Linen overshirt (Black, M)" }).click();
  await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Remove Linen overshirt (Black, S)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove Tailored trousers (Black, L)" })).toBeVisible();
  expect(await db.cartItem.count({ where: { user: { email: customerEmail() } } })).toBe(2);
});

test("an empty cart shows a friendly empty state", async ({ page }) => {
  await page.goto("/cart");
  await expect(page.getByText("Your cart is empty.")).toBeVisible();
});

test("the header shows the cart count", async ({ page }) => {
  await addToCart(page, "ribbed-knit-top", "M");
  await expect(page.getByRole("link", { name: /^Cart \(1\)/ })).toBeVisible();
});

test("customers can't add more than the stock", async ({ page }) => {
  const v = await variantOf("ribbed-knit-top", "S");
  await db.variant.update({ where: { id: v.id }, data: { stock: 2 } });
  try {
    await addToCart(page, "ribbed-knit-top", "S");
    await addToCart(page, "ribbed-knit-top", "S");
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(alertWith(page, "most you can buy is 2")).toBeVisible();
  } finally { await db.variant.update({ where: { id: v.id }, data: { stock: 10 } }); }
});

test("sold-out sizes can't be selected", async ({ page }) => {
  const v = await variantOf("ribbed-knit-top", "L");
  await db.variant.update({ where: { id: v.id }, data: { stock: 0 } });
  try {
    await page.goto("/products/ribbed-knit-top");
    await expect(page.getByRole("button", { name: "L", exact: true })).toBeDisabled();
  } finally { await db.variant.update({ where: { id: v.id }, data: { stock: 10 } }); }
});

test("an item that sells out after being added is flagged and blocks checkout", async ({ page }) => {
  const v = await variantOf("ribbed-knit-top", "S");
  await addToCart(page, "ribbed-knit-top", "S");
  await db.variant.update({ where: { id: v.id }, data: { stock: 0 } });
  try {
    await page.goto("/cart");
    await expect(alertWith(page, "Out of stock")).toBeVisible();
    await expect(page.getByRole("button", { name: "Checkout" })).toBeDisabled();
  } finally { await db.variant.update({ where: { id: v.id }, data: { stock: 10 } }); }
});

test("wishlist saves and removes products", async ({ page }) => {
  await page.goto("/products/satin-midi-dress");
  await page.getByRole("button", { name: "Save to wishlist" }).click();
  await expect(page.getByRole("button", { name: "Remove from wishlist" })).toBeVisible();
  await page.goto("/wishlist");
  await expect(page.getByText("Satin midi dress")).toBeVisible();
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("You haven't saved anything yet")).toBeVisible();
});
