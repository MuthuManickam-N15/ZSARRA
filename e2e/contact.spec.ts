import { expect, test } from "@playwright/test";
import { LOGGED_OUT } from "./helpers";

test.use({ storageState: LOGGED_OUT });

test("the contact page shows the phone number, email and address with working links", async ({ page }) => {
  await page.goto("/contact");
  await expect(page.getByRole("heading", { level: 1, name: "Contact us" })).toBeVisible();
  await expect(page.locator('a[href="tel:+918754158897"]').first()).toBeVisible();
  await expect(page.getByText("+91 87541 58897").first()).toBeVisible();
  await expect(page.locator('a[href="mailto:zsarrafashion@gmail.com"]').first()).toBeVisible();
  await expect(page.getByText("zsarrafashion@gmail.com").first()).toBeVisible();
  await expect(page.getByText("Pongalur, Tiruppur - 641667").first()).toBeVisible();
  await expect(page.locator('a[href^="https://www.google.com/maps/search/"]').first()).toBeVisible();
});

for (const path of ["/", "/men", "/faq", "/policies/returns", "/products/linen-overshirt"]) {
  test(`the footer on ${path} shows the same contact details`, async ({ page }) => {
    await page.goto(path);
    const footer = page.locator("footer");
    await expect(footer.locator('a[href="tel:+918754158897"]')).toBeVisible();
    await expect(footer.locator('a[href="mailto:zsarrafashion@gmail.com"]')).toBeVisible();
    await expect(footer).toContainText("Pongalur, Tiruppur - 641667");
  });
}

test("the FAQ and the policies mention how to reach the store", async ({ page }) => {
  await page.goto("/faq");
  await expect(page.getByText("How can I contact you?")).toBeVisible();
  await page.goto("/policies/shipping");
  await expect(page.getByText(/Questions\? Call/)).toBeVisible();
});

test("the FAQ explains how payment works", async ({ page }) => {
  await page.goto("/faq");
  await page.getByText("Which payment methods do you accept?").click();
  await expect(page.getByText(/scan it with Google Pay, PhonePe, Paytm/i)).toBeVisible();
});
