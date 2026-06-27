import { PurchaseOrderCard } from "./PurchaseOrderCard";

export function Hero() {
  return (
    <section className="px-6 py-20 sm:py-28">
      <div className="mx-auto grid max-w-5xl items-center gap-12 sm:grid-cols-2">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Compramos tu próximo pedido recurrente.
          </h1>
          <p className="mt-5 text-base text-ink-soft sm:text-lg">
            RANIC GROUP LLC es un comprador wholesale online con base en Summit,
            NJ. Sumamos marcas a pedidos mensuales recurrentes — sin vueltas, sin
            intermediarios.
          </p>
          <a
            href="mailto:nicolas.conti@ranicgroup.com"
            className="mt-8 inline-block rounded-control bg-olive px-6 py-3 font-sans text-sm font-semibold text-stone transition hover:bg-olive-deep"
          >
            Trabajá con nosotros
          </a>
        </div>
        <PurchaseOrderCard />
      </div>
    </section>
  );
}
