"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { placeOrder } from "@/app/actions/checkout";

type Addr = { id: string; fullName: string; phone: string; line1: string; line2: string | null; city: string; state: string; pincode: string; isDefault: boolean };

export default function CheckoutForm({ addresses, totalLabel, disabled }: { addresses: Addr[]; totalLabel: string; disabled: boolean }) {
  const router = useRouter();
  const key = useRef<string | null>(null); // one key per checkout visit: a double click can't create two orders
  const [choice, setChoice] = useState(addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? "new");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    key.current ??= crypto.randomUUID();
    const f = new FormData(e.currentTarget);
    const v = (n: string) => String(f.get(n) ?? "");
    const payload = choice === "new"
      ? { key: key.current, saveAddress: f.get("saveAddress") === "on", address: { fullName: v("fullName"), phone: v("phone"), line1: v("line1"), line2: v("line2") || undefined, city: v("city"), state: v("state"), pincode: v("pincode") } }
      : { key: key.current, addressId: choice };

    const res = await placeOrder(payload);
    if (!res.orderId) { setError(res.error ?? "Something went wrong"); setBusy(false); return; }
    router.push(`/pay/${res.orderId}`); // the QR payment page
  }

  const input = (name: string, label: string, opts: { required?: boolean; autoComplete?: string } = {}) => (
    <label className="block text-sm">{label}{opts.required === false && " (optional)"}
      <input name={name} required={opts.required !== false} autoComplete={opts.autoComplete} className="field mt-1" />
    </label>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="mb-2 text-lg font-bold">Delivery address</legend>
        {addresses.map((a) => (
          <label key={a.id} className={`flex cursor-pointer gap-3 border p-4 text-sm ${choice === a.id ? "border-ink bg-paper" : "border-ink/20"}`}>
            <input type="radio" name="choice" checked={choice === a.id} onChange={() => setChoice(a.id)} />
            <span>{a.fullName}{a.isDefault && <span className="ml-2 text-bronze">Default</span>}<br />{a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />{a.city}, {a.state} {a.pincode} · {a.phone}</span>
          </label>
        ))}
        <label className={`flex cursor-pointer gap-3 border p-4 text-sm ${choice === "new" ? "border-ink bg-paper" : "border-ink/20"}`}>
          <input type="radio" name="choice" checked={choice === "new"} onChange={() => setChoice("new")} /> Use a new address
        </label>
        {choice === "new" && (
          <div className="grid gap-4 border border-ink/20 bg-paper p-4 sm:grid-cols-2">
            {input("fullName", "Recipient name", { autoComplete: "name" })}
            {input("phone", "Phone", { autoComplete: "tel" })}
            <div className="sm:col-span-2">{input("line1", "Address line 1", { autoComplete: "address-line1" })}</div>
            <div className="sm:col-span-2">{input("line2", "Address line 2", { required: false, autoComplete: "address-line2" })}</div>
            {input("city", "City", { autoComplete: "address-level2" })}
            {input("state", "State", { autoComplete: "address-level1" })}
            {input("pincode", "Pincode", { autoComplete: "postal-code" })}
            <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" name="saveAddress" /> Save to my address book</label>
          </div>
        )}
      </fieldset>
      {error && <p role="alert" className="border border-ink bg-paper p-3 text-sm">{error}</p>}
      <button className="btn-primary w-full py-3.5" disabled={busy || disabled}>{busy ? "Please wait…" : `Pay ${totalLabel} by UPI`}</button>
      <p className="text-xs text-ink/60">On the next page you'll see a UPI QR code. Scan it with any UPI app, pay the exact amount and send us the reference number. Your items are held for 1 hour while you pay.</p>
    </form>
  );
}
