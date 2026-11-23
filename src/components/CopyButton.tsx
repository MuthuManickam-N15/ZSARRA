"use client";
import { useState } from "react";

export default function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" aria-label={`Copy ${text}`} className="text-xs font-bold text-bronze hover:underline"
      onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked: the text is still selectable */ } }}>
      {done ? "Copied" : "Copy"}
    </button>
  );
}
