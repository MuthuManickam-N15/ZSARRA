"use client";
import { useEffect, useRef } from "react";

/** Always open on desktop; collapsed behind a "Filters" bar on phones. */
export default function FilterPanel({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (window.matchMedia("(max-width: 1023px)").matches) ref.current?.removeAttribute("open"); }, []);
  return (
    <details ref={ref} open className="border border-ink/10 lg:sticky lg:top-24 lg:self-start lg:border-0">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[13px] font-bold uppercase tracking-[0.08em] lg:pointer-events-none lg:cursor-default lg:px-0 lg:pt-0">
        Filters <span aria-hidden className="text-lg leading-none lg:hidden">+</span>
      </summary>
      <div className="space-y-5 px-4 pb-4 lg:px-0 lg:pb-0">{children}</div>
    </details>
  );
}
