import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import { db } from "./db";

export const SESSION_COOKIE = "zsarra_session";
const DAYS = 30;
const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + DAYS * 86_400_000);
  await db.session.create({ data: { tokenHash: hash(token), userId, expiresAt } });
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt,
  });
}

export async function destroySession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hash(token) } });
  cookies().delete(SESSION_COOKIE);
}

/** Current signed-in user, or null. Never returns the password hash. */
export const getCurrentUser = cache(async () => {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await db.session.findUnique({
    where: { tokenHash: hash(token) },
    include: { user: { select: { id: true, email: true, name: true, phone: true, role: true, active: true } } },
  });
  if (!s || s.expiresAt < new Date() || !s.user.active) return null;
  return s.user;
});

export async function requireUser(next = "/account") {
  const u = await getCurrentUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(next)}`);
  return u;
}

/** Server-side admin gate. Use in every admin page and privileged action. */
export async function requireAdmin() {
  const u = await getCurrentUser();
  if (!u || u.role !== "ADMIN") redirect("/admin/login");
  return u;
}

export const safeNext = (n: unknown) =>
  typeof n === "string" && n.startsWith("/") && !n.startsWith("//") && !n.includes("\\") && !/[\u0000-\u001f]/.test(n) ? n : "/account";
