// Sets up the PRODUCTION database from your own computer.
//   npm run db:prod -- migrate     create / update the tables
//   npm run db:prod -- admin       create the admin account from ADMIN_EMAIL / ADMIN_PASSWORD
//   npm run db:prod -- admin --reset   set a new password for that admin
//   npm run db:prod -- sample      (optional) add the five demo products and categories
// It reads .env.netlify (copy .env.netlify.example). Use the DIRECT (non-pooled) database address there.
import dotenv from "dotenv";
import fs from "node:fs";
import readline from "node:readline/promises";
import { spawnSync } from "node:child_process";

const envFile = ".env.netlify";
if (!fs.existsSync(envFile)) { console.error(`Create ${envFile} first (copy .env.netlify.example) and put your PRODUCTION database address in it.`); process.exit(1); }
dotenv.config({ path: envFile, override: true });

const url = process.env.DATABASE_URL;
if (!url) { console.error(`DATABASE_URL is missing in ${envFile}`); process.exit(1); }
const u = new URL(url);
const where = `${u.hostname}${u.pathname}`;
const cmd = process.argv[2];
if (!["migrate", "admin", "sample"].includes(cmd ?? "")) { console.error("Usage: npm run db:prod -- migrate | admin [--reset] | sample"); process.exit(1); }

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
console.log(`\nThis will run "${cmd}" on the PRODUCTION database:\n  ${where}`);
if ((await rl.question("Type yes to continue: ")).trim().toLowerCase() !== "yes") { rl.close(); console.log("Cancelled."); process.exit(0); }
rl.close();

const run = (c) => { const r = spawnSync(c, { stdio: "inherit", shell: true, env: process.env }); if (r.status !== 0) process.exit(r.status ?? 1); };

if (cmd === "migrate") {
  const has = fs.existsSync("prisma/migrations") && fs.readdirSync("prisma/migrations").some((f) => f !== "migration_lock.toml");
  if (has) run("npx prisma migrate deploy");
  else { console.log("No migration files found: creating the tables from schema.prisma instead."); run("npx prisma db push --skip-generate"); }
  console.log("\nDatabase is up to date.");
} else if (cmd === "sample") {
  run("npx tsx prisma/seed.ts");
} else {
  const email = process.env.ADMIN_EMAIL, password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) { console.error(`Set ADMIN_EMAIL and an ADMIN_PASSWORD of 12+ characters in ${envFile}`); process.exit(1); }
  const { PrismaClient } = await import("@prisma/client");
  const bcrypt = (await import("bcryptjs")).default;
  const db = new PrismaClient();
  const passwordHash = await bcrypt.hash(password, 12);
  const reset = process.argv.includes("--reset");
  await db.user.upsert({ where: { email }, update: reset ? { passwordHash, role: "ADMIN", active: true } : {}, create: { email, name: "Store Admin", role: "ADMIN", passwordHash } });
  await db.$disconnect();
  console.log(reset ? `Admin password reset for ${email}.` : `Admin ready: ${email} (an existing account keeps its password; use --reset to change it).`);
}
