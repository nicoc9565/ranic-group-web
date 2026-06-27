import { SiteFooter } from "@/components/public/SiteFooter";

export default function TermsPage() {
  return (
    <>
      <main className="flex-1 px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-3xl font-bold text-ink">
            Términos de uso
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            Última actualización: junio de 2026.
          </p>

          <div className="mt-10 space-y-8 text-sm leading-relaxed text-ink">
            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                Aceptación de los términos
              </h2>
              <p className="mt-2">
                Al usar este sitio, aceptás estos términos de uso. Si no estás de
                acuerdo, te pedimos que no lo uses.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                Uso del sitio
              </h2>
              <p className="mt-2">
                Este sitio es informativo: presenta a RANIC GROUP LLC como
                comprador wholesale y los rubros de productos que compramos. No
                vendemos productos directamente desde este sitio — cualquier
                transacción ocurre en plataformas de terceros, fuera de nuestro
                control.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                Propiedad intelectual
              </h2>
              <p className="mt-2">
                El contenido de este sitio (textos, diseño, marca) es propiedad
                de RANIC GROUP LLC. No está permitido reproducirlo sin
                autorización.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                Sin garantías
              </h2>
              <p className="mt-2">
                Este sitio se ofrece &quot;tal cual&quot;, sin garantías de
                ningún tipo sobre su disponibilidad o exactitud.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                Limitación de responsabilidad
              </h2>
              <p className="mt-2">
                RANIC GROUP LLC no es responsable por daños derivados del uso o
                la imposibilidad de uso de este sitio.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                Ley aplicable
              </h2>
              <p className="mt-2">
                Estos términos se rigen por las leyes del Estado de Nueva Jersey,
                Estados Unidos.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                Contacto
              </h2>
              <p className="mt-2">
                Para cualquier consulta sobre estos términos, escribinos a{" "}
                <a
                  href="mailto:nicolas.conti@ranicgroup.com"
                  className="underline hover:text-ink-soft"
                >
                  nicolas.conti@ranicgroup.com
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
