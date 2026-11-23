"use client";
import { useFormState, useFormStatus } from "react-dom";
import type { FormState } from "@/app/actions/auth";

function Submit({ label, block }: { label: string; block?: boolean }) {
  const { pending } = useFormStatus();
  return <button className={`btn-primary ${block ? "w-full py-3.5 text-[15px]" : ""}`} disabled={pending}>{pending ? "Please wait…" : label}</button>;
}

export default function ActionForm({ action, submit, children, className = "space-y-4", block = false }: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  submit: string; children: React.ReactNode; className?: string; block?: boolean;
}) {
  const [state, formAction] = useFormState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && <p role="alert" className="border border-ink bg-paper p-3 text-sm">{state.error}</p>}
      {state?.ok && <p role="status" className="border border-bronze bg-paper p-3 text-sm">{state.ok}</p>}
      <Submit label={submit} block={block} />
    </form>
  );
}

export function Field({ label, name, type = "text", required = true, autoComplete, defaultValue, hint }: {
  label: string; name: string; type?: string; required?: boolean; autoComplete?: string; defaultValue?: string | null; hint?: string;
}) {
  return (
    <label className="block text-sm">{label}{!required && " (optional)"}
      <input name={name} type={type} required={required} autoComplete={autoComplete} defaultValue={defaultValue ?? ""} className="field mt-1" />
      {hint && <span className="mt-1 block text-xs text-ink/60">{hint}</span>}
    </label>
  );
}
