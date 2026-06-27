const CATEGORIES = [
  {
    code: "BPC",
    name: "Beauty & Personal Care",
    description: "Fragrances, cosmetics, and personal care.",
  },
  {
    code: "H&P",
    name: "Home & Pet",
    description: "Products for the home and pets.",
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
    <section className="px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <p className="mb-8 font-sans text-sm font-semibold uppercase tracking-wide text-ink-soft">
          Categories we buy
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {CATEGORIES.map((category) => (
            <div
              key={category.code}
              className="rounded-card border border-line bg-surface p-5 transition hover:shadow-md"
            >
              <p className="mb-2 font-mono text-xs text-ink-soft">
                {category.code}
              </p>
              <h3 className="font-display text-lg font-semibold text-ink">
                {category.name}
              </h3>
              <p className="mt-1 text-sm text-ink-soft">{category.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
