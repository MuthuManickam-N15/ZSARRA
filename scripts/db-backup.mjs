// Full backup of the database (products, customers, orders, payments, settings) into backups/zsarra-<date>.dump
// Needs PostgreSQL's command line tools. If "pg_dump" isn't found, set PG_BIN to the bin folder, for example
//   set PG_BIN=C:\Program Files\PostgreSQL\16\bin
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

dotenv.config();
const raw = process.env.DATABASE_URL;
if (!raw) { console.error("DATABASE_URL is not set in .env"); process.exit(1); }

const u = new URL(raw);
const env = { ...process.env, PGPASSWORD: decodeURIComponent(u.password) }; // keeps the password out of the command line
u.password = ""; u.search = ""; // "?schema=public" is a Prisma-only option that pg_dump rejects

const dir = process.env.BACKUP_DIR || "backups";
fs.mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const file = path.join(dir, `zsarra-${stamp}.dump`);
const tool = (n) => (process.env.PG_BIN ? path.join(process.env.PG_BIN, n) : n);

const r = spawnSync(tool("pg_dump"), ["--format=custom", "--no-owner", "--file", file, u.toString()], { stdio: "inherit", env });
if (r.error || r.status !== 0) {
  console.error(r.error ? "\nCould not run pg_dump. Install the PostgreSQL command line tools, or set PG_BIN to PostgreSQL's bin folder." : "\nBackup failed (see the message above).");
  process.exit(1);
}
console.log(`Database backup saved: ${file} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);

// Pictures stored on this computer (development mode) are not inside the database: back them up too.
const uploads = path.join("public", "uploads");
if (fs.existsSync(uploads) && fs.readdirSync(uploads).length > 0) {
  const tar = path.join(dir, `uploads-${stamp}.tar.gz`);
  const t = spawnSync("tar", ["-czf", tar, "-C", "public", "uploads"], { stdio: "inherit" });
  console.log(t.status === 0 ? `Local pictures saved: ${tar}` : "Couldn't archive public/uploads. Copy that folder by hand.");
} else {
  console.log("Pictures: stored in Cloudinary (or none yet), so they are not affected by a database reset.");
}
