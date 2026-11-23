import { expect, test } from "@playwright/test";
import { ADMIN_STATE, alertWith, CUSTOMER_STATE, createOrder, createUser, customerEmail, db, deleteOrders, LOGGED_OUT, PASSWORD, PNG, statusWith, variantOf } from "./helpers";

const adminPaths = ["/admin", "/admin/products", "/admin/products/new", "/admin/categories", "/admin/customers", "/admin/orders", "/admin/payments", "/admin/reviews", "/admin/import", "/admin/settings"];

test.describe("access control", () => {
  test.describe("with no session", () => {
    test.use({ storageState: LOGGED_OUT });
    for (const path of adminPaths) test(`${path} redirects to the admin login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login/);
    });
    test("wrong admin credentials and customer credentials get the same message", async ({ page }) => {
      for (const [email, pw] of [["nobody@example.test", "Whatever123"], [customerEmail(), PASSWORD]]) {
        await page.goto("/admin/login");
        await page.locator('input[name="email"]').fill(email);
        await page.locator('input[name="password"]').fill(pw);
        await page.getByRole("button", { name: "Log in" }).click();
        await expect(alertWith(page, "Email or password is incorrect")).toBeVisible();
      }
    });
  });
  test.describe("as a customer", () => {
    test.use({ storageState: CUSTOMER_STATE });
    for (const path of adminPaths) test(`${path} is off limits`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login/);
    });
  });
});

test.describe("admin dashboard", () => {
  test.use({ storageState: ADMIN_STATE });

  test("dashboard and every section load", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    for (const [path, heading] of [["/admin/products", "Products"], ["/admin/categories", "Categories"], ["/admin/customers", "Customers"], ["/admin/orders", "Orders"], ["/admin/payments", "Payments"], ["/admin/settings", "Store settings"]] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    }
  });

  test.describe("products and inventory", () => {
    test.describe.configure({ mode: "serial" });
    const stamp = Date.now();
    const sku = `E2E-${stamp}`, name = `E2E Jacket ${stamp}`;
    const row = (page: import("@playwright/test").Page) => page.locator("tr", { hasText: sku });
    const fillBase = async (page: import("@playwright/test").Page, o: { name: string; sku: string; price: string; sale?: string }) => {
      await page.locator('input[name="name"]').fill(o.name);
      await page.locator('input[name="sku"]').fill(o.sku);
      await page.locator('textarea[name="description"]').fill("A jacket created by the automated tests.");
      await page.locator('select[name="gender"]').selectOption("MEN");
      await page.locator('select[name="categoryId"]').selectOption({ index: 1 });
      await page.locator('input[name="price"]').fill(o.price);
      await page.locator('input[name="salePrice"]').fill(o.sale ?? "");
    };
    test.afterAll(async () => { await db.product.deleteMany({ where: { sku: { startsWith: `E2E-${stamp}` } } }); });

    test("rejects an image that isn't really an image", async ({ page }) => {
      await page.goto("/admin/products/new");
      await fillBase(page, { name: `${name} bad`, sku: `${sku}-bad`, price: "1999" });
      await page.locator('input[type="number"]').fill("3");
      await page.locator('input[name="images"]').setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("this is not a png") });
      await page.getByRole("button", { name: "Create product" }).click();
      await expect(alertWith(page, "must be a JPG, PNG or WebP")).toBeVisible();
      expect(await db.product.count({ where: { sku: `${sku}-bad` } })).toBe(0);
    });

    test("validates the sale price", async ({ page }) => {
      await page.goto("/admin/products/new");
      await fillBase(page, { name: `${name} v`, sku: `${sku}-v`, price: "1000", sale: "1500" });
      await page.getByRole("button", { name: "Create product" }).click();
      await expect(alertWith(page, "Sale price must be lower than the price")).toBeVisible();
    });

    test("creates a published product with an image and stock", async ({ page }) => {
      await page.goto("/admin/products/new");
      await fillBase(page, { name, sku, price: "1999", sale: "1499" });
      await page.locator('input[type="number"]').fill("4");
      await page.locator('input[name="images"]').setInputFiles({ name: "jacket.png", mimeType: "image/png", buffer: PNG });
      await page.locator('input[name="published"]').check();
      await page.getByRole("button", { name: "Create product" }).click();
      await expect(page).toHaveURL(/\/admin\/products$/);
      await expect(page.locator("tr", { hasText: sku })).toBeVisible();

      await page.goto(`/search?q=${sku}`);
      await expect(page.getByText(name)).toBeVisible();
      await expect(page.getByText("₹1,499")).toBeVisible();
      await page.getByText(name).click();
      await expect(page.locator("main img").first()).toBeVisible();
    });

    test("refuses a duplicate SKU", async ({ page }) => {
      await page.goto("/admin/products/new");
      await fillBase(page, { name: `${name} copy`, sku, price: "999" });
      await page.getByRole("button", { name: "Create product" }).click();
      await expect(alertWith(page, "already used")).toBeVisible();
    });

    test("edits the price and the storefront follows", async ({ page }) => {
      await page.goto(`/admin/products?q=${sku}`);
      await row(page).getByRole("link", { name }).click();
      await page.locator('input[name="price"]').fill("2499");
      await page.locator('input[name="salePrice"]').fill("");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page).toHaveURL(/\/admin\/products$/);
      await page.goto(`/search?q=${sku}`);
      await expect(page.getByText("₹2,499")).toBeVisible();
      await expect(page.locator("main s")).toHaveCount(0);
    });

    test("stock changes reach the storefront, and zero stock blocks purchase", async ({ page }) => {
      await page.goto(`/admin/products?q=${sku}`);
      await row(page).getByRole("link", { name }).click();
      await page.locator('input[type="number"]').first().fill("0");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page).toHaveURL(/\/admin\/products$/);
      await page.goto(`/search?q=${sku}`);
      await expect(page.getByText("Sold out")).toBeVisible();
      await page.getByText(name).click();
      await expect(page.getByRole("button", { name: "M", exact: true })).toBeDisabled();
    });

    test("unpublishing hides the product from the storefront", async ({ page }) => {
      await page.goto(`/admin/products?q=${sku}`);
      await row(page).getByRole("button", { name: "Unpublish" }).click();
      await expect(row(page).getByText("Unpublished")).toBeVisible();
      await page.goto(`/search?q=${sku}`);
      await expect(page.getByText("No products match these filters.")).toBeVisible();
    });

    test("deleting asks for confirmation, then removes the product", async ({ page }) => {
      await page.goto(`/admin/products?q=${sku}`);
      page.once("dialog", (d) => d.dismiss());
      await row(page).getByRole("button", { name: "Delete" }).click();
      await expect(row(page)).toBeVisible(); // dismissed: still there
      page.once("dialog", (d) => d.accept());
      await row(page).getByRole("button", { name: "Delete" }).click();
      await expect(row(page)).toHaveCount(0);
    });
  });

  test.describe("customers", () => {
    test("search, inspect, deactivate and reactivate (without exposing passwords)", async ({ page, browser }) => {
      const user = await createUser("managed");
      try {
        await page.goto(`/admin/customers?q=${encodeURIComponent(user.email)}`);
        await page.getByRole("link", { name: "Victim Test" }).click();
        await expect(page.getByText(user.email)).toBeVisible();
        await expect(page.locator("body")).not.toContainText("$2"); // no bcrypt hash anywhere

        page.once("dialog", (d) => d.accept());
        await page.getByRole("button", { name: "Deactivate account" }).click();
        await expect(page.getByText("Status: Deactivated")).toBeVisible();

        const ctx = await browser.newContext({ baseURL: "http://localhost:3100", storageState: LOGGED_OUT });
        const cp = await ctx.newPage();
        const tryLogin = async () => {
          await cp.goto("/login");
          await cp.locator('input[name="email"]').fill(user.email);
          await cp.locator('input[name="password"]').fill(PASSWORD);
          await cp.getByRole("button", { name: "Log in" }).click();
        };
        await tryLogin();
        await expect(alertWith(cp, "Email or password is incorrect")).toBeVisible();

        page.once("dialog", (d) => d.accept());
        await page.getByRole("button", { name: "Reactivate account" }).click();
        await expect(page.getByText("Status: Active")).toBeVisible();
        await tryLogin();
        await expect(cp).toHaveURL(/\/account$/);
        await ctx.close();
      } finally { await db.user.delete({ where: { id: user.id } }); }
    });
  });

  test.describe("orders and payments", () => {
    let user: Awaited<ReturnType<typeof createUser>>;
    const orderIds: string[] = [];
    test.beforeAll(async () => { user = await createUser("buyer"); });
    test.afterAll(async () => { await deleteOrders(orderIds); await db.user.delete({ where: { id: user.id } }); });
    const make = async (o: { qty?: number; status?: "PENDING" | "CONFIRMED"; payment?: "SUCCESS" | "PENDING" | null }) => {
      const v = await variantOf("ribbed-knit-top", "S");
      const order = await createOrder({ userId: user.id, variantId: v.id, ...o });
      orderIds.push(order.id);
      return { order, v };
    };
    const setStatus = async (page: import("@playwright/test").Page, status: string, tracking?: string) => {
      await page.locator('select[name="status"]').selectOption(status);
      if (tracking !== undefined) await page.locator('input[name="trackingNumber"]').fill(tracking);
      await page.getByRole("button", { name: "Update order" }).click();
    };

    test("an unpaid order can't be confirmed", async ({ page }) => {
      const { order } = await make({ payment: "PENDING" });
      await page.goto(`/admin/orders/${order.id}`);
      await setStatus(page, "CONFIRMED");
      await expect(alertWith(page, "no verified payment")).toBeVisible();
      expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");
    });

    test("a paid order moves through processing and shipping, and shipping needs a tracking number", async ({ page }) => {
      const { order } = await make({ status: "CONFIRMED", payment: "SUCCESS" });
      await page.goto(`/admin/orders/${order.id}`);
      await setStatus(page, "PROCESSING");
      await expect(statusWith(page, "Status updated")).toBeVisible();
      await setStatus(page, "SHIPPED", "");
      await expect(alertWith(page, "Enter a tracking number")).toBeVisible();
      await setStatus(page, "SHIPPED", "TRK-E2E-123");
      await expect(statusWith(page, "Status updated")).toBeVisible();
      await expect(page.getByText("Tracking number: TRK-E2E-123")).toBeVisible();
      await expect(page.locator('select[name="status"] option[value="CANCELLED"]')).toHaveCount(0); // can't cancel after shipping
      await expect(page.locator('select[name="status"] option[value="PENDING"]')).toHaveCount(0);
    });

    test("cancelling an order returns its stock", async ({ page }) => {
      const { order, v } = await make({ qty: 2, payment: "PENDING" });
      await db.variant.update({ where: { id: v.id }, data: { stock: { decrement: 2 } } }); // what checkout would have reserved
      const before = (await db.variant.findUniqueOrThrow({ where: { id: v.id } })).stock;
      await page.goto(`/admin/orders/${order.id}`);
      await setStatus(page, "CANCELLED");
      await expect(page.getByText("This order is cancelled and can't be changed.")).toBeVisible();
      await expect.poll(async () => (await db.variant.findUniqueOrThrow({ where: { id: v.id } })).stock).toBe(before + 2);
    });

    test("orders can be searched and payments can't be edited by hand", async ({ page }) => {
      const { order } = await make({ payment: "SUCCESS" });
      await page.goto(`/admin/orders?q=${order.number}`);
      await expect(page.getByRole("link", { name: `#${order.number}` })).toBeVisible();
      await page.goto(`/admin/orders/${order.id}`);
      await expect(page.getByText("isn't edited here")).toBeVisible();
      await expect(page.getByRole("button", { name: /mark.*(paid|success)/i })).toHaveCount(0);
      await page.goto("/admin/payments?status=SUCCESS");
      await expect(page.getByText(order.payments[0].gatewayPaymentId!)).toBeVisible();
    });

    test("a customer sees their own order's tracking number", async ({ browser }) => {
      const { order } = await make({ status: "CONFIRMED", payment: "SUCCESS" });
      await db.order.update({ where: { id: order.id }, data: { status: "SHIPPED", trackingNumber: "TRK-CUST-1" } });
      const ctx = await browser.newContext({ baseURL: "http://localhost:3100", storageState: LOGGED_OUT });
      const p = await ctx.newPage();
      await p.goto("/login");
      await p.locator('input[name="email"]').fill(user.email);
      await p.locator('input[name="password"]').fill(PASSWORD);
      await p.getByRole("button", { name: "Log in" }).click();
      await p.goto(`/account/orders/${order.id}`);
      await expect(p.getByText("TRK-CUST-1")).toBeVisible();
      await ctx.close();
    });
  });

  test("store settings save, validate and drive the checkout rules", async ({ page }) => {
    try {
      await page.goto("/admin/settings");
      await page.locator('input[name="taxPercent"]').fill("50");
      await page.getByRole("button", { name: "Save settings" }).click();
      await expect(alertWith(page, "Tax can't be above 40%")).toBeVisible();

      await page.locator('input[name="shippingCharge"]').fill("150");
      await page.locator('input[name="taxPercent"]').fill("5");
      await page.getByRole("button", { name: "Save settings" }).click();
      await expect(statusWith(page, "Settings saved")).toBeVisible();
      const rows = Object.fromEntries((await db.setting.findMany()).map((r) => [r.key, r.value]));
      expect(rows).toMatchObject({ shippingCharge: "15000", taxPercent: "5" });
    } finally { await db.setting.deleteMany(); }
  });
});
