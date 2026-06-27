import { SiteFooter } from "@/components/public/SiteFooter";

export default function PrivacyPage() {
  return (
    <>
      <main className="flex-1 px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-3xl font-bold text-ink">
            Política de privacidad
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            Última actualización: junio de 2026.
          </p>

          <div className="mt-10 space-y-8 text-sm leading-relaxed text-ink">
            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                Información que recolectamos
              </h2>
              <p className="mt-2">
                Este sitio no tiene formulario de contacto propio. Si nos
                escribís por email, esa comunicación queda únicamente en nuestra
                casilla de correo y la usamos para responderte. Para entender el
                tráfico del sitio usamos Vercel Analytics, que registra visitas
                de forma agregada y anónima, sin cookies de seguimiento y sin
                identificar a visitantes individuales.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                Cómo usamos la información
              </h2>
              <p className="mt-2">
                Usamos los datos agregados de Vercel Analytics únicamente para
                entender cuánta gente visita el sitio y mejorar su contenido. No
                vendemos ni compartimos información de visitantes con terceros.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                Cookies
              </h2>
              <p className="mt-2">
                Este sitio no usa cookies de seguimiento ni de terceros.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                Enlaces a terceros
              </h2>
              <p className="mt-2">
                Este sitio es informativo. Cualquier compra de nuestros
                productos ocurre en plataformas de terceros, sujetas a sus
                propias políticas de privacidad, no a esta.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                Cambios a esta política
              </h2>
              <p className="mt-2">
                Podemos actualizar esta política ocasionalmente. La fecha de la
                última actualización siempre figura al inicio de esta página.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                Contacto
              </h2>
              <p className="mt-2">
                Para cualquier consulta sobre privacidad, escribinos a{" "}
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
