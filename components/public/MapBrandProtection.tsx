import { FoliageAccent } from "./Foliage";

export function MapBrandProtection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-olive-deep to-forest px-6 py-20">
      <FoliageAccent className="pointer-events-none absolute -left-10 -bottom-12 h-44 w-48" />
      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-gold">
          MAP &amp; brand protection
        </p>
        <h2 className="font-league text-3xl font-extrabold tracking-tight text-cream sm:text-4xl">
          Your pricing is an asset. We treat it like one.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-cream/80">
          Holding MAP, protecting listing quality, and refusing the race to the
          bottom — wider distribution with the discipline your brand depends
          on.
        </p>
      </div>
    </section>
  );
}
