"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { addToCart } from "@/app/actions/shop";
import { sortSizes } from "@/lib/img";

type V = { id: string; size: string; color: string; colorHex: string; stock: number };

function AddButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button className="btn-primary w-full py-3.5 text-[15px]" disabled={disabled || pending}>{pending ? "Adding…" : "Add to cart"}</button>;
}

export default function ProductPicker({ variants, slug }: { variants: V[]; slug: string }) {
  const colors = useMemo(() => Array.from(new Map(variants.map((v) => [v.color, v.colorHex])).entries()), [variants]);
  const [color, setColor] = useState(colors[0]?.[0] ?? "");
  const [size, setSize] = useState("");
  const [state, action] = useFormState(addToCart, undefined);

  const forColor = sortSizes(variants.filter((v) => v.color === color).map((v) => v.size)).map((s) => variants.find((v) => v.color === color && v.size === s)!);
  const selected = forColor.find((v) => v.size === size);
  const status = !selected ? "Select a size" : selected.stock <= 0 ? "Out of stock" : selected.stock <= 3 ? `Only ${selected.stock} left` : "In stock";
  const legend = "mb-3 text-[13px] font-bold uppercase tracking-[0.08em]";

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="variantId" value={selected?.id ?? ""} />
      <input type="hidden" name="quantity" value="1" />
      <input type="hidden" name="next" value={`/products/${slug}`} />
      <fieldset>
        <legend className={legend}>Color: <span className="font-normal normal-case tracking-normal text-ink/70">{color}</span></legend>
        <div className="flex gap-2.5">
          {colors.map(([name, hex]) => (
            <button key={name} type="button" aria-label={name} aria-pressed={color === name} onClick={() => { setColor(name); setSize(""); }} style={{ backgroundColor: hex }}
              className={`h-9 w-9 rounded-full border border-ink/25 transition-transform duration-200 hover:scale-110 active:scale-95 ${color === name ? "ring-2 ring-ink ring-offset-2" : ""}`} />
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className={legend}>Select size</legend>
        <div className="flex flex-wrap gap-3">
          {forColor.map((v) => (
            <button key={v.id} type="button" disabled={v.stock <= 0} aria-pressed={size === v.size} onClick={() => setSize(v.size)}
              className={`h-12 min-w-12 rounded-full border px-3 text-sm font-bold transition-all duration-200 active:scale-95 disabled:border-dashed disabled:text-ink/30 disabled:line-through ${size === v.size ? "border-ink bg-ink text-white" : "border-ink/30 bg-white hover:border-ink"}`}>
              {v.size}
            </button>
          ))}
        </div>
      </fieldset>
      <p className="min-h-5 text-sm font-semibold text-ink/70" aria-live="polite">{status}</p>
      <AddButton disabled={!selected || selected.stock <= 0} />
      {state?.error && <p role="alert" className="border border-ink bg-white p-3 text-sm">{state.error}</p>}
      {state?.ok && <p role="status" className="border border-bronze bg-ivory/50 p-3 text-sm">{state.ok}. <Link href="/cart" className="font-bold underline">View cart</Link></p>}
    </form>
  );
}
