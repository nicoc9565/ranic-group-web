import { LeafIcon } from "./Foliage";

const REASONS = [
  {
    title: "MAP discipline",
    description:
      "We price under MAP-first guardrails and hold it. No race to the bottom, no channel chaos.",
    chip: "bg-[#EAF0DE]",
    leaf: "#556B2F",
  },
  {
    title: "Documented sourcing",
    description:
      "Clear wholesale terms on every order. No gray-market guesswork about where your product went.",
    chip: "bg-[#F3E9D2]",
    leaf: "#C7A662",
  },
  {
    title: "Long-term focus",
    description:
      "We buy for steady, repeatable sell-through and recurring orders — not one-off flips.",
    chip: "bg-[#EAF0DE]",
    leaf: "#556B2F",
  },
  {
    title: "U.S. operations",
    description:
      "A registered U.S. LLC in Summit, NJ, with direct and responsive communication.",
    chip: "bg-[#F3E9D2]",
    leaf: "#C7A662",
  },
] as const;

export function WhyUs() {
  return (
    <section className="bg-cream px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <p className="mb-8 text-xs font-semibold uppercase tracking-[0.22em] text-olive">
          Why brands choose us
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          {REASONS.map((reason) => (
            <div
              key={reason.title}
              className="rounded-2xl bg-surface p-6 shadow-[0_10px_26px_rgba(38,51,15,0.09)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(38,51,15,0.14)]"
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${reason.chip}`}
              >
                <LeafIcon className="h-6 w-3" fill={reason.leaf} />
              </span>
              <h3 className="mt-4 font-league text-xl font-bold tracking-tight text-ink">
                {reason.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                {reason.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
