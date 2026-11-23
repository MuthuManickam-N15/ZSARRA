/** Five stars, partly filled to show a rating like 4.3. */
export default function Stars({ value, size = "text-base" }: { value: number; size?: string }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className={`relative inline-block leading-none ${size}`} role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      <span aria-hidden className="text-ink/20">★★★★★</span>
      <span aria-hidden className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap text-bronze" style={{ width: `${pct}%` }}>★★★★★</span>
    </span>
  );
}
