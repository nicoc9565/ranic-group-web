const FAQS = [
  {
    question: "Are you a registered U.S. business?",
    answer:
      "Yes. RANIC GROUP LLC is a registered LLC in New Jersey, operating from Summit, NJ.",
  },
  {
    question: "Do you follow MAP?",
    answer:
      "Yes. We buy and sell under MAP-first pricing guardrails and avoid the price erosion that hurts your brand.",
  },
  {
    question: "Which marketplaces do you sell on?",
    answer: "Amazon and other online marketplaces.",
  },
  {
    question: "Do you buy directly from brands?",
    answer:
      "Yes — documented wholesale purchases, directly from the brand or an authorized manufacturer.",
  },
  {
    question: "How do you protect MAP and brand perception?",
    answer:
      "We follow MAP-first pricing guardrails, avoid uncontrolled channel expansion, and keep listing quality aligned with your brand guidelines.",
  },
  {
    question: "How do we get started?",
    answer:
      "Send us a message below and we'll review your catalog and propose terms.",
  },
] as const;

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 px-6 py-16">
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
