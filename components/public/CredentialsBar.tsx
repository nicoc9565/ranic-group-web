const FACTS = [
  { label: "Registered U.S. LLC", detail: "New Jersey" },
  { label: "Headquartered", detail: "Summit, NJ" },
  { label: "Selling on", detail: "Amazon and leading marketplaces" },
  { label: "Purchasing", detail: "MAP-compliant, documented" },
] as const;

export function CredentialsBar() {
  return (
    <section className="bg-cream px-6 py-10">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 rounded-2xl bg-surface p-8 shadow-[0_10px_26px_rgba(38,51,15,0.09)] md:grid-cols-4">
        {FACTS.map((fact) => (
          <div key={fact.label}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-olive">
              {fact.label}
            </p>
            <p className="mt-1.5 font-league text-base font-bold tracking-tight text-ink">
              {fact.detail}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
