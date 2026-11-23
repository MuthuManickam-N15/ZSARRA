// Wipes the database and rebuilds it empty, but ONLY after taking a backup first.
import dotenv from "dotenv";
import fs from "node:fs";
import readline from "node:readline/promises";
import { spawnSync } from "node:child_process";

dotenv.config();
const dbName = new URL(process.env.DATABASE_URL ?? "x://x/").pathname.slice(1);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
console.log(`\nThis will erase ALL data in "${dbName}" (products, customers, orders). A backup is taken first.`);
const answer = await rl.question('Type RESET to continue: ');
rl.close();
if (answer.trim() !== "RESET") { console.log("Cancelled. Nothing was changed."); process.exit(0); }

const backup = spawnSync(process.execPath, ["scripts/db-backup.mjs"], { stdio: "inherit" });
if (backup.status !== 0) { console.error("\nBackup failed, so the reset was NOT done. Fix the backup first."); process.exit(1); }

const hasMigrations = fs.existsSync("prisma/migrations") && fs.readdirSync("prisma/migrations").some((f) => f !== "migration_lock.toml");
const cmd = hasMigrations ? "npx prisma migrate reset --force" : "npx prisma db push --force-reset";
const r = spawnSync(cmd, { stdio: "inherit", shell: true });
console.log(r.status === 0 ? "\nDatabase reset. Your backup is in the backups folder; restore it any time with npm run db:restore." : "\nReset failed.");
process.exit(r.status ?? 1);
