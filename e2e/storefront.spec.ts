import { expect, test } from "@playwright/test";
import { LOGGED_OUT } from "./helpers";

test.use({ storageState: LOGGED_OUT });
const products = (page: import("@playwright/test").Page) => page.locator("main a[href^='/products/']");

test("home page shows navigation and featured products", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Main", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Featured" })).toBeVisible();
  await expect(products(page).first()).toBeVisible();
});

test("men's and women's sections only list their own products", async ({ page }) => {
  await page.goto("/men");
  await expect(page.getByText("Linen overshirt")).toBeVisible();
  await expect(page.getByText("Satin midi dress")).toHaveCount(0);
  await page.goto("/women");
  await expect(page.getByText("Satin midi dress")).toBeVisible();
  await expect(page.getByText("Linen overshirt")).toHaveCount(0);
});

test("sale page lists only discounted products", async ({ page }) => {
  await page.goto("/sale");
  await expect(page.getByText("Tailored trousers")).toBeVisible();
  await expect(page.getByText("Linen overshirt")).toHaveCount(0);
});

test("new arrivals lists products", async ({ page }) => {
  await page.goto("/new-arrivals");
  await expect(products(page).first()).toBeVisible();
});

test("search finds products case-insensitively and shows an empty state", async ({ page }) => {
  await page.goto("/search?q=OVERSHIRT");
  await expect(page.getByText("Linen overshirt")).toBeVisible();
  await page.goto("/search?q=zzzzqqqq");
  await expect(page.getByText("No products match these filters.")).toBeVisible();
});

test("search can be done from the search box", async ({ page }) => {
  await page.goto("/search");
  await page.getByRole("searchbox").or(page.locator("#q")).first().fill("dress");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/q=dress/);
  await expect(page.getByText("Satin midi dress")).toBeVisible();
});

test("category, price and sort filters work", async ({ page }) => {
  await page.goto("/women?category=women-dresses");
  await expect(page.getByText("Satin midi dress")).toBeVisible();
  await expect(page.getByText("Ribbed knit top")).toHaveCount(0);

  await page.goto("/men?min=3000&max=4000");
  await expect(page.getByText("Linen overshirt")).toBeVisible();
  await expect(page.getByText("Tailored trousers")).toHaveCount(0);

  await page.goto("/men?sort=price-asc");
  await expect(products(page).first()).toContainText("Tailored trousers");
  await page.goto("/men?sort=price-desc");
  await expect(products(page).first()).toContainText("Linen overshirt");
});

test("filter form applies and clears filters", async ({ page }) => {
  await page.goto("/men");
  await page.locator('select[name="sort"]').selectOption("price-asc");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/sort=price-asc/);
  await page.getByRole("link", { name: "Clear" }).click();
  await expect(page).not.toHaveURL(/sort=/);
});

test("product page shows details and requires a size before adding", async ({ page }) => {
  await page.goto("/products/linen-overshirt");
  await expect(page.getByRole("heading", { level: 1, name: "Linen overshirt" })).toBeVisible();
  await expect(page.getByText("₹3,499")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to cart" })).toBeDisabled();
  await page.getByRole("button", { name: "M", exact: true }).click();
  await expect(page.getByText("In stock")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to cart" })).toBeEnabled();
});

test("adding to cart while logged out sends the visitor to login and back", async ({ page }) => {
  await page.goto("/products/linen-overshirt");
  await page.getByRole("button", { name: "M", exact: true }).click();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fproducts%2Flinen-overshirt/);
});

test("cart, wishlist and checkout require login", async ({ page }) => {
  for (const path of ["/cart", "/wishlist", "/checkout", "/account", "/account/orders"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}`));
  }
});

test("unknown products show the not-found page", async ({ page }) => {
  await page.goto("/products/does-not-exist");
  await expect(page.getByText("Page not found")).toBeVisible();
});

for (const [path, heading] of [["/faq", /Frequently asked/], ["/contact", /Contact us/], ["/policies/shipping", /Shipping policy/], ["/policies/returns", /Returns policy/], ["/policies/privacy", /Privacy policy/], ["/policies/terms", /Terms and conditions/]] as const) {
  test(`${path} renders`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  });
}
