"use server";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { allow, clearLimit } from "@/lib/rate-limit";
import { createSession, destroySession, getCurrentUser, safeNext } from "@/lib/session";
import { addressSchema, firstError, loginSchema, profileSchema, registerSchema } from "@/lib/validation";

export type FormState = { error?: string; ok?: string } | undefined;

const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12); // equalises timing when the email is unknown
const ip = () => headers().get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
const text = (f: FormData) => Object.fromEntries([...f.entries()].filter(([, v]) => typeof v === "string"));

export async function register(_: FormState, form: FormData): Promise<FormState> {
  if (!allow(`reg:${ip()}`, 10, 3_600_000)) return { error: "Too many sign-up attempts. Try again later." };
  const parsed = registerSchema.safeParse(text(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { name, email, phone, password } = parsed.data;

  if (await db.user.findUnique({ where: { email } })) return { error: "An account with this email already exists. Log in instead." };
  const user = await db.user.create({ data: { name, email, phone, passwordHash: await bcrypt.hash(password, 12) } });
  await createSession(user.id);
  redirect(safeNext(form.get("next")));
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(text(form));
  if (!parsed.success) return { error: "Enter your email and password" };
  const { email, password } = parsed.data;
  const key = `login:${email}:${ip()}`;
  if (!allow(key, 5, 15 * 60_000)) return { error: "Too many attempts. Try again in 15 minutes." };

  const user = await db.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || !user.active) return { error: "Email or password is incorrect" };

  clearLimit(key);
  await db.session.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } });
  await createSession(user.id);
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/");
}

export async function updateProfile(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parsed = profileSchema.safeParse(text(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  await db.user.update({ where: { id: user.id }, data: { name: parsed.data.name, phone: parsed.data.phone ?? null } });
  revalidatePath("/account");
  return { ok: "Profile saved" };
}

export async function addAddress(_: FormState, form: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parsed = addressSchema.safeParse(text(form));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const count = await db.address.count({ where: { userId: user.id } });
  if (count >= 10) return { error: "You can save up to 10 addresses" };
  await db.address.create({ data: { ...parsed.data, line2: parsed.data.line2 || null, userId: user.id, isDefault: count === 0 } });
  revalidatePath("/account");
  return { ok: "Address saved" };
}

export async function deleteAddress(form: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = String(form.get("id") ?? "");
  // userId in the filter stops one customer deleting another's address
  await db.address.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/account");
}

export async function setDefaultAddress(form: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = String(form.get("id") ?? "");
  const owned = await db.address.findFirst({ where: { id, userId: user.id } });
  if (!owned) return;
  await db.$transaction([
    db.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } }),
    db.address.update({ where: { id }, data: { isDefault: true } }),
  ]);
  revalidatePath("/account");
}
