const FAQS = [
  {
    question: "Are you a registered U.S. business?",
    answer:
      "Yes. RANIC GROUP LLC is a registered LLC in New Jersey, operating from Summit, NJ.",
  },
  {
    question: "Do you follow MAP?",
    answer:
      "Always. We buy and sell under MAP-first guardrails and hold the line on price.",
  },
  {
    question: "Which channels do you sell on?",
    answer: "Amazon and other leading online marketplaces.",
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
      "Send us a message below. We'll review your catalog and propose terms.",
  },
] as const;

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 bg-surface px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <p className="mb-8 text-xs font-semibold uppercase tracking-[0.22em] text-olive">
          Frequently asked questions
        </p>
        <div className="space-y-3">
          {FAQS.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-2xl bg-cream px-6 py-4"
            >
              <summary className="cursor-pointer list-none text-sm font-semibold text-ink">
                {faq.question}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
