import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BRAND } from "@/lib/brand";
import ActionForm from "@/components/ActionForm";
import AuthCard from "@/components/AuthCard";
import AuthField from "@/components/AuthField";
import { register } from "@/app/actions/auth";
import { getCurrentUser, safeNext } from "@/lib/session";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: { next?: string } }) {
  if (await getCurrentUser()) redirect(safeNext(searchParams.next));
  const next = safeNext(searchParams.next);
  return (
    <AuthCard
      title="Create account" subtitle="Sign up to track orders, save a wishlist and check out faster" banner={`Join ${BRAND} in a minute`}
      footer={<>Already have an account? <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-bold text-bronze hover:underline">Log in</Link></>}
    >
      <ActionForm action={register} submit="Create account" block className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <AuthField label="Full name" name="name" autoComplete="name" />
        <AuthField label="Email" name="email" type="email" autoComplete="email" />
        <AuthField label="Mobile number (optional)" name="phone" type="tel" required={false} autoComplete="tel" prefix="+91" />
        <AuthField label="Password" name="password" type="password" autoComplete="new-password" hint="At least 8 characters, with a letter and a number" />
        <AuthField label="Confirm password" name="confirm" type="password" autoComplete="new-password" />
        <p className="text-xs leading-relaxed text-ink/60">By creating an account, I agree to the <Link href="/policies/terms" className="font-bold text-bronze">Terms of Use</Link> and <Link href="/policies/privacy" className="font-bold text-bronze">Privacy Policy</Link>.</p>
      </ActionForm>
    </AuthCard>
  );
}
