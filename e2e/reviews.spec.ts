import { expect, test } from "@playwright/test";
import { ADMIN_STATE, alertWith, CUSTOMER_STATE, createOrder, customerEmail, db, deleteOrders, LOGGED_OUT, statusWith, variantOf } from "./helpers";

const SLUG = "satin-midi-dress";
const star = (page: import("@playwright/test").Page, n: number) => page.locator(`label:has(input[name="rating"][value="${n}"])`).click();
const cleanup = async () => { await db.review.deleteMany({ where: { user: { email: customerEmail() } } }); };

test.describe("logged out", () => {
  test.use({ storageState: LOGGED_OUT });
  test("anyone can read reviews, but writing needs a login", async ({ page }) => {
    await page.goto(`/products/${SLUG}#reviews`);
    await expect(page.getByRole("heading", { name: /Ratings & reviews/ })).toBeVisible();
    await expect(page.getByText(/to write a review/)).toBeVisible();
    await page.locator("#reviews").getByRole("link", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Fproducts%2Fsatin-midi-dress%23reviews/);
    await page.goto("/reviews");
    await expect(page.getByRole("heading", { level: 1, name: "Customer reviews" })).toBeVisible();
  });
});

test.describe("customer reviews", () => {
  test.use({ storageState: CUSTOMER_STATE });
  test.describe.configure({ mode: "serial" });
  test.beforeAll(cleanup);
  test.afterAll(cleanup);

  test("checks the form: a star rating and a real review are required", async ({ page }) => {
    await page.goto(`/products/${SLUG}`);
    await page.getByLabel("Your review").fill("Too short");
    await page.getByRole("button", { name: "Submit review" }).click();
    await expect(alertWith(page, "Choose a star rating")).toBeVisible();
    await star(page, 4);
    await page.getByRole("button", { name: "Submit review" }).click();
    await expect(alertWith(page, "at least 10 characters")).toBeVisible();
    expect(await db.review.count({ where: { user: { email: customerEmail() } } })).toBe(0);
  });

  test("posting a review shows it everywhere it should, and editing doesn't duplicate it", async ({ page }) => {
    await page.goto(`/products/${SLUG}`);
    await star(page, 4);
    await page.getByLabel("Title (optional)").fill("Lovely dress");
    await page.getByLabel("Your review").fill("Beautiful fabric and a great fit for the price.");
    await page.getByRole("button", { name: "Submit review" }).click();
    await expect(statusWith(page, "Thanks! Your review is published.")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Beautiful fabric and a great fit for the price.")).toBeVisible();
    await expect(page.getByText("1 rating", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("E2E S.")).toBeVisible(); // first name + last initial only
    await expect(page.getByRole("button", { name: "Update review" })).toBeVisible();

    await star(page, 5);
    await page.getByLabel("Your review").fill("Even better after a few weeks of wear.");
    await page.getByRole("button", { name: "Update review" }).click();
    await expect(statusWith(page, "Your review was updated.")).toBeVisible();
    expect(await db.review.count({ where: { user: { email: customerEmail() } } })).toBe(1);
    expect((await db.review.findFirstOrThrow({ where: { user: { email: customerEmail() } } })).rating).toBe(5);

    await page.goto("/reviews");
    await expect(page.getByText("Even better after a few weeks of wear.")).toBeVisible();
    await page.goto("/reviews?rating=5");
    await expect(page.getByText("Even better after a few weeks of wear.")).toBeVisible();
    await page.goto("/reviews?rating=2");
    await expect(page.getByText("No reviews match this filter.")).toBeVisible();
    await page.goto(`/reviews?product=${SLUG}`);
    await expect(page.getByRole("heading", { level: 1, name: /Reviews for Satin midi dress/ })).toBeVisible();

    await page.goto("/women");
    await expect(page.locator(`a[href="/products/${SLUG}"]`)).toContainText("5.0");
    await page.goto("/");
    await expect(page.getByRole("region", { name: "What customers say" })).toContainText("Even better after a few weeks of wear.");
  });

  test("a buyer's review carries the verified purchase tag", async ({ page }) => {
    const user = await db.user.findUniqueOrThrow({ where: { email: customerEmail() } });
    const v = await variantOf("ribbed-knit-top", "M");
    const order = await createOrder({ userId: user.id, variantId: v.id, status: "DELIVERED", payment: "SUCCESS" });
    try {
      await page.goto("/products/ribbed-knit-top");
      await star(page, 5);
      await page.getByLabel("Your review").fill("Bought this last week and I love it.");
      await page.getByRole("button", { name: "Submit review" }).click();
      await expect(statusWith(page, "Thanks!")).toBeVisible();
      await page.reload();
      await expect(page.getByText("✓ Verified purchase").first()).toBeVisible();
      await page.goto("/reviews");
      await expect(page.getByRole("link", { name: "Ribbed knit top" }).first()).toBeVisible(); // listed under "Review something you bought"
    } finally { await deleteOrders([order.id]); }
  });

  test("deleting your own review removes it", async ({ page }) => {
    await page.goto(`/products/${SLUG}`);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete my review" }).click();
    await expect(page.getByText("Even better after a few weeks of wear.")).toHaveCount(0);
    expect(await db.review.count({ where: { productId: (await db.product.findUniqueOrThrow({ where: { slug: SLUG } })).id, user: { email: customerEmail() } } })).toBe(0);
  });
});

test.describe("admin moderation", () => {
  test.use({ storageState: ADMIN_STATE });
  test("hiding a review removes it from the store; showing and deleting work too", async ({ page }) => {
    const user = await db.user.findUniqueOrThrow({ where: { email: customerEmail() } });
    const product = await db.product.findUniqueOrThrow({ where: { slug: "tailored-trousers" } });
    const text = `Moderation test review ${Date.now()}`;
    const review = await db.review.create({ data: { productId: product.id, userId: user.id, rating: 3, title: "Decent", body: text } });
    try {
      await page.goto(`/admin/reviews?q=${encodeURIComponent(text)}`);
      const row = page.locator("tr", { hasText: text });
      await expect(row).toContainText("Visible");
      await page.goto(`/reviews?product=tailored-trousers`);
      await expect(page.getByText(text)).toBeVisible();

      await page.goto(`/admin/reviews?q=${encodeURIComponent(text)}`);
      await row.getByRole("button", { name: "Hide" }).click();
      await expect(row).toContainText("Hidden");
      await page.goto(`/reviews?product=tailored-trousers`);
      await expect(page.getByText(text)).toHaveCount(0);

      await page.goto(`/admin/reviews?q=${encodeURIComponent(text)}&status=hidden`);
      await row.getByRole("button", { name: "Show" }).click();
      await page.goto(`/admin/reviews?q=${encodeURIComponent(text)}`);
      await expect(row).toContainText("Visible");

      page.once("dialog", (d) => d.accept());
      await row.getByRole("button", { name: "Delete" }).click();
      await expect(row).toHaveCount(0);
      expect(await db.review.count({ where: { id: review.id } })).toBe(0);
    } finally { await db.review.deleteMany({ where: { id: review.id } }); }
  });

  test("the reviews admin page is off limits to customers", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: "http://localhost:3100", storageState: CUSTOMER_STATE });
    const p = await ctx.newPage();
    await p.goto("/admin/reviews");
    await expect(p).toHaveURL(/\/admin\/login/);
    await ctx.close();
  });
});
