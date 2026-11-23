import { BRAND } from "@/lib/brand";

/** Centered white card on a soft background, with a brand banner on top (the layout used by big fashion stores' sign-in pages). */
export default function AuthCard({ title, subtitle, banner, children, footer }: {
  title: string; subtitle: string; banner: string; children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <div className="bg-ivory/60 px-4 py-8 md:py-14">
      <div className="mx-auto w-full max-w-[25rem] bg-white shadow-pop">
        <div className="relative h-36 overflow-hidden bg-bronze p-6 text-white md:h-40">
          <span aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full border-[18px] border-white/15" />
          <span aria-hidden className="absolute -bottom-12 right-10 h-28 w-28 rounded-full bg-white/10" />
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ivory/90">{BRAND}</p>
          <p className="relative mt-3 max-w-[16rem] text-2xl font-extrabold leading-tight">{banner}</p>
        </div>
        <div className="p-6 md:p-8">
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-ink/60">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="border-t border-ink/10 bg-ivory/40 px-6 py-4 text-sm md:px-8">{footer}</div>}
      </div>
    </div>
  );
}
