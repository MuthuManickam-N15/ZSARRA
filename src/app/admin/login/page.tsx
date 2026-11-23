import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BRAND } from "@/lib/brand";
import ActionForm from "@/components/ActionForm";
import AuthCard from "@/components/AuthCard";
import AuthField from "@/components/AuthField";
import { adminLogin } from "@/app/actions/admin";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Admin login", robots: { index: false } };

export default async function AdminLogin() {
  const u = await getCurrentUser();
  if (u?.role === "ADMIN") redirect("/admin");
  return (
    <AuthCard title="Admin login" subtitle="Sign in to manage the store" banner={`${BRAND} admin`}>
      <ActionForm action={adminLogin} submit="Log in" block className="space-y-4">
        <AuthField label="Email" name="email" type="email" autoComplete="username" />
        <AuthField label="Password" name="password" type="password" autoComplete="current-password" />
      </ActionForm>
    </AuthCard>
  );
}
