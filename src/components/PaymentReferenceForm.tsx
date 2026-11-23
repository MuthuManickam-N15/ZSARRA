"use client";
import ActionForm from "./ActionForm";
import { submitPaymentReference } from "@/app/actions/checkout";

export default function PaymentReferenceForm({ orderId, current }: { orderId: string; current?: string | null }) {
  return (
    <ActionForm action={submitPaymentReference} submit={current ? "Update reference number" : "Submit reference number"} block className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <label className="block text-sm font-semibold">UPI reference number (UTR)
        <input name="reference" required minLength={10} maxLength={22} defaultValue={current ?? ""} autoComplete="off" placeholder="12-digit number from your payment app" className="field mt-1 font-normal" />
      </label>
    </ActionForm>
  );
}
