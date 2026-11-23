import type { Metadata } from "next";
import Link from "next/link";
import ActionForm, { Field } from "@/components/ActionForm";
import { addAddress, deleteAddress, logout, setDefaultAddress, updateProfile } from "@/app/actions/auth";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "My account" };
export const dynamic = "force-dynamic";

export default async function Account() {
  const user = await requireUser("/account");
  const addresses = await db.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { id: "asc" }] });

  return (
    <div className="container-page max-w-3xl space-y-14 py-16">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Hello, {user.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-ink/70">{user.email}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/account/orders" className="btn-outline">My orders</Link>
          <form action={logout}><button className="btn-outline">Log out</button></form>
        </div>
      </header>

      <section aria-labelledby="profile">
        <h2 id="profile" className="mb-4 text-lg font-bold">Profile</h2>
        <ActionForm action={updateProfile} submit="Save profile" className="max-w-md space-y-4">
          <Field label="Full name" name="name" defaultValue={user.name} autoComplete="name" />
          <Field label="Phone" name="phone" type="tel" required={false} defaultValue={user.phone} autoComplete="tel" />
        </ActionForm>
      </section>

      <section aria-labelledby="addresses">
        <h2 id="addresses" className="mb-4 text-lg font-bold">Address book</h2>
        {addresses.length === 0 ? (
          <p className="border border-ink/20 bg-paper p-6 text-sm">No saved addresses yet. Add one below to speed up checkout.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {addresses.map((a) => (
              <li key={a.id} className="border border-ink/20 bg-paper p-4 text-sm">
                <p className="font-medium">{a.fullName}{a.isDefault && <span className="ml-2 text-bronze">Default</span>}</p>
                <p>{a.line1}{a.line2 ? `, ${a.line2}` : ""}</p>
                <p>{a.city}, {a.state} {a.pincode}</p>
                <p>{a.phone}</p>
                <div className="mt-3 flex gap-4">
                  {!a.isDefault && <form action={setDefaultAddress}><input type="hidden" name="id" value={a.id} /><button className="underline hover:text-bronze">Make default</button></form>}
                  <form action={deleteAddress}><input type="hidden" name="id" value={a.id} /><button className="underline hover:text-bronze">Delete</button></form>
                </div>
              </li>
            ))}
          </ul>
        )}
        <h3 className="mb-3 mt-10 text-lg">Add an address</h3>
        <ActionForm action={addAddress} submit="Save address" className="grid max-w-xl gap-4 sm:grid-cols-2">
          <Field label="Recipient name" name="fullName" autoComplete="name" />
          <Field label="Phone" name="phone" type="tel" autoComplete="tel" />
          <div className="sm:col-span-2"><Field label="Address line 1" name="line1" autoComplete="address-line1" /></div>
          <div className="sm:col-span-2"><Field label="Address line 2" name="line2" required={false} autoComplete="address-line2" /></div>
          <Field label="City" name="city" autoComplete="address-level2" />
          <Field label="State" name="state" autoComplete="address-level1" />
          <Field label="Pincode" name="pincode" autoComplete="postal-code" />
        </ActionForm>
      </section>
    </div>
  );
}
