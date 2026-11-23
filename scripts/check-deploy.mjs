// Catches the common reasons a Netlify build fails, without needing network access or a database.
//   npm run check:deploy
import fs from "node:fs";
import path from "node:path";
import { builtinModules } from "node:module";

const problems = [], warnings = [];
const fail = (m) => problems.push(m);
const IGNORE = new Set(["node_modules", ".next", ".git", ".netlify", ".auth", "test-results", "playwright-report", "backups"]);
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (IGNORE.has(e.name) ? [] : e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const all = walk(".").map((p) => p.replace(/\\/g, "/").replace(/^\.\//, ""));
const fileSet = new Set(all);
const code = all.filter((f) => (/\.(ts|tsx|mts)$/.test(f) && /^(src|tests|e2e|prisma|netlify)\//.test(f)) || f === "middleware.ts");
const text = Object.fromEntries(code.map((f) => [f, fs.readFileSync(f, "utf8")]));
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const deps = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]);
const builtins = new Set(builtinModules);

// ---- parse imports and exports ----
const EXTS = [".ts", ".tsx", ".mts", ".js", ".mjs", ".json", ".css"];
function resolve(from, spec) {
  let base;
  if (spec.startsWith("@/")) base = "src/" + spec.slice(2);
  else if (spec.startsWith(".")) base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  else return null;
  return [base, ...EXTS.map((e) => base + e), ...EXTS.map((e) => `${base}/index${e}`)].find((c) => fileSet.has(c)) ?? false;
}
function importsOf(file) {
  const t = text[file], out = [];
  for (const m of t.matchAll(/(?:^|\n)\s*(import|export)\s+(type\s+)?([^;"'`]*?)\s+from\s+["']([^"']+)["']/g)) out.push({ spec: m[4], clause: m[3], type: !!m[2], kind: m[1] });
  for (const m of t.matchAll(/(?:^|\n)\s*import\s+["']([^"']+)["']/g)) out.push({ spec: m[1], clause: "", type: false, kind: "import" });
  for (const m of t.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) out.push({ spec: m[1], clause: "", type: false, kind: "dynamic" });
  return out;
}
function exportsOf(file) {
  const t = text[file], names = new Set();
  for (const m of t.matchAll(/export\s+(?:async\s+)?function\s*\*?\s*([\w$]+)/g)) names.add(m[1]);
  for (const m of t.matchAll(/export\s+(?:declare\s+)?(?:const|let|var|class|enum|type|interface|abstract\s+class)\s+([\w$]+)/g)) names.add(m[1]);
  for (const m of t.matchAll(/export\s*\{([^}]*)\}/g)) m[1].split(",").forEach((p) => { const parts = p.trim().split(/\s+as\s+/); const n = (parts[1] ?? parts[0]).replace(/^type\s+/, "").trim(); if (n) names.add(n); });
  if (/export\s+default\b/.test(t)) names.add("default");
  return { names, wildcard: /export\s*\*\s*from/.test(t) };
}
const parsed = Object.fromEntries(code.map((f) => [f, importsOf(f)]));
const exp = {};

for (const f of code) {
  for (const imp of parsed[f]) {
    const target = resolve(f, imp.spec);
    if (target === false) { fail(`${f}: cannot find "${imp.spec}" (file missing, or the capital letters in the name don't match: Netlify's servers are case-sensitive)`); continue; }
    if (target === null) {
      if (imp.spec.startsWith("node:") || builtins.has(imp.spec.split("/")[0])) continue;
      const name = imp.spec.startsWith("@") ? imp.spec.split("/").slice(0, 2).join("/") : imp.spec.split("/")[0];
      if (!deps.has(name)) fail(`${f}: imports "${imp.spec}" but "${name}" is not in package.json`);
      continue;
    }
    if (!/\.(ts|tsx|mts)$/.test(target) || imp.kind === "dynamic" || !imp.clause.trim()) continue;
    const e = (exp[target] ??= exportsOf(target));
    if (e.wildcard) continue;
    const clause = imp.clause.replace(/\*\s+as\s+\w+/, "").trim();
    const def = /^([\w$]+)\s*(,|$)/.exec(clause)?.[1];
    if (def && !clause.startsWith("{") && !e.names.has("default")) fail(`${f}: "${imp.spec}" has no default export`);
    for (const part of (/\{([^}]*)\}/.exec(clause)?.[1] ?? "").split(",")) {
      const n = part.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, "").trim();
      if (n && !e.names.has(n)) fail(`${f}: "${n}" is not exported by ${imp.spec} (${target})`);
    }
  }
}

// ---- "use server" files may only export async functions (and types) ----
const isServerFile = (f) => /^\s*(?:\/\*[\s\S]*?\*\/\s*)?["']use server["']/.test(text[f] ?? "");
for (const f of code.filter((f) => f.startsWith("src/") && isServerFile(f))) {
  for (const m of text[f].matchAll(/export\s+(?!async\s+function|type\s|interface\s)(function|const|let|var|class|enum|default)\b[^\n]*/g)) fail(`${f}: a "use server" file may only export async functions, but has: ${m[0].slice(0, 70)}`);
}

// ---- client components must not reach server-only code ----
const isClientFile = (f) => /^\s*["']use client["']/.test(text[f] ?? "");
for (const start of code.filter((f) => f.startsWith("src/") && isClientFile(f))) {
  const seen = new Set(), queue = [start];
  while (queue.length) {
    const f = queue.pop();
    if (seen.has(f)) continue; seen.add(f);
    const t = text[f];
    if (/["']server-only["']/.test(t)) fail(`${start}: runs in the browser but reaches ${f}, which is server-only`);
    for (const m of t.matchAll(/process\.env\.([A-Z0-9_]+)/g)) if (!/^NEXT_PUBLIC_|^NODE_ENV$/.test(m[1])) fail(`${f}: reads process.env.${m[1]} in browser code (it would be empty there)`);
    for (const imp of parsed[f]) {
      if (imp.spec.startsWith("node:") || ["next/headers"].includes(imp.spec) || (builtins.has(imp.spec) && !imp.spec.startsWith("."))) fail(`${start}: runs in the browser but reaches ${f}, which imports "${imp.spec}"`);
      if (!imp.type && (imp.spec === "@prisma/client" || imp.spec === "@/lib/db")) fail(`${start}: runs in the browser but reaches ${f}, which imports "${imp.spec}"`);
      const target = resolve(f, imp.spec);
      if (target && /\.(ts|tsx)$/.test(target) && !isServerFile(target)) queue.push(target);
    }
  }
}

// ---- Next.js file conventions ----
const PAGE_OK = new Set(["default", "metadata", "generateMetadata", "viewport", "generateViewport", "dynamic", "dynamicParams", "revalidate", "fetchCache", "runtime", "preferredRegion", "maxDuration", "generateStaticParams"]);
const ROUTE_OK = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "dynamic", "dynamicParams", "revalidate", "fetchCache", "runtime", "preferredRegion", "maxDuration"]);
for (const f of code.filter((f) => /^src\/app\/.*\/?(page|layout|template|loading|not-found|error)\.tsx$/.test(f))) {
  const { names } = (exp[f] ??= exportsOf(f));
  if (!names.has("default")) fail(`${f}: needs a default export`);
  for (const n of names) if (!PAGE_OK.has(n)) fail(`${f}: exports "${n}", which Next.js doesn't allow from a page or layout file`);
}
for (const f of code.filter((f) => /^src\/app\/.*route\.ts$/.test(f))) {
  const { names } = (exp[f] ??= exportsOf(f));
  if (![...names].some((n) => /^(GET|POST|PUT|PATCH|DELETE)$/.test(n))) fail(`${f}: a route file must export GET, POST, PUT, PATCH or DELETE`);
  for (const n of names) if (!ROUTE_OK.has(n)) fail(`${f}: exports "${n}", which Next.js doesn't allow from a route file`);
}

// ---- environment variables ----
const envFiles = [...code.filter((f) => f.startsWith("src/") || f.startsWith("netlify/") || f === "middleware.ts"), "next.config.mjs"];
const used = new Set();
for (const f of envFiles) {
  const t = text[f] ?? fs.readFileSync(f, "utf8");
  for (const m of t.matchAll(/process\.env\.([A-Z0-9_]+)/g)) used.add(m[1]);
  for (const m of t.matchAll(/process\.env\[\s*["']([A-Z0-9_]+)["']\s*\]/g)) used.add(m[1]);
  for (const m of t.matchAll(/\{([^}]*)\}\s*=\s*process\.env\b/g)) for (const part of m[1].split(",")) { const n = part.split(":")[0].trim(); if (/^[A-Z0-9_]+$/.test(n)) used.add(n); } // const { A: a, B } = process.env
}
const platform = new Set(["NODE_ENV", "URL", "DEPLOY_URL", "DEPLOY_PRIME_URL", "NEXT_RUNTIME"]);
const example = fs.readFileSync(".env.example", "utf8");
const netlifyDoc = fs.existsSync("NETLIFY.md") ? fs.readFileSync("NETLIFY.md", "utf8") : "";
for (const v of used) if (!platform.has(v) && !new RegExp(`^${v}=`, "m").test(example)) fail(`process.env.${v} is used but missing from .env.example`);
for (const v of used) if (!platform.has(v) && !netlifyDoc.includes(v)) warnings.push(`${v} is used but not explained in NETLIFY.md`);

// ---- project settings ----
const need = (cond, msg) => { if (!cond) fail(msg); };
const toml = fs.existsSync("netlify.toml") ? fs.readFileSync("netlify.toml", "utf8") : "";
need(/npm run build/.test(toml) && /@netlify\/plugin-nextjs/.test(toml) && /NODE_VERSION\s*=\s*"20"/.test(toml), "netlify.toml must set the build command, the Next.js plugin and Node 20");
need(/prisma generate/.test(pkg.scripts?.build ?? "") && pkg.scripts?.postinstall === "prisma generate", "package.json must run `prisma generate` in build and postinstall");
need(fs.readFileSync("prisma/schema.prisma", "utf8").includes("rhel-openssl-3.0.x"), "prisma/schema.prisma needs the rhel-openssl-3.0.x engine for Netlify");
need(/ignoreBuildErrors:\s*true/.test(fs.readFileSync("next.config.mjs", "utf8")), "next.config.mjs should not let type findings stop the hosted build");
need(fs.existsSync(".nvmrc"), ".nvmrc is missing");
for (const f of ["public/payment/upi-qr.png", "public/logo.png", "public/logo-mark.png", "src/app/icon.png", "netlify/functions/expire-orders.mts", "public/samples/zsarra-products-sample.xlsx"]) need(fileSet.has(f), `${f} is missing`);
const ignore = fs.readFileSync(".gitignore", "utf8").split(/\r?\n/);
for (const f of [".env", ".env.netlify", ".env.test", "node_modules", ".next"]) need(ignore.includes(f), `.gitignore must list ${f}`);
need(all.every((f) => !/^\.env($|\.)/.test(f) || /\.example$/.test(f)), `a real .env file is inside the project folder (${all.filter((f) => /^\.env($|\.)/.test(f) && !/\.example$/.test(f)).join(", ")}). Delete it before uploading`);

// ---- file names ----
const lower = new Map();
for (const f of all) { const k = f.toLowerCase(); if (lower.has(k) && lower.get(k) !== f) fail(`two files differ only by capital letters: ${lower.get(k)} and ${f}`); lower.set(k, f); }
for (const f of all) { if (/[^A-Za-z0-9._\-()\[\]\/ ]/.test(f)) warnings.push(`unusual characters in file name: ${f}`); if (f.length > 160) warnings.push(`very long path (${f.length}): ${f}`); }

console.log(`Checked ${code.length} code files, ${all.length} files in total.`);
console.log(`Environment variables the code reads: ${[...used].filter((v) => !platform.has(v)).sort().join(", ")}`);
for (const w of warnings) console.log(`  note: ${w}`);
if (problems.length) { console.log(`\n${problems.length} PROBLEM(S) found:`); for (const p of problems) console.log(`  x ${p}`); process.exit(1); }
console.log("\nAll checks passed.");
