const CATEGORIES = [
  {
    code: "BPC",
    name: "Beauty & Personal Care",
    description: "Fragrance, cosmetics, and personal care.",
  },
  {
    code: "H&P",
    name: "Home & Pet",
    description: "Everyday products for the home and pets.",
  },
  {
    code: "E&T",
    name: "Entertainment & Toys",
    description: "Toys, games, and entertainment.",
  },
  {
    code: "GM",
    name: "General Merchandise",
    description: "High-turnover general merchandise.",
  },
] as const;

export function CategoriesSection() {
  return (
    <section id="categories" className="scroll-mt-20 bg-cream px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <p className="mb-8 text-xs font-semibold uppercase tracking-[0.22em] text-olive">
          Categories we carry
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          {CATEGORIES.map((category) => (
            <div
              key={category.code}
              className="rounded-2xl bg-surface p-6 shadow-[0_10px_26px_rgba(38,51,15,0.09)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(38,51,15,0.14)]"
            >
              <span className="inline-block rounded-full bg-olive/10 px-3 py-1 font-mono text-xs text-olive">
                {category.code}
              </span>
              <h3 className="mt-3 font-league text-xl font-bold tracking-tight text-ink">
                {category.name}
              </h3>
              <p className="mt-1 text-sm text-ink-soft">
                {category.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
