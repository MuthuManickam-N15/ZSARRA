import type { Metadata } from "next";
import ActionForm, { Field } from "@/components/ActionForm";
import ConfirmButton from "@/components/ConfirmButton";
import { createCategory, deleteCategory, renameCategory } from "@/app/actions/admin";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Categories", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Categories({ searchParams }: { searchParams: { error?: string } }) {
  const cats = await db.category.findMany({ orderBy: [{ gender: "asc" }, { name: "asc" }], include: { _count: { select: { products: true } } } });
  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-xl font-bold md:text-2xl">Categories</h1>
      {searchParams.error === "inuse" && <p role="alert" className="border border-ink bg-paper p-3 text-sm">That category still has products. Move or delete them first.</p>}
      <ul className="divide-y divide-ink/15 border border-ink/20 bg-paper">
        {cats.map((c) => (
          <li key={c.id} className="flex flex-wrap items-end gap-3 p-3 text-sm">
            <form action={renameCategory} className="flex flex-1 flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={c.id} />
              <label className="text-xs">Name<input name="name" defaultValue={c.name} className="field mt-1" /></label>
              <label className="text-xs">Collection<select name="gender" defaultValue={c.gender} className="field mt-1"><option value="MEN">Men</option><option value="WOMEN">Women</option><option value="UNISEX">Unisex</option></select></label>
              <button className="pb-3 underline hover:text-bronze">Save</button>
            </form>
            <span className="pb-3 text-ink/60">{c._count.products} products</span>
            <form action={deleteCategory}><input type="hidden" name="id" value={c.id} /><ConfirmButton message={`Delete the “${c.name}” category?`} className="pb-3 underline hover:text-bronze">Delete</ConfirmButton></form>
          </li>
        ))}
        {cats.length === 0 && <li className="p-6 text-sm">No categories yet.</li>}
      </ul>
      <section><h2 className="mb-3 text-base font-bold">Add a category</h2>
        <ActionForm action={createCategory} submit="Add category" className="flex max-w-xl flex-wrap items-end gap-3">
          <Field label="Name" name="name" />
          <label className="block text-sm">Collection<select name="gender" className="field mt-1"><option value="WOMEN">Women</option><option value="MEN">Men</option><option value="UNISEX">Unisex</option></select></label>
        </ActionForm>
      </section>
    </div>
  );
}
