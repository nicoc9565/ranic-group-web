const FACTS = [
  { label: "Registered U.S. LLC", detail: "New Jersey" },
  { label: "Operating from", detail: "Summit, NJ" },
  { label: "Selling on", detail: "Amazon and other marketplaces" },
  { label: "Purchasing", detail: "MAP-compliant, documented" },
] as const;

export function CredentialsBar() {
  return (
    <section className="border-y border-line bg-kraft/20">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-6 py-8 md:grid-cols-4">
        {FACTS.map((fact) => (
          <div key={fact.label}>
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-soft">
              {fact.label}
            </p>
            <p className="mt-1 font-league text-base font-bold tracking-tight text-ink">
              {fact.detail}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
