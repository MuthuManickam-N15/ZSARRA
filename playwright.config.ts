import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: ".env.test", override: true });
if (!/test/i.test(new URL(process.env.DATABASE_URL ?? "x://x/").pathname)) {
  throw new Error("Refusing to run: DATABASE_URL in .env.test must point at a database whose name contains 'test'.");
}

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1, // tests share one database, so they run one at a time
  timeout: 60_000,
  expect: { timeout: 15_000 }, // the first visit to each page compiles it in dev mode
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: { command: "npx next dev -p 3100", url: "http://localhost:3100/faq", timeout: 180_000, reuseExistingServer: false },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"], testIgnore: [/auth\.setup\.ts/, /mobile\.spec\.ts/] },
    { name: "mobile", use: { ...devices["Pixel 5"] }, dependencies: ["setup"], testMatch: /mobile\.spec\.ts/ },
  ],
});
