import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (f: string) => fs.readFileSync(f, "utf8");
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

describe("Netlify readiness", () => {
  it("netlify.toml builds with npm, uses the Next.js runtime and Node 20", () => {
    const t = read("netlify.toml");
    expect(t).toMatch(/command\s*=\s*"npm run build"/);
    expect(t).toMatch(/@netlify\/plugin-nextjs/);
    expect(t).toMatch(/NODE_VERSION\s*=\s*"20"/);
    expect(read(".nvmrc").trim()).toBe("20");
  });
  it("the database client is built for Netlify's servers as well as your computer", () => {
    const s = read("prisma/schema.prisma");
    expect(s).toMatch(/binaryTargets\s*=\s*\[[^\]]*"native"[^\]]*"rhel-openssl-3\.0\.x"/);
    expect(JSON.parse(read("package.json")).scripts.postinstall).toBe("prisma generate");
    expect(JSON.parse(read("package.json")).scripts.build).toContain("prisma generate");
  });
  it("the scheduled cleanup calls the cron route with the secret", () => {
    const f = read("netlify/functions/expire-orders.mts");
    expect(f).toContain("/api/cron/expire-orders");
    expect(f).toContain("CRON_SECRET");
    expect(f).toMatch(/schedule:\s*"\*\/10 \* \* \* \*"/);
  });
  it("the app never reads its own folder at run time (there is no such folder on Netlify), except the local-only upload fallback", () => {
    const offenders = walk("src").filter((f) => /\.(ts|tsx)$/.test(f) && /process\.cwd\(/.test(read(f)) && !f.replace(/\\/g, "/").endsWith("src/lib/upload.ts"));
    expect(offenders).toEqual([]);
    expect(read("src/components/Logo.tsx")).not.toMatch(/node:fs|existsSync/);
  });
  it("uploads on the live site can't fall back to the server's disk", () => {
    expect(read("src/lib/upload.ts")).toMatch(/NODE_ENV === "production"\) throw new UploadError/);
  });
  it("secrets files are git-ignored", () => {
    const ignored = read(".gitignore").split(/\r?\n/);
    for (const f of [".env", ".env.test", ".env.netlify", "node_modules", ".next"]) expect(ignored).toContain(f);
  });
  it("the schema has a Review model with one review per customer per product", () => {
    const s = read("prisma/schema.prisma");
    expect(s).toMatch(/model Review \{/);
    expect(s).toMatch(/@@unique\(\[productId, userId\]\)/);
  });
});
