import { expect, test, type Page } from "@playwright/test";
import { LOGGED_OUT } from "./helpers";

test.use({ storageState: LOGGED_OUT });

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

for (const path of ["/", "/men", "/women", "/sale", "/products/linen-overshirt", "/login", "/register", "/faq", "/admin/login"]) {
  test(`${path} doesn't scroll sideways on a phone`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("main, body").first()).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });
}

test("mobile navigation shows the section links and they work", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Main", exact: true })).toBeHidden();
  const mobile = page.getByRole("navigation", { name: "Main mobile" });
  await expect(mobile).toBeVisible();
  await mobile.getByRole("link", { name: "Women" }).click();
  await expect(page).toHaveURL(/\/women$/);
  await expect(page.getByText("Satin midi dress")).toBeVisible();
});

test("the product grid shows two columns on a phone", async ({ page }) => {
  await page.goto("/new-arrivals");
  const boxes = await page.locator("main a[href^='/products/']").evaluateAll((els) => els.slice(0, 3).map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y }; }));
  expect(boxes.length).toBeGreaterThanOrEqual(3);
  expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThan(4);   // first two share a row
  expect(boxes[1].x).toBeGreaterThan(boxes[0].x);
  expect(boxes[2].y).toBeGreaterThan(boxes[0].y + 50);          // third wraps to the next row
});

test("a shopper can pick a size on a phone", async ({ page }) => {
  await page.goto("/products/linen-overshirt");
  const size = page.getByRole("button", { name: "M", exact: true });
  const box = await size.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(36); // comfortable touch target
  await size.tap();
  await expect(page.getByRole("button", { name: "Add to cart" })).toBeEnabled();
});

test("the filters stay usable on a phone", async ({ page }) => {
  await page.goto("/men");
  await page.locator('select[name="sort"]').selectOption("price-asc");
  await page.getByRole("button", { name: "Apply" }).tap();
  await expect(page).toHaveURL(/sort=price-asc/);
});
