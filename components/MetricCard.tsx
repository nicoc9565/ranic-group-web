/** Card de métrica: label (eyebrow) + número grande en display. */
export function MetricCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <p className="font-eyebrow text-[10px] uppercase tracking-[0.18em] text-ink-soft">
        {label}
      </p>
      <p
        className={`mt-2 font-display text-3xl font-bold tabular-nums ${
          accent ? "text-olive" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
