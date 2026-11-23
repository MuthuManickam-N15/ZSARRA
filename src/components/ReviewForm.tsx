"use client";
import { useState } from "react";
import ActionForm from "./ActionForm";
import { submitReview } from "@/app/actions/reviews";

export default function ReviewForm({ productId, existing }: { productId: string; existing?: { rating: number; title: string; body: string } | null }) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  return (
    <ActionForm action={submitReview} submit={existing ? "Update review" : "Submit review"} className="space-y-4">
      <input type="hidden" name="productId" value={productId} />
      <fieldset>
        <legend className="mb-1 text-[13px] font-bold uppercase tracking-[0.08em]">Your rating</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="peer sr-only" />
              <span aria-hidden className={`inline-block text-3xl leading-none transition-transform hover:scale-110 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-bronze ${n <= rating ? "text-bronze" : "text-ink/20"}`}>★</span>
              <span className="sr-only">{n} {n === 1 ? "star" : "stars"}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-semibold">Title (optional)<input name="title" maxLength={80} defaultValue={existing?.title ?? ""} className="field mt-1 font-normal" /></label>
      <label className="block text-sm font-semibold">Your review<textarea name="body" required minLength={10} maxLength={1500} rows={4} defaultValue={existing?.body ?? ""} className="field mt-1 font-normal" /></label>
    </ActionForm>
  );
}
