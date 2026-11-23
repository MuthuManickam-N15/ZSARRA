import { expect, test } from "@playwright/test";
import { alertWith, customerEmail, LOGGED_OUT, PASSWORD, uniqueEmail } from "./helpers";

test.use({ storageState: LOGGED_OUT });

async function register(page: import("@playwright/test").Page, v: { email: string; password: string; confirm?: string }) {
  await page.goto("/register");
  await page.locator('input[name="name"]').fill("Reg Test");
  await page.locator('input[name="email"]').fill(v.email);
  await page.locator('input[name="password"]').fill(v.password);
  await page.locator('input[name="confirm"]').fill(v.confirm ?? v.password);
  await page.getByRole("button", { name: "Create account" }).click();
}
async function login(page: import("@playwright/test").Page, email: string, password: string, next = "") {
  await page.goto(`/login${next}`);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

test.describe("registration", () => {
  test("rejects weak passwords and mismatches with clear messages", async ({ page }) => {
    await register(page, { email: uniqueEmail("weak"), password: "abc1" });
    await expect(alertWith(page, "at least 8 characters")).toBeVisible();
    await register(page, { email: uniqueEmail("weak"), password: "abcdefgh" });
    await expect(alertWith(page, "needs a number")).toBeVisible();
    await register(page, { email: uniqueEmail("weak"), password: PASSWORD, confirm: "Different123" });
    await expect(alertWith(page, "don't match")).toBeVisible();
  });
  test("rejects an email that already has an account", async ({ page }) => {
    await register(page, { email: customerEmail(), password: PASSWORD });
    await expect(alertWith(page, "already exists")).toBeVisible();
  });
});

test.describe("login and logout", () => {
  test("wrong password and unknown email give the same message", async ({ page }) => {
    await login(page, customerEmail(), "WrongPass999");
    await expect(alertWith(page, "Email or password is incorrect")).toBeVisible();
    await login(page, uniqueEmail("ghost"), PASSWORD);
    await expect(alertWith(page, "Email or password is incorrect")).toBeVisible();
  });
  test("repeated failures are rate limited", async ({ page }) => {
    const email = uniqueEmail("brute");
    for (let i = 0; i < 6; i++) await login(page, email, `Wrong${i}pass`);
    await expect(alertWith(page, "Too many attempts")).toBeVisible();
  });
  test("a customer can log in, see their name, and log out", async ({ page }) => {
    await login(page, customerEmail(), PASSWORD);
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole("heading", { name: /Hello, E2E/ })).toBeVisible();
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/localhost:3100\/$/);
    await expect(page.getByRole("link", { name: "Log in" }).first()).toBeVisible();
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login/);
  });
  test("logging in can't redirect to another website", async ({ page }) => {
    for (const next of ["?next=//evil.example", "?next=%2F%5Cevil.example", "?next=https://evil.example"]) {
      await login(page, customerEmail(), PASSWORD, next);
      await expect(page).toHaveURL(/localhost:3100\/account$/);
      await page.getByRole("button", { name: "Log out" }).click();
    }
  });
});
