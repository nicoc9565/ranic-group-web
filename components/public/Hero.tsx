import { Foliage } from "./Foliage";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-olive-deep to-forest px-6 py-24 sm:py-32">
      <Foliage className="pointer-events-none absolute -right-16 -top-16 z-0 h-[280px] w-[310px] sm:h-[380px] sm:w-[420px]" />
      <div className="relative z-10 mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">
          Wholesale &amp; distribution
        </p>
        <h1 className="mt-4 max-w-xl font-league text-5xl font-extrabold leading-[0.98] tracking-tight text-cream sm:text-6xl">
          Wider reach, protected brand.
        </h1>
        <p className="mt-6 max-w-lg text-base leading-relaxed text-cream/80 sm:text-lg">
          Driving disciplined wholesale distribution for consumer brands across
          online retail — with the documented terms and MAP discipline that
          keep pricing and reputation intact.
        </p>
        <a
          href="#contact"
          className="mt-9 inline-block rounded-full bg-gold px-7 py-3.5 text-sm font-semibold text-[#2C3A12] shadow-[0_6px_18px_rgba(0,0,0,0.25)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(0,0,0,0.3)]"
        >
          Work with us
        </a>
        <p className="mt-6 font-mono text-xs uppercase tracking-[0.15em] text-sage">
          Registered U.S. LLC · Summit, NJ
        </p>
      </div>
    </section>
  );
}
