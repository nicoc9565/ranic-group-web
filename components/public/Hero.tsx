import { PurchaseOrderCard } from "./PurchaseOrderCard";

export function Hero() {
  return (
    <section className="px-6 py-20 sm:py-28">
      <div className="mx-auto grid max-w-5xl items-center gap-12 sm:grid-cols-2">
        <div>
          <h1 className="font-league text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
            We buy your brand&apos;s next wholesale order — and sell it on
            Amazon.
          </h1>
          <p className="mt-5 text-base text-ink-soft sm:text-lg">
            RANIC GROUP LLC is a U.S.-based wholesale buyer and Amazon seller in
            Summit, NJ. We purchase inventory directly from brands and resell it
            on Amazon and other marketplaces — with MAP discipline and a
            long-term partnership mindset.
          </p>
          <a
            href="#contact"
            className="mt-8 inline-block rounded-control bg-olive px-6 py-3 font-sans text-sm font-semibold text-stone transition hover:bg-olive-deep"
          >
            Work with us
          </a>
          <p className="mt-4 font-mono text-xs uppercase tracking-[0.15em] text-ink-soft">
            Registered U.S. LLC · Summit, NJ
          </p>
        </div>
        <PurchaseOrderCard />
      </div>
    </section>
  );
}
