import { expect, test, type Page } from "@playwright/test";
import { addToCart, alertWith, CUSTOMER_STATE, createOrder, createUser, customerEmail, db, deleteOrders, emptyCart, expectedTotals, formatINR, statusWith, variantOf } from "./helpers";

test.use({ storageState: CUSTOMER_STATE });

async function newAddress(page: Page, pincode: string) {
  await page.getByLabel("Use a new address").check();
  for (const [n, v] of Object.entries({ fullName: "Asha Rao", phone: "9876543210", line1: "12 Main Road", city: "Chennai", state: "Tamil Nadu", pincode })) await page.locator(`input[name="${n}"]`).fill(v);
}

test("an empty cart can't reach checkout", async ({ page }) => {
  await emptyCart(page);
  await page.goto("/checkout");
  await expect(page).toHaveURL(/\/cart$/);
});

test("address book validates and saves addresses", async ({ page }) => {
  await page.goto("/account");
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Save address" }) });
  const fill = async (pincode: string) => {
    for (const [n, v] of Object.entries({ fullName: "Asha Rao", phone: "9876543210", line1: "12 Main Road", city: "Chennai", state: "Tamil Nadu", pincode })) await form.locator(`input[name="${n}"]`).fill(v);
    await form.getByRole("button", { name: "Save address" }).click();
  };
  await fill("123");
  await expect(alertWith(page, "Pincode must be 6 digits")).toBeVisible();
  await fill("600001");
  await expect(statusWith(page, "Address saved")).toBeVisible();
  await expect(page.getByText("12 Main Road").first()).toBeVisible();
});

test("the order summary uses server-side shipping and tax", async ({ page }) => {
  await emptyCart(page);
  await addToCart(page, "ribbed-knit-top", "M"); // 1,499
  await page.goto("/checkout");
  const t = await expectedTotals(149900);
  const aside = page.locator("aside");
  await expect(aside).toContainText(formatINR(149900));
  await expect(aside).toContainText(formatINR(t.total));
  await emptyCart(page);
});

test("customers can't open someone else's order or payment page", async ({ page }) => {
  const other = await createUser("other");
  const v = await variantOf("ribbed-knit-top", "M");
  const order = await createOrder({ userId: other.id, variantId: v.id, payment: "PENDING" });
  try {
    for (const path of [`/account/orders/${order.id}`, `/pay/${order.id}`]) {
      await page.goto(path);
      await expect(page.getByText("Page not found")).toBeVisible();
    }
  } finally { await deleteOrders([order.id]); await db.user.delete({ where: { id: other.id } }); }
});

test.describe("paying by UPI QR", () => {
  test("invalid delivery details are rejected and create no order", async ({ page }) => {
    await emptyCart(page);
    await addToCart(page, "ribbed-knit-top", "M");
    const before = await db.order.count({ where: { user: { email: customerEmail() } } });
    await page.goto("/checkout");
    await newAddress(page, "12");
    await page.getByRole("button", { name: /^Pay / }).click();
    await expect(alertWith(page, "Pincode must be 6 digits")).toBeVisible();
    expect(await db.order.count({ where: { user: { email: customerEmail() } } })).toBe(before);
    await emptyCart(page);
  });

  test("placing an order shows the QR payment page, and the reference number is recorded", async ({ page }) => {
    await emptyCart(page);
    const v = await variantOf("ribbed-knit-top", "M");
    const stockBefore = (await db.variant.findUniqueOrThrow({ where: { id: v.id } })).stock;
    await addToCart(page, "ribbed-knit-top", "M");
    await page.goto("/checkout");
    await newAddress(page, "600001");
    await page.getByRole("button", { name: /^Pay / }).click();
    await expect(page).toHaveURL(/\/pay\/[a-z0-9]+$/);

    const order = await db.order.findFirstOrThrow({ where: { user: { email: customerEmail() } }, orderBy: { createdAt: "desc" }, include: { payments: true } });
    try {
      await expect(page.getByTestId("pay-amount")).toHaveText(formatINR((await expectedTotals(149900)).total));
      const qr = page.getByRole("img", { name: /UPI QR code/ });
      await expect(qr).toBeVisible();
      await expect.poll(() => qr.evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0)).toBe(true); // the picture really loads
      await expect(page.getByTestId("pay-upi-id")).toBeVisible();

      expect(order.status).toBe("PENDING");
      expect(order.payments).toHaveLength(1);
      expect(order.payments[0]).toMatchObject({ gateway: "upi_qr", status: "PENDING", gatewayPaymentId: null, gatewayOrderId: `qr_${order.number}`, amount: order.total });
      expect((await db.variant.findUniqueOrThrow({ where: { id: v.id } })).stock).toBe(stockBefore - 1); // stock is held
      expect(await db.cartItem.count({ where: { user: { email: customerEmail() } } })).toBe(0);

      const ref = page.locator('input[name="reference"]');
      await ref.fill("12345-67890!"); // long enough for the browser, but not a valid reference
      await page.getByRole("button", { name: "Submit reference number" }).click();
      await expect(alertWith(page, "reference number (UTR)")).toBeVisible();

      await ref.fill("123456789012");
      await page.getByRole("button", { name: "Submit reference number" }).click();
      await expect(statusWith(page, "received your reference number")).toBeVisible();
      const paid = await db.payment.findUniqueOrThrow({ where: { id: order.payments[0].id } });
      expect(paid).toMatchObject({ gatewayPaymentId: "123456789012", status: "PENDING" }); // waits for the admin
      expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");

      await page.reload();
      await expect(page.getByText("Reference received:")).toBeVisible();
      await page.goto(`/account/orders/${order.id}`);
      await expect(page.getByText("Payment awaiting verification").first()).toBeVisible();
    } finally {
      await deleteOrders([order.id]);
      await db.variant.update({ where: { id: v.id }, data: { stock: stockBefore } });
    }
  });

  test("a reference number already used for another order is refused", async ({ page }) => {
    const me = await db.user.findUniqueOrThrow({ where: { email: customerEmail() } });
    const other = await createUser("other");
    const v = await variantOf("ribbed-knit-top", "M");
    const stamp = Date.now();
    const taken = await createOrder({ userId: other.id, variantId: v.id, payment: "PENDING", reference: `USED${stamp}` });
    const mine = await createOrder({ userId: me.id, variantId: v.id, payment: "PENDING" });
    try {
      await page.goto(`/pay/${mine.id}`);
      await page.locator('input[name="reference"]').fill(`USED${stamp}`);
      await page.getByRole("button", { name: "Submit reference number" }).click();
      await expect(alertWith(page, "already used for another order")).toBeVisible();
      expect((await db.payment.findFirstOrThrow({ where: { orderId: mine.id } })).gatewayPaymentId).toBeNull();
    } finally { await deleteOrders([taken.id, mine.id]); await db.user.delete({ where: { id: other.id } }); }
  });

  test("the store can pause orders from the settings", async ({ page }) => {
    await emptyCart(page);
    await addToCart(page, "ribbed-knit-top", "M");
    await db.setting.upsert({ where: { key: "paymentsEnabled" }, update: { value: "0" }, create: { key: "paymentsEnabled", value: "0" } });
    try {
      await page.goto("/checkout");
      await expect(alertWith(page, "Orders are paused right now")).toBeVisible();
      await expect(page.getByRole("button", { name: /^Pay / })).toBeDisabled();
    } finally {
      await db.setting.deleteMany({ where: { key: "paymentsEnabled" } });
      await emptyCart(page);
    }
  });
});
