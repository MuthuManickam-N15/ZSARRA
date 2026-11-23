import fs from "node:fs";
import { expect, test as setup } from "@playwright/test";
import { ADMIN, ADMIN_STATE, CUSTOMER_STATE, PASSWORD, uniqueEmail, visit } from "./helpers";

setup.beforeAll(() => fs.mkdirSync("e2e/.auth", { recursive: true }));

// The first visit to each page compiles it, which is slow on a cold dev server. Visiting the pages up front keeps the real tests fast.
setup("warm up the dev server", async ({ page }) => {
  setup.setTimeout(300_000);
  for (const path of ["/", "/register", "/login", "/men", "/women", "/sale", "/new-arrivals", "/search", "/products/linen-overshirt", "/faq", "/contact", "/policies/shipping", "/admin/login"]) {
    await visit(page, path);
  }
});

setup("create and sign in a customer", async ({ page }) => {
  setup.setTimeout(180_000);
  let email = "";
  // Retried as a whole: submitting before the page has finished loading can silently lose the click.
  await expect(async () => {
    email = uniqueEmail("shopper");
    await page.goto("/register");
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.locator('input[name="name"]').fill("E2E Shopper");
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.locator('input[name="confirm"]').fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/account$/, { timeout: 10_000 });
  }).toPass({ timeout: 90_000 });
  await page.context().storageState({ path: CUSTOMER_STATE });
  fs.writeFileSync("e2e/.auth/customer-email.txt", email);
  for (const path of ["/cart", "/wishlist", "/checkout", "/account/orders"]) await visit(page, path); // compile the signed-in pages too
});

setup("sign in the admin", async ({ page }) => {
  setup.setTimeout(240_000);
  expect(ADMIN.email, "ADMIN_EMAIL must be set in .env.test").not.toBe("");
  await page.goto("/admin/login");
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.locator('input[name="email"]').fill(ADMIN.email);
  await page.locator('input[name="password"]').fill(ADMIN.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.context().storageState({ path: ADMIN_STATE });
  for (const path of ["/admin/products", "/admin/products/new", "/admin/categories", "/admin/customers", "/admin/orders", "/admin/payments", "/admin/settings"]) await visit(page, path);
});
