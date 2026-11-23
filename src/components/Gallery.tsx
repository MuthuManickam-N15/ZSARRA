"use client";
import { useState } from "react";
import { img } from "@/lib/img";

export default function Gallery({ images, name }: { images: { url: string; alt: string }[]; name: string }) {
  const [zoom, setZoom] = useState<number | null>(null);
  if (images.length === 0) return <div className="flex aspect-[3/4] items-center justify-center bg-ivory/50 text-8xl font-light text-ink/10" role="img" aria-label={`${name}: no photo yet`}>{name[0]}</div>;
  return (
    <div>
      <div className={`flex snap-x snap-mandatory gap-2 overflow-x-auto md:grid md:overflow-visible ${images.length === 1 ? "md:grid-cols-1" : "md:grid-cols-2"}`}>
        {images.map((im, n) => (
          <button key={im.url} onClick={() => setZoom(n)} aria-label={`Enlarge photo ${n + 1}`} className="group aspect-[3/4] min-w-[88%] cursor-zoom-in snap-center overflow-hidden bg-ivory/50 md:min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img(im.url, 900)} alt={im.alt || name} className="h-full w-full animate-[fade_0.5s_ease_both] object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          </button>
        ))}
      </div>
      {zoom !== null && (
        <div role="dialog" aria-modal="true" aria-label="Enlarged photo" className="fixed inset-0 z-50 flex animate-[fade_0.2s_ease_both] items-center justify-center bg-ink/90 p-4" onClick={() => setZoom(null)} onKeyDown={(e) => e.key === "Escape" && setZoom(null)}>
          <button className="absolute right-5 top-5 text-sm font-bold text-white underline" autoFocus onClick={() => setZoom(null)}>Close</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img(images[zoom].url, 1600)} alt={images[zoom].alt || name} className="max-h-full max-w-full animate-[scale-in_0.3s_var(--ease)_both] object-contain" />
        </div>
      )}
    </div>
  );
}
