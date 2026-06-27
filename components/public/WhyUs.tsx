const REASONS = [
  {
    glyph: "M",
    title: "MAP discipline",
    description:
      "We follow MAP-first pricing guardrails and avoid price wars that erode your brand's value.",
  },
  {
    glyph: "S",
    title: "Transparent sourcing",
    description:
      "Documented procurement and clear wholesale terms — no gray-market guesswork.",
  },
  {
    glyph: "L",
    title: "Long-term focus",
    description: "We buy for sustained sell-through, not short-term arbitrage.",
  },
  {
    glyph: "U",
    title: "U.S. operations",
    description: "Based in Summit, NJ, with direct, responsive communication.",
  },
] as const;

export function WhyUs() {
  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <p className="mb-8 font-sans text-sm font-semibold uppercase tracking-wide text-ink-soft">
          Why brands work with us
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {REASONS.map((reason) => (
            <div
              key={reason.title}
              className="rounded-card border border-line bg-surface p-5"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-kraft bg-kraft/40 font-display text-sm font-bold text-olive-deep">
                {reason.glyph}
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold text-ink">
                {reason.title}
              </h3>
              <p className="mt-1 text-sm text-ink-soft">{reason.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
