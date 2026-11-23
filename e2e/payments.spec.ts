import { expect, test } from "@playwright/test";
import { ADMIN_STATE, alertWith, createOrder, createUser, db, deleteOrders, LOGGED_OUT, PNG, statusWith, variantOf } from "./helpers";

test.use({ storageState: ADMIN_STATE });
test.describe.configure({ mode: "serial" });

let user: Awaited<ReturnType<typeof createUser>>;
const orderIds: string[] = [];
const stamp = Date.now();
let n = 0;

async function make(o: { reference?: string; status?: "PENDING" | "CONFIRMED" | "CANCELLED"; payment?: "PENDING" | "SUCCESS" } = {}) {
  const v = await variantOf("ribbed-knit-top", "S");
  const order = await createOrder({ userId: user.id, variantId: v.id, payment: o.payment ?? "PENDING", status: o.status, reference: o.reference });
  orderIds.push(order.id);
  return order;
}
const ref = () => `E2EUTR${stamp}${++n}`;

test.beforeAll(async () => { user = await createUser("payer"); });
test.afterAll(async () => {
  await deleteOrders(orderIds);
  await db.setting.deleteMany();
  await db.user.delete({ where: { id: user.id } });
});

test("only payments with a reference number wait for verification", async ({ page }) => {
  const sent = ref();
  const withRef = await make({ reference: sent });
  const noRef = await make();
  await page.goto("/admin/payments");
  const region = page.getByRole("region", { name: /Awaiting verification/ });
  await expect(region.locator("tr", { hasText: sent })).toBeVisible();
  await expect(region.locator("tr", { hasText: `#${withRef.number}` }).getByRole("button", { name: "Mark as paid" })).toBeVisible();
  await expect(region.locator("tr", { hasText: `#${noRef.number}` })).toHaveCount(0);
});

test("marking a payment as paid confirms the order", async ({ page }) => {
  const sent = ref();
  const order = await make({ reference: sent });
  await page.goto("/admin/payments");
  const row = page.getByRole("region", { name: /Awaiting verification/ }).locator("tr", { hasText: sent });
  page.once("dialog", (d) => { expect(d.message()).toContain(sent); d.accept(); });
  await row.getByRole("button", { name: "Mark as paid" }).click();
  await expect(statusWith(page, "Payment marked as paid and the order is confirmed.")).toBeVisible();
  await expect(row).toHaveCount(0);
  expect((await db.payment.findFirstOrThrow({ where: { orderId: order.id } })).status).toBe("SUCCESS");
  expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CONFIRMED");
});

test("rejecting a reference number marks the payment failed so the customer can try again", async ({ page }) => {
  const sent = ref();
  const order = await make({ reference: sent });
  await page.goto("/admin/payments");
  const row = page.getByRole("region", { name: /Awaiting verification/ }).locator("tr", { hasText: sent });
  page.once("dialog", (d) => d.accept());
  await row.getByRole("button", { name: "Reject" }).click();
  await expect(statusWith(page, "Payment rejected.")).toBeVisible();
  expect((await db.payment.findFirstOrThrow({ where: { orderId: order.id } })).status).toBe("FAILED");
  expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING"); // the order isn't confirmed
});

test("a refund can only be recorded for a cancelled, paid order", async ({ page }) => {
  const confirmed = await make({ status: "CONFIRMED", payment: "SUCCESS" });
  await page.goto(`/admin/orders/${confirmed.id}`);
  await expect(page.getByText("To refund a paid order, cancel it first.")).toBeVisible();
  await expect(page.getByRole("button", { name: /as refunded/ })).toHaveCount(0);

  const cancelled = await make({ status: "CANCELLED", payment: "SUCCESS" });
  await page.goto(`/admin/orders/${cancelled.id}`);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /as refunded/ }).click();
  await expect(statusWith(page, "Marked as refunded.")).toBeVisible();
  expect((await db.payment.findFirstOrThrow({ where: { orderId: cancelled.id } })).status).toBe("REFUNDED");
});

test("the dashboard points to payments that are waiting", async ({ page }) => {
  await make({ reference: ref() });
  await page.goto("/admin");
  await expect(page.getByRole("link", { name: /waiting for your verification/ })).toBeVisible();
});

test("the UPI ID, the name and the QR picture shown to customers come from Settings", async ({ page, browser }) => {
  const order = await make();
  await page.goto("/admin/settings");
  await page.locator('input[name="upiId"]').fill("bad id");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(alertWith(page, "Enter a UPI ID like name@bank")).toBeVisible();

  await page.locator('input[name="upiId"]').fill("zsarra.shop@okbank");
  await page.locator('input[name="upiName"]').fill("ZSARRA Fashion");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(statusWith(page, "Settings saved")).toBeVisible();

  await page.getByLabel("Your QR code image (PNG or JPG)").setInputFiles({ name: "my-qr.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Save QR code" }).click();
  await expect(statusWith(page, "QR code updated")).toBeVisible();
  await page.reload();
  await expect(page.getByAltText("Current payment QR code")).toHaveAttribute("src", /\/uploads\//);

  const ctx = await browser.newContext({ baseURL: "http://localhost:3100", storageState: LOGGED_OUT });
  const cp = await ctx.newPage();
  await cp.goto("/login");
  await cp.locator('input[name="email"]').fill(user.email);
  await cp.locator('input[name="password"]').fill(user.password);
  await cp.getByRole("button", { name: "Log in" }).click();
  await expect(cp).toHaveURL(/\/account$/);
  await cp.goto(`/pay/${order.id}`);
  await expect(cp.getByTestId("pay-upi-id")).toContainText("zsarra.shop@okbank");
  await expect(cp.getByText("ZSARRA Fashion").first()).toBeVisible();
  await expect(cp.getByRole("img", { name: /UPI QR code/ })).toHaveAttribute("src", /\/uploads\//);

  await page.getByRole("button", { name: "Go back to the default QR file" }).click();
  await page.reload();
  await expect(page.getByAltText("Current payment QR code")).toHaveAttribute("src", "/payment/upi-qr.png");
  await cp.reload();
  await expect(cp.getByRole("img", { name: /UPI QR code/ })).toHaveAttribute("src", "/payment/upi-qr.png");
  await ctx.close();
});
