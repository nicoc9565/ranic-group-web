const FAQS = [
  {
    question: "Do you buy wholesale or work on consignment?",
    answer:
      "Primarily wholesale purchasing. For select partners we can discuss other structures aligned with mutual growth.",
  },
  {
    question: "How do you protect MAP and brand perception?",
    answer:
      "We follow MAP-first pricing guardrails, avoid uncontrolled channel expansion, and maintain listing quality aligned with your brand guidelines.",
  },
  {
    question: "Which categories do you prioritize?",
    answer:
      "Beauty & Personal Care, Home & Pet, Entertainment & Toys, and General Merchandise — see the Categories section above.",
  },
  {
    question: "Are you an authorized reseller?",
    answer:
      "We focus on long-term wholesale relationships and transparent sourcing, and can align on authorization terms during onboarding if needed.",
  },
] as const;

export function Faq() {
  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <p className="mb-8 font-sans text-sm font-semibold uppercase tracking-wide text-ink-soft">
          Frequently asked questions
        </p>
        <div className="divide-y divide-line border-y border-line">
          {FAQS.map((faq) => (
            <details key={faq.question} className="py-4">
              <summary className="cursor-pointer list-none font-mono text-sm font-semibold text-ink">
                {faq.question}
              </summary>
              <p className="mt-2 text-sm text-ink-soft">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
