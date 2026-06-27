export function CtaBand() {
  return (
    <section className="bg-olive-deep px-6 py-16">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-display text-2xl font-semibold text-stone sm:text-3xl">
          Sumamos tu marca a pedidos mensuales recurrentes.
        </p>
        <a
          href="mailto:nicolas.conti@ranicgroup.com"
          className="inline-block rounded-control bg-stone px-6 py-3 font-sans text-sm font-semibold text-olive-deep transition hover:bg-white"
        >
          Escribinos
        </a>
      </div>
    </section>
  );
}
