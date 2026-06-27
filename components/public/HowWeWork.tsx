const STEPS = [
  {
    number: "01",
    title: "Catalog & channel audit",
    description: "We review your catalog and current marketplace presence.",
  },
  {
    number: "02",
    title: "SKU selection & pricing guardrails",
    description: "We agree on which SKUs we buy and the MAP rules we'll follow.",
  },
  {
    number: "03",
    title: "Procurement & compliance check",
    description: "We place a documented wholesale order and confirm compliance.",
  },
  {
    number: "04",
    title: "Marketplace execution & reporting",
    description: "We list, sell, and report back on performance and sell-through.",
  },
] as const;

export function HowWeWork() {
  return (
    <section className="bg-surface px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <p className="mb-8 font-sans text-sm font-semibold uppercase tracking-wide text-ink-soft">
          How we work
        </p>
        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <li key={step.number} className="rounded-card border border-line p-5">
              <span className="font-mono text-xs text-ink-soft">
                {step.number}
              </span>
              <h3 className="mt-2 font-display text-lg font-semibold text-ink">
                {step.title}
              </h3>
              <p className="mt-1 text-sm text-ink-soft">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
