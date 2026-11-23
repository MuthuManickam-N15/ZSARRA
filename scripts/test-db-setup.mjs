// Prepares the SEPARATE test database and seeds it. Never touches your real database.
import dotenv from "dotenv";
import fs from "node:fs";
import { execSync } from "node:child_process";

dotenv.config({ path: ".env.test", override: true });
const url = process.env.DATABASE_URL;
if (!url || !/test/i.test(new URL(url).pathname)) {
  console.error("Refusing to continue: DATABASE_URL in .env.test must point at a database whose name contains 'test'.");
  process.exit(1);
}

const run = (cmd) => execSync(cmd, { stdio: "inherit", env: process.env });
const hasMigrations = fs.existsSync("prisma/migrations") && fs.readdirSync("prisma/migrations").some((f) => f !== "migration_lock.toml");

if (hasMigrations) {
  run("npx prisma migrate deploy");
  run("npx prisma db push --skip-generate"); // also picks up schema changes you haven't made a migration for yet (safe on this throwaway database)
} else {
  // No migration files in this folder: build the tables straight from schema.prisma (safe for a throwaway test database).
  console.log("No migration files found; creating tables from schema.prisma instead.");
  run("npx prisma db push --skip-generate");
}
run("npx tsx prisma/seed.ts");
console.log("Test database is ready.");
