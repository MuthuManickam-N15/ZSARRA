// Restores a backup made by `npm run db:backup`. This REPLACES everything currently in the database.
//   npm run db:restore -- backups\zsarra-2026-10-19T10-30-00.dump
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { spawnSync } from "node:child_process";

dotenv.config();
const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error("Usage: npm run db:restore -- <backup file>\nBackups in this folder:\n  " + (fs.existsSync("backups") ? fs.readdirSync("backups").filter((f) => f.endsWith(".dump")).join("\n  ") || "(none)" : "(none)"));
  process.exit(1);
}
const raw = process.env.DATABASE_URL;
if (!raw) { console.error("DATABASE_URL is not set in .env"); process.exit(1); }
const u = new URL(raw);
const dbName = u.pathname.slice(1);
const env = { ...process.env, PGPASSWORD: decodeURIComponent(u.password) };
u.password = ""; u.search = "";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
console.log(`\nThis will DELETE all current data in the database "${dbName}" and replace it with:\n  ${file}\nStop the website (npm run dev) first.`);
const answer = await rl.question(`Type the database name (${dbName}) to continue: `);
rl.close();
if (answer.trim() !== dbName) { console.log("Cancelled. Nothing was changed."); process.exit(0); }

const tool = process.env.PG_BIN ? path.join(process.env.PG_BIN, "pg_restore") : "pg_restore";
const r = spawnSync(tool, ["--clean", "--if-exists", "--no-owner", "--dbname", u.toString(), file], { stdio: "inherit", env });
if (r.error) { console.error("Could not run pg_restore. Install the PostgreSQL command line tools or set PG_BIN."); process.exit(1); }
// pg_restore may print harmless warnings about objects that didn't exist yet; a non-zero code with --clean is usually that.
console.log(r.status === 0 ? "\nRestore finished." : "\nRestore finished with warnings (normal when restoring into a fresh database). Check the site, then run: npm run dev");
console.log("If your pictures were stored locally, extract uploads-*.tar.gz into the public folder:  tar -xzf backups\\uploads-....tar.gz -C public");
