import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BRAND } from "@/lib/brand";
import ActionForm from "@/components/ActionForm";
import AuthCard from "@/components/AuthCard";
import AuthField from "@/components/AuthField";
import { login } from "@/app/actions/auth";
import { getCurrentUser, safeNext } from "@/lib/session";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  if (await getCurrentUser()) redirect(safeNext(searchParams.next));
  const next = safeNext(searchParams.next);
  return (
    <AuthCard
      title="Log in" subtitle="Enter your email and password to continue" banner={`Welcome back to ${BRAND}`}
      footer={<>New to {BRAND}? <Link href={`/register?next=${encodeURIComponent(next)}`} className="font-bold text-bronze hover:underline">Create an account</Link></>}
    >
      <ActionForm action={login} submit="Log in" block className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <AuthField label="Email" name="email" type="email" autoComplete="email" />
        <AuthField label="Password" name="password" type="password" autoComplete="current-password" />
        <p className="text-xs leading-relaxed text-ink/60">By continuing, I agree to the <Link href="/policies/terms" className="font-bold text-bronze">Terms of Use</Link> and <Link href="/policies/privacy" className="font-bold text-bronze">Privacy Policy</Link>.</p>
      </ActionForm>
      <p className="mt-5 text-sm text-ink/60">Having trouble logging in? <Link href="/contact" className="font-bold text-bronze hover:underline">Get help</Link></p>
    </AuthCard>
  );
}
