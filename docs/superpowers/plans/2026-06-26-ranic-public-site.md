# RANIC GROUP — Sitio público (Fase 2) Implementation Plan

> **For agentic workers (Claude en VS Code):** Ejecutá este plan tarea por tarea, en orden, con
> commit al final de cada tarea. No modifiques nada bajo `app/admin/` ni `lib/` del CRM (Fase 1,
> ya en producción) — esta fase solo toca rutas públicas (`/`, `/privacy`, `/terms`) y el layout
> raíz compartido. Si algo del plan es ambiguo, preguntá antes de improvisar.

**Goal:** Reemplazar el placeholder de la home (`app/page.tsx`) por el sitio público completo de
RANIC GROUP LLC (`/`, `/privacy`, `/terms`): credibilidad institucional + CTA de contacto para
proveedores, con la identidad visual definida en `docs/design-guidelines-public-site.md`.

**Architecture:** Mismo proyecto Next.js (App Router) que el CRM. Componentes nuevos bajo
`components/public/` (separados de los componentes del CRM en `components/`). El layout raíz
(`app/layout.tsx`) se comparte entre `/admin` y las rutas públicas — solo se le toca el
`metadata`, nada de su estructura.

**Tech Stack:** Next.js (App Router) + TypeScript + Tailwind CSS (ya configurado). Sin Firebase,
sin formulario, sin backend nuevo. Se agrega `@vercel/analytics`.

**Spec de referencia:** `docs/superpowers/specs/2026-06-26-ranic-public-site-design.md` y
`docs/design-guidelines-public-site.md` — leer ambos antes de empezar.

## Global Constraints

- **Tokens nuevos en `tailwind.config.ts`:** `kraft = "#D9CBA3"`, `stamp = "#B23A2E"`. No tocar
  ni renombrar los tokens existentes (`olive`, `olive.deep`, `olive.tint`, `stone`, `surface`,
  `ink`, `ink.soft`, `line`, `status.*`).
- **Tipografía:** `font-display` (Space Grotesk) para titulares, `font-sans` (Inter, default)
  para body/labels, `font-mono` (JetBrains Mono) solo para los datos de la PO y los códigos de
  categoría. **No usar `font-eyebrow`** (Archivo) en este sitio — esa fuente es del lenguaje
  visual del CRM, acá los eyebrows van en Inter normal.
- **Sin numeración 01/02/03/04** en las tarjetas de categoría.
- **CTA de contacto:** siempre `mailto:nicolas.conti@ranicgroup.com`. Sin formulario, sin
  colección de Firestore, sin endpoint nuevo.
- **Sin mencionar Amazon** en el copy público (coherente con las reglas de email del CRM) —
  usar "plataformas de terceros" si hace falta referirse a dónde se vende.
- **`prefers-reduced-motion`:** ya está manejado globalmente en `app/globals.css:18-27` (pone
  `animation-duration: 0.01ms !important` en todo). Cualquier animación nueva que se agregue
  como `@keyframes` + clase CSS queda automáticamente neutralizada ahí — no hace falta lógica
  JS adicional para esto.
- **No tocar `app/admin/**` ni nada de `lib/` o `components/` del CRM existente.**

---

## File Structure

```
ranic-web/
├── app/
│   ├── layout.tsx                       # Modify: metadata + <Analytics/>
│   ├── globals.css                      # Modify: + keyframes de la PO card y el sello
│   ├── page.tsx                         # Modify: home completa (hoy es el placeholder)
│   ├── privacy/page.tsx                 # Create
│   └── terms/page.tsx                   # Create
├── components/
│   └── public/
│       ├── Hero.tsx                     # Create
│       ├── PurchaseOrderCard.tsx        # Create (elemento de firma)
│       ├── CategoriesSection.tsx        # Create
│       ├── CtaBand.tsx                  # Create
│       └── SiteFooter.tsx               # Create (compartido entre /, /privacy, /terms)
├── tailwind.config.ts                   # Modify: + tokens kraft, stamp
└── package.json                         # Modify: + @vercel/analytics
```

---

## Task 1: Tokens de Tailwind (`kraft`, `stamp`)

**Files:**
- Modify: `tailwind.config.ts:13-33`

**Interfaces:**
- Produces: clases Tailwind `bg-kraft`, `border-kraft`, `text-kraft`, `bg-stamp`,
  `border-stamp`, `text-stamp` (vía `theme.extend.colors`).

- [ ] **Step 1:** En `tailwind.config.ts`, dentro de `theme.extend.colors`, agregar dos
      entradas nuevas al mismo nivel que `stone`/`surface` (no anidadas):
      ```ts
      kraft: "#D9CBA3", // fondo/borde de la tarjeta "Purchase Order" (sitio público)
      stamp: "#B23A2E", // sello "APROBADO" (sitio público)
      ```
- [ ] **Step 2:** Verificar: `npm run build` pasa sin errores de tipos en el config.
- [ ] **Step 3:** Commit:
      ```bash
      git add tailwind.config.ts
      git commit -m "feat: add kraft and stamp color tokens for public site"
      ```

---

## Task 2: Keyframes de animación (tarjeta + sello)

**Files:**
- Modify: `app/globals.css` (agregar al final del archivo, después del bloque de
  `prefers-reduced-motion` en las líneas 18-27).

**Interfaces:**
- Produces: clases CSS `.animate-po-card-in` y `.animate-stamp-in`, usables en JSX vía
  `className`.

- [ ] **Step 1:** Agregar al final de `app/globals.css`:
      ```css
      @keyframes po-card-in {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes stamp-in {
        0% {
          opacity: 0;
          transform: rotate(-8deg) scale(1.4);
        }
        60% {
          opacity: 1;
          transform: rotate(-8deg) scale(0.95);
        }
        100% {
          opacity: 1;
          transform: rotate(-8deg) scale(1);
        }
      }

      .animate-po-card-in {
        animation: po-card-in 400ms ease-out both;
      }

      .animate-stamp-in {
        animation: stamp-in 350ms ease-out both;
        animation-delay: 280ms;
      }
      ```
- [ ] **Step 2:** Verificar: `npm run build` pasa (CSS válido, sin errores de PostCSS).
- [ ] **Step 3:** Commit:
      ```bash
      git add app/globals.css
      git commit -m "feat: add load-in keyframes for purchase order card and stamp"
      ```

---

## Task 3: `PurchaseOrderCard` (elemento de firma)

**Files:**
- Create: `components/public/PurchaseOrderCard.tsx`

**Interfaces:**
- Consumes: clases Tailwind de Tasks 1-2 (`bg-kraft`, `text-stamp`, `animate-po-card-in`,
  `animate-stamp-in`).
- Produces: `export function PurchaseOrderCard(): JSX.Element` — sin props.

- [ ] **Step 1:** Crear `components/public/PurchaseOrderCard.tsx`:
      ```tsx
      export function PurchaseOrderCard() {
        return (
          <div className="animate-po-card-in rounded-card border border-kraft bg-kraft/40 p-6 font-mono text-sm text-ink shadow-sm">
            <p className="mb-3 text-xs uppercase tracking-[0.2em] text-ink-soft">
              Purchase Order
            </p>
            <div className="space-y-2 border-t border-ink/10 pt-3">
              <p>
                <span className="text-ink-soft">BUYER:</span> RANIC GROUP LLC
              </p>
              <p>
                <span className="text-ink-soft">TERMS:</span> NET 30
              </p>
              <p className="flex items-center gap-3">
                <span className="text-ink-soft">STATUS:</span>
                <span className="animate-stamp-in inline-block -rotate-6 rounded border-2 border-stamp px-3 py-1 font-display text-xs font-bold uppercase tracking-wider text-stamp">
                  Aprobado
                </span>
              </p>
            </div>
          </div>
        );
      }
      ```
- [ ] **Step 2:** Verificar: `npm run build` pasa.
- [ ] **Step 3:** Commit:
      ```bash
      git add components/public/PurchaseOrderCard.tsx
      git commit -m "feat: add PurchaseOrderCard signature component"
      ```

---

## Task 4: `Hero`

**Files:**
- Create: `components/public/Hero.tsx`

**Interfaces:**
- Consumes: `PurchaseOrderCard` de Task 3.
- Produces: `export function Hero(): JSX.Element` — sin props.

- [ ] **Step 1:** Crear `components/public/Hero.tsx`:
      ```tsx
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
                  RANIC GROUP LLC es un comprador wholesale online con base en
                  Summit, NJ. Sumamos marcas a pedidos mensuales recurrentes —
                  sin vueltas, sin intermediarios.
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
      ```
- [ ] **Step 2:** Verificar: `npm run build` pasa.
- [ ] **Step 3:** Commit:
      ```bash
      git add components/public/Hero.tsx
      git commit -m "feat: add public site Hero section"
      ```

---

## Task 5: `CategoriesSection`

**Files:**
- Create: `components/public/CategoriesSection.tsx`

**Interfaces:**
- Produces: `export function CategoriesSection(): JSX.Element` — sin props.

- [ ] **Step 1:** Crear `components/public/CategoriesSection.tsx`:
      ```tsx
      const CATEGORIES = [
        {
          code: "BPC",
          name: "Beauty & Personal Care",
          description: "Fragancias, cosmética y cuidado personal.",
        },
        {
          code: "H&P",
          name: "Home & Pet",
          description: "Productos para el hogar y mascotas.",
        },
        {
          code: "E&T",
          name: "Entertainment & Toys",
          description: "Juguetes, juegos y entretenimiento.",
        },
        {
          code: "GM",
          name: "General Merchandise",
          description: "Mercadería general de alta rotación.",
        },
      ] as const;

      export function CategoriesSection() {
        return (
          <section className="px-6 py-16">
            <div className="mx-auto max-w-5xl">
              <p className="mb-8 font-sans text-sm font-semibold uppercase tracking-wide text-ink-soft">
                Categorías que compramos
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {CATEGORIES.map((category) => (
                  <div
                    key={category.code}
                    className="rounded-card border border-line bg-surface p-5 transition hover:shadow-md"
                  >
                    <p className="mb-2 font-mono text-xs text-ink-soft">
                      {category.code}
                    </p>
                    <h3 className="font-display text-lg font-semibold text-ink">
                      {category.name}
                    </h3>
                    <p className="mt-1 text-sm text-ink-soft">
                      {category.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      }
      ```
- [ ] **Step 2:** Verificar: `npm run build` pasa.
- [ ] **Step 3:** Commit:
      ```bash
      git add components/public/CategoriesSection.tsx
      git commit -m "feat: add public site CategoriesSection"
      ```

---

## Task 6: `CtaBand`

**Files:**
- Create: `components/public/CtaBand.tsx`

**Interfaces:**
- Produces: `export function CtaBand(): JSX.Element` — sin props.

- [ ] **Step 1:** Crear `components/public/CtaBand.tsx`:
      ```tsx
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
      ```
- [ ] **Step 2:** Verificar: `npm run build` pasa.
- [ ] **Step 3:** Commit:
      ```bash
      git add components/public/CtaBand.tsx
      git commit -m "feat: add public site CtaBand section"
      ```

---

## Task 7: `SiteFooter`

**Files:**
- Create: `components/public/SiteFooter.tsx`

**Interfaces:**
- Produces: `export function SiteFooter(): JSX.Element` — sin props. Usado por `/`, `/privacy`
  y `/terms` (Tasks 8, 10, 11).

- [ ] **Step 1:** Crear `components/public/SiteFooter.tsx`:
      ```tsx
      import Link from "next/link";

      export function SiteFooter() {
        return (
          <footer className="border-t border-line px-6 py-8">
            <p className="mx-auto max-w-5xl text-center font-mono text-xs text-ink-soft">
              RANIC GROUP LLC · Summit, NJ · +1 (201) 572-1383 ·{" "}
              <Link href="/privacy" className="underline hover:text-ink">
                Privacidad
              </Link>{" "}
              ·{" "}
              <Link href="/terms" className="underline hover:text-ink">
                Términos
              </Link>
            </p>
          </footer>
        );
      }
      ```
- [ ] **Step 2:** Verificar: `npm run build` pasa.
- [ ] **Step 3:** Commit:
      ```bash
      git add components/public/SiteFooter.tsx
      git commit -m "feat: add shared SiteFooter for public pages"
      ```

---

## Task 8: Ensamblar la home (`app/page.tsx`)

**Files:**
- Modify: `app/page.tsx` (reemplaza el placeholder completo de las líneas 1-15).

**Interfaces:**
- Consumes: `Hero` (Task 4), `CategoriesSection` (Task 5), `CtaBand` (Task 6), `SiteFooter`
  (Task 7).

- [ ] **Step 1:** Reemplazar todo el contenido de `app/page.tsx` por:
      ```tsx
      import { CategoriesSection } from "@/components/public/CategoriesSection";
      import { CtaBand } from "@/components/public/CtaBand";
      import { Hero } from "@/components/public/Hero";
      import { SiteFooter } from "@/components/public/SiteFooter";

      export default function Home() {
        return (
          <>
            <main className="flex-1">
              <Hero />
              <CategoriesSection />
              <CtaBand />
            </main>
            <SiteFooter />
          </>
        );
      }
      ```
- [ ] **Step 2:** Verificar: `npm run dev`, abrir `/` → se ve el hero con la PO card animando
      al cargar, las 4 categorías, la banda CTA y el footer. `npm run build` pasa.
- [ ] **Step 3:** Commit:
      ```bash
      git add app/page.tsx
      git commit -m "feat: assemble public home page from Hero, Categories, CTA and Footer"
      ```

---

## Task 9: Metadata del layout raíz

**Files:**
- Modify: `app/layout.tsx:37-40`

**Interfaces:**
- No cambia ninguna interfaz consumida por `/admin` — solo el objeto `metadata`.

- [ ] **Step 1:** Reemplazar el bloque `metadata` actual:
      ```ts
      export const metadata: Metadata = {
        title: "RANIC GROUP LLC",
        description: "RANIC GROUP LLC — comprador wholesale online en Summit, NJ.",
      };
      ```
- [ ] **Step 2:** Verificar: `npm run build` pasa.
- [ ] **Step 3:** Commit:
      ```bash
      git add app/layout.tsx
      git commit -m "chore: update site metadata for public site"
      ```

---

## Task 10: Página `/privacy`

**Files:**
- Create: `app/privacy/page.tsx`

**Interfaces:**
- Consumes: `SiteFooter` (Task 7).

- [ ] **Step 1:** Crear `app/privacy/page.tsx`:
      ```tsx
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
                      escribís por email, esa comunicación queda únicamente en
                      nuestra casilla de correo y la usamos para responderte.
                      Para entender el tráfico del sitio usamos Vercel
                      Analytics, que registra visitas de forma agregada y
                      anónima, sin cookies de seguimiento y sin identificar a
                      visitantes individuales.
                    </p>
                  </section>

                  <section>
                    <h2 className="font-display text-lg font-semibold text-ink">
                      Cómo usamos la información
                    </h2>
                    <p className="mt-2">
                      Usamos los datos agregados de Vercel Analytics
                      únicamente para entender cuánta gente visita el sitio y
                      mejorar su contenido. No vendemos ni compartimos
                      información de visitantes con terceros.
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
                      productos ocurre en plataformas de terceros, sujetas a
                      sus propias políticas de privacidad, no a esta.
                    </p>
                  </section>

                  <section>
                    <h2 className="font-display text-lg font-semibold text-ink">
                      Cambios a esta política
                    </h2>
                    <p className="mt-2">
                      Podemos actualizar esta política ocasionalmente. La fecha
                      de la última actualización siempre figura al inicio de
                      esta página.
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
      ```
- [ ] **Step 2:** Verificar: `npm run dev`, abrir `/privacy` → renderiza el texto completo,
      sin placeholders. `npm run build` pasa.
- [ ] **Step 3:** Commit:
      ```bash
      git add app/privacy/page.tsx
      git commit -m "feat: add privacy policy page"
      ```

---

## Task 11: Página `/terms`

**Files:**
- Create: `app/terms/page.tsx`

**Interfaces:**
- Consumes: `SiteFooter` (Task 7).

- [ ] **Step 1:** Crear `app/terms/page.tsx`:
      ```tsx
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
                      Al usar este sitio, aceptás estos términos de uso. Si no
                      estás de acuerdo, te pedimos que no lo uses.
                    </p>
                  </section>

                  <section>
                    <h2 className="font-display text-lg font-semibold text-ink">
                      Uso del sitio
                    </h2>
                    <p className="mt-2">
                      Este sitio es informativo: presenta a RANIC GROUP LLC
                      como comprador wholesale y los rubros de productos que
                      compramos. No vendemos productos directamente desde este
                      sitio — cualquier transacción ocurre en plataformas de
                      terceros, fuera de nuestro control.
                    </p>
                  </section>

                  <section>
                    <h2 className="font-display text-lg font-semibold text-ink">
                      Propiedad intelectual
                    </h2>
                    <p className="mt-2">
                      El contenido de este sitio (textos, diseño, marca) es
                      propiedad de RANIC GROUP LLC. No está permitido
                      reproducirlo sin autorización.
                    </p>
                  </section>

                  <section>
                    <h2 className="font-display text-lg font-semibold text-ink">
                      Sin garantías
                    </h2>
                    <p className="mt-2">
                      Este sitio se ofrece &quot;tal cual&quot;, sin garantías
                      de ningún tipo sobre su disponibilidad o exactitud.
                    </p>
                  </section>

                  <section>
                    <h2 className="font-display text-lg font-semibold text-ink">
                      Limitación de responsabilidad
                    </h2>
                    <p className="mt-2">
                      RANIC GROUP LLC no es responsable por daños derivados del
                      uso o la imposibilidad de uso de este sitio.
                    </p>
                  </section>

                  <section>
                    <h2 className="font-display text-lg font-semibold text-ink">
                      Ley aplicable
                    </h2>
                    <p className="mt-2">
                      Estos términos se rigen por las leyes del Estado de Nueva
                      Jersey, Estados Unidos.
                    </p>
                  </section>

                  <section>
                    <h2 className="font-display text-lg font-semibold text-ink">
                      Contacto
                    </h2>
                    <p className="mt-2">
                      Para cualquier consulta sobre estos términos, escribinos
                      a{" "}
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
      ```
- [ ] **Step 2:** Verificar: `npm run dev`, abrir `/terms` → renderiza el texto completo.
      `npm run build` pasa.
- [ ] **Step 3:** Commit:
      ```bash
      git add app/terms/page.tsx
      git commit -m "feat: add terms of use page"
      ```

---

## Task 12: Vercel Analytics

**Files:**
- Modify: `package.json` (agregar dependencia)
- Modify: `app/layout.tsx` (agregar `<Analytics />`)

**Interfaces:**
- Produces: componente `<Analytics />` de `@vercel/analytics/next`, montado una sola vez en el
  layout raíz (cubre `/`, `/privacy`, `/terms` y `/admin` por igual — no requiere cambios en
  ninguna otra ruta).

- [ ] **Step 1:** Instalar el paquete:
      ```bash
      npm install @vercel/analytics
      ```
- [ ] **Step 2:** En `app/layout.tsx`, agregar el import junto a los demás:
      ```ts
      import { Analytics } from "@vercel/analytics/next";
      ```
- [ ] **Step 3:** Dentro de `<body>`, después de `{children}`, agregar:
      ```tsx
      <body className="flex min-h-full flex-col bg-stone font-sans text-ink">
        {children}
        <Analytics />
      </body>
      ```
- [ ] **Step 4:** Verificar: `npm run build` pasa. En `npm run dev` no hace falta ver datos
      reales (Analytics solo reporta en producción/preview de Vercel), solo confirmar que no
      rompe el build ni el render.
- [ ] **Step 5:** Commit:
      ```bash
      git add package.json package-lock.json app/layout.tsx
      git commit -m "feat: add Vercel Analytics to root layout"
      ```

---

## Task 13: Verificación final y PR

**Files:** ninguno nuevo.

- [ ] **Step 1:** `npm run build` — debe pasar sin errores ni warnings de tipos.
- [ ] **Step 2:** `npm run dev` y revisar manualmente:
      - `/` — hero con la PO card y el sello animando al cargar (recargar la página para
        verlo), las 4 categorías sin numerar, la banda CTA en `olive-deep`, el footer con los
        links a `/privacy` y `/terms` funcionando.
      - Responsive: achicar la ventana a ancho mobile — el hero pasa a una columna (texto
        arriba, PO card abajo), las categorías a una columna.
      - Los dos botones "Trabajá con nosotros" y "Escribinos" abren el cliente de mail con
        `nicolas.conti@ranicgroup.com`.
      - `/privacy` y `/terms` — texto completo visible, footer presente, sin layout roto.
      - Activar "reduced motion" en las preferencias del sistema/navegador y recargar `/` — la
        PO card y el sello deben aparecer directo, sin animación.
- [ ] **Step 3:** Confirmar que `/admin` sigue funcionando igual que antes (login + las 6
      vistas) — esta fase no debió tocar nada ahí.
- [ ] **Step 4:** Push de un branch nuevo (ej. `fase-2-sitio-publico`) y abrir PR a `main`.
      Esperar a que el preview de Vercel deployee y pase los checks (igual que en la Fase 1).
- [ ] **Step 5:** Avisar para revisar el preview antes de cualquier merge a `main` — no
      mergear sin aprobación explícita.

---

## Self-Review (cobertura del spec)

- Objetivo/audiencia (credibilidad + CTA, sin formulario) → Tasks 4, 6, 13. ✅
- Estructura de 4 secciones en `/` → Tasks 4-8. ✅
- CTA `mailto:` (Hero y banda) → Tasks 4, 6. ✅
- 4 categorías de presentación, sin numeración → Task 5. ✅
- `/privacy` y `/terms` con contenido real (no placeholder), incluyendo la declaración de
  Vercel Analytics → Tasks 10, 11, 12. ✅
- Identidad visual (paleta `kraft`/`stamp`, tipografías, elemento de firma con animación y
  `prefers-reduced-motion`) → Tasks 1-3. ✅
- No tocar `/admin` ni el CRM → Global Constraints + Task 13 Step 3. ✅
- Fuera de alcance respetado: sin formulario, sin blog/testimonios/logos de marcas → ningún
  task los introduce. ✅
