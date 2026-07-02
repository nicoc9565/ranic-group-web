const STEPS = [
  {
    number: "01",
    title: "Catalog review",
    description:
      "We study your catalog and your current presence across online retail.",
  },
  {
    number: "02",
    title: "Terms & pricing guardrails",
    description: "We agree on the SKUs we carry and the MAP rules we'll hold.",
  },
  {
    number: "03",
    title: "Documented purchase",
    description:
      "We place a documented wholesale order and confirm compliance.",
  },
  {
    number: "04",
    title: "Distribution & reporting",
    description:
      "We list, sell, and report back on sell-through and performance.",
  },
] as const;

export function HowWeWork() {
  return (
    <section id="how-we-work" className="scroll-mt-20 bg-surface px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <p className="mb-8 text-xs font-semibold uppercase tracking-[0.22em] text-olive">
          How we work
        </p>
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.number} className="rounded-2xl bg-cream p-6">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full font-league text-sm font-bold ${
                  i === STEPS.length - 1
                    ? "bg-gold text-[#2C3A12]"
                    : "bg-olive text-cream"
                }`}
              >
                {step.number}
              </span>
              <h3 className="mt-4 font-league text-lg font-bold tracking-tight text-ink">
                {step.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
