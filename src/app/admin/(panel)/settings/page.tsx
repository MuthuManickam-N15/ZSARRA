import type { Metadata } from "next";
import ActionForm, { Field } from "@/components/ActionForm";
import ConfirmButton from "@/components/ConfirmButton";
import BannerForm from "@/components/BannerForm";
import QrForm from "@/components/QrForm";
import { deleteBanner, resetQrImage, saveSettings, toggleBanner } from "@/app/actions/admin2";
import { db } from "@/lib/db";
import { DEFAULT_QR_IMAGE, getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Store settings", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Settings() {
  const [s, banners] = await Promise.all([getSettings(), db.banner.findMany({ orderBy: { position: "asc" } })]);
  return (
    <div className="max-w-3xl space-y-12">
      <h1 className="text-xl font-bold md:text-2xl">Store settings</h1>

      <section><h2 className="mb-3 text-base font-bold">General, shipping and tax</h2>
        <ActionForm action={saveSettings} submit="Save settings" className="grid max-w-xl gap-4 sm:grid-cols-2">
          <Field label="Store name" name="storeName" defaultValue={s.storeName} />
          <Field label="Contact email" name="storeEmail" type="email" defaultValue={s.storeEmail} />
          <Field label="Shipping charge (₹)" name="shippingCharge" defaultValue={String(s.shippingCharge / 100)} />
          <Field label="Free shipping above (₹)" name="freeShippingThreshold" defaultValue={String(s.freeShippingThreshold / 100)} hint="Enter 0 to never offer free shipping" />
          <Field label="Tax (%)" name="taxPercent" defaultValue={String(s.taxPercent)} hint="Confirm the correct rate with your accountant" />
          <Field label="UPI ID" name="upiId" defaultValue={s.upiId} hint="Shown under the QR code, for example name@bank" />
          <Field label="Name on the UPI account" name="upiName" defaultValue={s.upiName} />
          <label className="flex items-center gap-2 self-center text-sm"><input type="checkbox" name="paymentsEnabled" defaultChecked={s.paymentsEnabled} /> Accept orders (customers pay by UPI QR)</label>
        </ActionForm>
      </section>

      <section aria-labelledby="qr"><h2 id="qr" className="mb-3 text-base font-bold">Payment QR code</h2>
        <div className="flex flex-wrap items-start gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.qrImageUrl || DEFAULT_QR_IMAGE} alt="Current payment QR code" className="h-44 w-44 border border-ink/15 bg-white object-contain" />
          <div className="max-w-md space-y-3 text-sm text-ink/70">
            <p>Customers see this QR code on the payment page. Upload your real UPI QR image here, or replace the file <code className="font-mono text-xs">public/payment/upi-qr.png</code> in the project and redeploy. Also set your real UPI ID above.</p>
            <QrForm />
            {s.qrImageUrl && <form action={resetQrImage}><button className="underline hover:text-bronze">Go back to the default QR file</button></form>}
          </div>
        </div>
      </section>

      <section><h2 className="mb-3 text-base font-bold">Home page banners ({banners.length})</h2>
        {banners.length === 0 ? <p className="mb-4 border border-ink/20 bg-paper p-5 text-sm">No banners have been added yet. Fill in the form below and click “Add banner”. The Hide, Show and Delete buttons appear next to each banner once you add one.</p> : (
          <ul className="mb-6 divide-y divide-ink/15 border border-ink/20 bg-paper">
            {banners.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-4 p-3 text-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.imageUrl} alt="" className="h-16 w-12 object-cover" />
                <div className="flex-1"><p className="font-medium">{b.title}</p><p className="text-xs text-ink/60">{b.href} · {b.active ? "Showing" : "Hidden"}</p></div>
                <form action={toggleBanner}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="active" value={b.active ? "0" : "1"} /><button className="underline hover:text-bronze">{b.active ? "Hide" : "Show"}</button></form>
                <form action={deleteBanner}><input type="hidden" name="id" value={b.id} /><ConfirmButton message={`Delete the banner “${b.title}”?`} className="underline hover:text-bronze">Delete</ConfirmButton></form>
              </li>))}
          </ul>)}
        <BannerForm />
        <p className="mt-3 text-xs text-ink/60">Featured products are chosen with the “Featured” checkbox on each product.</p>
      </section>
    </div>
  );
}
