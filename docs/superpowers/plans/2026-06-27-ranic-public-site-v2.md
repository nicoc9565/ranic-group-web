# RANIC GROUP — Sitio público (Fase 2, v2) Implementation Plan

> **For agentic workers (Claude en VS Code):** Ejecutá este plan tarea por tarea, en orden, con
> commit al final de cada tarea, sobre el branch `fase-2-sitio-publico` (el mismo del PR #2 — no
> creés un branch nuevo, este plan reemplaza el contenido de ese PR, no lo descarta). No
> modifiques nada bajo `app/admin/` ni `lib/` del CRM (Fase 1, ya en producción).

**Goal:** Revisar el sitio público (`/`, `/privacy`, `/terms`) implementado en la v1: traducir
todo a inglés, expandir de 3 a 7 secciones de contenido, agregar un formulario de contacto real
(con envío de email vía Resend) y SEO técnico — manteniendo la identidad visual ya aprobada
(paleta olive/kraft/stamp, tipografías, la tarjeta "Purchase Order" + sello "APROBADO").

**Architecture:** Mismo proyecto Next.js. Se agregan componentes nuevos a `components/public/`
junto a los de la v1 (algunos de la v1 se traducen in-place, uno se elimina por quedar sin uso).
Se agrega una API route (`app/api/contact/route.ts`) que envía email vía Resend — sin Firestore,
sin tocar `/admin`.

**Tech Stack:** Next.js (App Router) + TypeScript + Tailwind CSS + Resend (nuevo, vía paquete
`resend`).

**Spec de referencia:** `docs/superpowers/specs/2026-06-27-ranic-public-site-v2-design.md` —
leer antes de empezar. También sigue vigente `docs/design-guidelines-public-site.md` (visual).

## Global Constraints

- **Todo el contenido visible del sitio público va en inglés** (Hero, secciones nuevas,
  categorías, FAQ, formulario, footer, `/privacy`, `/terms`). El CRM (`/admin`) sigue en
  **español** — no se toca su idioma.
- **El sitio público SÍ puede mencionar Amazon/marketplaces abiertamente.** Esto es distinto de
  la regla de los emails de outreach del CRM ("nunca mencionar Amazon"), que sigue intacta y no
  se modifica en este plan.
- **No usar `olive-tint` ni los tokens de semáforo del CRM (`status-overdue`, `status-today`,
  `status-ontrack`) en componentes de `components/public/`** — son específicos del lenguaje
  visual del CRM (ver `docs/design-guidelines-public-site.md`).
- **Sin almacenamiento de los envíos del formulario** — el envío va directo a un email vía
  Resend, sin colección nueva en Firestore ni vista nueva en `/admin`.
- **Sin productos a la venta en el sitio** — el sitio es informativo, no un catálogo.
- El branch de trabajo es `fase-2-sitio-publico` (ya existe, con el PR #2 abierto) — no crear uno
  nuevo.

---

## File Structure

```
ranic-web/
├── app/
│   ├── layout.tsx                       # Modify: lang="en", metadata, JSON-LD
│   ├── page.tsx                         # Modify: ensambla las 7 secciones nuevas
│   ├── sitemap.ts                       # Create
│   ├── robots.ts                        # Create
│   ├── api/
│   │   └── contact/route.ts             # Create: handler del formulario (Resend)
│   ├── privacy/page.tsx                 # Modify: inglés + disclosure del formulario
│   └── terms/page.tsx                   # Modify: inglés
├── components/
│   └── public/
│       ├── Hero.tsx                     # Modify: inglés + mención de Amazon
│       ├── WhyUs.tsx                    # Create
│       ├── HowWeWork.tsx                # Create
│       ├── CategoriesSection.tsx        # Modify: inglés
│       ├── MapBrandProtection.tsx       # Create
│       ├── Faq.tsx                      # Create
│       ├── ContactSection.tsx           # Create: formulario (client component)
│       ├── SiteFooter.tsx               # Modify: inglés
│       ├── OrganizationJsonLd.tsx       # Create
│       └── CtaBand.tsx                  # Delete: reemplazado por MapBrandProtection/Contact
└── package.json                         # Modify: + resend
```

---

## Task 1: Layout raíz en inglés + SEO base

**Files:**
- Modify: `app/layout.tsx:38-58`
- Create: `components/public/OrganizationJsonLd.tsx`
- Create: `app/sitemap.ts`
- Create: `app/robots.ts`

**Interfaces:**
- Produces: `export function OrganizationJsonLd(): JSX.Element` — sin props, monta un
  `<script type="application/ld+json">`. Se usa en `app/layout.tsx`.

- [ ] **Step 1:** Crear `components/public/OrganizationJsonLd.tsx`:
      ```tsx
      export function OrganizationJsonLd() {
        const data = {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "RANIC GROUP LLC",
          url: "https://www.ranicgroup.com",
          email: "nicolas.conti@ranicgroup.com",
          address: {
            "@type": "PostalAddress",
            addressLocality: "Summit",
            addressRegion: "NJ",
            addressCountry: "US",
          },
        };

        return (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
          />
        );
      }
      ```
- [ ] **Step 2:** En `app/layout.tsx`, agregar el import junto a los demás:
      ```ts
      import { OrganizationJsonLd } from "@/components/public/OrganizationJsonLd";
      ```
- [ ] **Step 3:** Reemplazar el `html lang="es"` (línea ~50) por `lang="en"` — el sitio público
      es el contenido indexado por Google y la mayoría del texto del documento; el CRM
      (`/admin`) es una herramienta interna autenticada, fuera del alcance de SEO.
- [ ] **Step 4:** Reemplazar el bloque `metadata` (líneas 38-41) por:
      ```ts
      export const metadata: Metadata = {
        metadataBase: new URL("https://www.ranicgroup.com"),
        title: {
          default: "RANIC GROUP LLC | Wholesale Buyer & Amazon Seller",
          template: "%s | RANIC GROUP LLC",
        },
        description:
          "RANIC GROUP LLC is a U.S.-based wholesale buyer and Amazon seller in Summit, NJ. We purchase inventory directly from brands and sell it on Amazon with MAP discipline.",
      };
      ```
- [ ] **Step 5:** En el `<body>`, agregar `<OrganizationJsonLd />` junto a `<Analytics />`:
      ```tsx
      <body className="flex min-h-full flex-col bg-stone font-sans text-ink">
        {children}
        <Analytics />
        <OrganizationJsonLd />
      </body>
      ```
- [ ] **Step 6:** Crear `app/sitemap.ts`:
      ```ts
      import type { MetadataRoute } from "next";

      export default function sitemap(): MetadataRoute.Sitemap {
        const base = "https://www.ranicgroup.com";
        const lastModified = new Date();

        return [
          { url: `${base}/`, lastModified, changeFrequency: "monthly", priority: 1 },
          {
            url: `${base}/privacy`,
            lastModified,
            changeFrequency: "yearly",
            priority: 0.3,
          },
          {
            url: `${base}/terms`,
            lastModified,
            changeFrequency: "yearly",
            priority: 0.3,
          },
        ];
      }
      ```
- [ ] **Step 7:** Crear `app/robots.ts`:
      ```ts
      import type { MetadataRoute } from "next";

      export default function robots(): MetadataRoute.Robots {
        return {
          rules: {
            userAgent: "*",
            allow: "/",
            disallow: "/admin",
          },
          sitemap: "https://www.ranicgroup.com/sitemap.xml",
        };
      }
      ```
- [ ] **Step 8:** Verificar: `npm run build` pasa. `npm run dev`, abrir `/sitemap.xml` y
      `/robots.txt` — ambos deben renderizar XML/texto válido con las 3 rutas públicas y el
      disallow de `/admin` respectivamente.
- [ ] **Step 9:** Commit:
      ```bash
      git add app/layout.tsx app/sitemap.ts app/robots.ts components/public/OrganizationJsonLd.tsx
      git commit -m "feat: switch site to English lang, add SEO metadata, sitemap, robots, JSON-LD"
      ```

---

## Task 2: Traducir componentes existentes + eliminar CtaBand

**Files:**
- Modify: `components/public/Hero.tsx`
- Modify: `components/public/CategoriesSection.tsx`
- Modify: `components/public/SiteFooter.tsx`
- Delete: `components/public/CtaBand.tsx`

**Interfaces:**
- No cambia ninguna firma — mismos `export function Hero()`, `CategoriesSection()`,
  `SiteFooter()`, sin props, solo cambia el copy interno.

- [ ] **Step 1:** Reemplazar todo el contenido de `components/public/Hero.tsx`:
      ```tsx
      import { PurchaseOrderCard } from "./PurchaseOrderCard";

      export function Hero() {
        return (
          <section className="px-6 py-20 sm:py-28">
            <div className="mx-auto grid max-w-5xl items-center gap-12 sm:grid-cols-2">
              <div>
                <h1 className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
                  We buy your brand&apos;s next wholesale order — and sell it
                  on Amazon.
                </h1>
                <p className="mt-5 text-base text-ink-soft sm:text-lg">
                  RANIC GROUP LLC is a U.S.-based wholesale buyer and Amazon
                  seller operating out of Summit, NJ. We purchase inventory
                  directly from brands and resell it on Amazon and other
                  marketplaces, with MAP discipline and a long-term
                  partnership mindset.
                </p>
                <a
                  href="mailto:nicolas.conti@ranicgroup.com"
                  className="mt-8 inline-block rounded-control bg-olive px-6 py-3 font-sans text-sm font-semibold text-stone transition hover:bg-olive-deep"
                >
                  Work with us
                </a>
              </div>
              <PurchaseOrderCard />
            </div>
          </section>
        );
      }
      ```
- [ ] **Step 2:** Reemplazar todo el contenido de `components/public/CategoriesSection.tsx`:
      ```tsx
      const CATEGORIES = [
        {
          code: "BPC",
          name: "Beauty & Personal Care",
          description: "Fragrances, cosmetics, and personal care.",
        },
        {
          code: "H&P",
          name: "Home & Pet",
          description: "Products for the home and pets.",
        },
        {
          code: "E&T",
          name: "Entertainment & Toys",
          description: "Toys, games, and entertainment.",
        },
        {
          code: "GM",
          name: "General Merchandise",
          description: "High-turnover general merchandise.",
        },
      ] as const;

      export function CategoriesSection() {
        return (
          <section className="px-6 py-16">
            <div className="mx-auto max-w-5xl">
              <p className="mb-8 font-sans text-sm font-semibold uppercase tracking-wide text-ink-soft">
                Categories we buy
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
- [ ] **Step 3:** Reemplazar todo el contenido de `components/public/SiteFooter.tsx`:
      ```tsx
      import Link from "next/link";

      export function SiteFooter() {
        return (
          <footer className="border-t border-line px-6 py-8">
            <p className="mx-auto max-w-5xl text-center font-mono text-xs text-ink-soft">
              RANIC GROUP LLC · Summit, NJ · +1 (201) 572-1383 ·{" "}
              <Link href="/privacy" className="underline hover:text-ink">
                Privacy
              </Link>{" "}
              ·{" "}
              <Link href="/terms" className="underline hover:text-ink">
                Terms
              </Link>
            </p>
          </footer>
        );
      }
      ```
- [ ] **Step 4:** Eliminar `components/public/CtaBand.tsx` (no se usa en la v2 — su función de
      "banda de conversión" la cubre `MapBrandProtection` + `ContactSection`, ver Tasks 5 y 7):
      ```bash
      git rm components/public/CtaBand.tsx
      ```
- [ ] **Step 5:** Verificar: `npm run build` pasa (no debe haber ningún import roto a
      `CtaBand` — confirmalo con una búsqueda de texto en `app/` y `components/` antes de
      buildear, ya se va a corregir el import en `app/page.tsx` en la Task 8).
- [ ] **Step 6:** Commit:
      ```bash
      git add components/public/Hero.tsx components/public/CategoriesSection.tsx components/public/SiteFooter.tsx
      git commit -m "feat: translate Hero, CategoriesSection and SiteFooter to English; remove unused CtaBand"
      ```

---

## Task 3: `WhyUs`

**Files:**
- Create: `components/public/WhyUs.tsx`

**Interfaces:**
- Produces: `export function WhyUs(): JSX.Element` — sin props.

- [ ] **Step 1:** Crear `components/public/WhyUs.tsx`:
      ```tsx
      const REASONS = [
        {
          glyph: "M",
          title: "MAP discipline",
          description:
            "We follow MAP-first pricing guardrails and avoid price wars that erode your brand's value.",
        },
        {
          glyph: "S",
          title: "Transparent sourcing",
          description:
            "Documented procurement and clear wholesale terms — no gray-market guesswork.",
        },
        {
          glyph: "L",
          title: "Long-term focus",
          description: "We buy for sustained sell-through, not short-term arbitrage.",
        },
        {
          glyph: "U",
          title: "U.S. operations",
          description: "Based in Summit, NJ, with direct, responsive communication.",
        },
      ] as const;

      export function WhyUs() {
        return (
          <section className="px-6 py-16">
            <div className="mx-auto max-w-5xl">
              <p className="mb-8 font-sans text-sm font-semibold uppercase tracking-wide text-ink-soft">
                Why brands work with us
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {REASONS.map((reason) => (
                  <div
                    key={reason.title}
                    className="rounded-card border border-line bg-surface p-5"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-kraft bg-kraft/40 font-display text-sm font-bold text-olive-deep">
                      {reason.glyph}
                    </span>
                    <h3 className="mt-4 font-display text-lg font-semibold text-ink">
                      {reason.title}
                    </h3>
                    <p className="mt-1 text-sm text-ink-soft">
                      {reason.description}
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
      git add components/public/WhyUs.tsx
      git commit -m "feat: add WhyUs section"
      ```

---

## Task 4: `HowWeWork`

**Files:**
- Create: `components/public/HowWeWork.tsx`

**Interfaces:**
- Produces: `export function HowWeWork(): JSX.Element` — sin props.

- [ ] **Step 1:** Crear `components/public/HowWeWork.tsx`:
      ```tsx
      const STEPS = [
        {
          number: "01",
          title: "Catalog & channel audit",
          description: "We review your catalog and current marketplace presence.",
        },
        {
          number: "02",
          title: "SKU selection & pricing guardrails",
          description: "We agree on which SKUs we buy and the MAP rules we'll follow.",
        },
        {
          number: "03",
          title: "Procurement & compliance check",
          description: "We place a documented wholesale order and confirm compliance.",
        },
        {
          number: "04",
          title: "Marketplace execution & reporting",
          description: "We list, sell, and report back on performance and sell-through.",
        },
      ] as const;

      export function HowWeWork() {
        return (
          <section className="bg-surface px-6 py-16">
            <div className="mx-auto max-w-5xl">
              <p className="mb-8 font-sans text-sm font-semibold uppercase tracking-wide text-ink-soft">
                How we work
              </p>
              <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {STEPS.map((step) => (
                  <li
                    key={step.number}
                    className="rounded-card border border-line p-5"
                  >
                    <span className="font-mono text-xs text-ink-soft">
                      {step.number}
                    </span>
                    <h3 className="mt-2 font-display text-lg font-semibold text-ink">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-sm text-ink-soft">
                      {step.description}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        );
      }
      ```
- [ ] **Step 2:** Verificar: `npm run build` pasa.
- [ ] **Step 3:** Commit:
      ```bash
      git add components/public/HowWeWork.tsx
      git commit -m "feat: add HowWeWork section"
      ```

---

## Task 5: `MapBrandProtection`

**Files:**
- Create: `components/public/MapBrandProtection.tsx`

**Interfaces:**
- Produces: `export function MapBrandProtection(): JSX.Element` — sin props.

- [ ] **Step 1:** Crear `components/public/MapBrandProtection.tsx`:
      ```tsx
      export function MapBrandProtection() {
        return (
          <section className="bg-olive-deep px-6 py-16">
            <div className="mx-auto max-w-3xl text-center">
              <p className="mb-3 font-sans text-sm font-semibold uppercase tracking-wide text-stone/70">
                MAP &amp; brand protection
              </p>
              <p className="font-display text-2xl font-semibold leading-snug text-stone sm:text-3xl">
                We respect MAP, protect listing quality, and never race to the
                bottom on price. If you want a wholesale partner that plays
                by the rules, that&apos;s us.
              </p>
            </div>
          </section>
        );
      }
      ```
- [ ] **Step 2:** Verificar: `npm run build` pasa.
- [ ] **Step 3:** Commit:
      ```bash
      git add components/public/MapBrandProtection.tsx
      git commit -m "feat: add MapBrandProtection section"
      ```

---

## Task 6: `Faq`

**Files:**
- Create: `components/public/Faq.tsx`

**Interfaces:**
- Produces: `export function Faq(): JSX.Element` — sin props.

- [ ] **Step 1:** Crear `components/public/Faq.tsx`:
      ```tsx
      const FAQS = [
        {
          question: "Do you buy wholesale or work on consignment?",
          answer:
            "Primarily wholesale purchasing. For select partners we can discuss other structures aligned with mutual growth.",
        },
        {
          question: "How do you protect MAP and brand perception?",
          answer:
            "We follow MAP-first pricing guardrails, avoid uncontrolled channel expansion, and maintain listing quality aligned with your brand guidelines.",
        },
        {
          question: "Which categories do you prioritize?",
          answer:
            "Beauty & Personal Care, Home & Pet, Entertainment & Toys, and General Merchandise — see the Categories section above.",
        },
        {
          question: "Are you an authorized reseller?",
          answer:
            "We focus on long-term wholesale relationships and transparent sourcing, and can align on authorization terms during onboarding if needed.",
        },
      ] as const;

      export function Faq() {
        return (
          <section className="px-6 py-16">
            <div className="mx-auto max-w-3xl">
              <p className="mb-8 font-sans text-sm font-semibold uppercase tracking-wide text-ink-soft">
                Frequently asked questions
              </p>
              <div className="divide-y divide-line border-y border-line">
                {FAQS.map((faq) => (
                  <details key={faq.question} className="py-4">
                    <summary className="cursor-pointer list-none font-mono text-sm font-semibold text-ink">
                      {faq.question}
                    </summary>
                    <p className="mt-2 text-sm text-ink-soft">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        );
      }
      ```
- [ ] **Step 2:** Verificar: `npm run dev`, abrir `/` (una vez ensamblada en Task 8) y confirmar
      que cada `<details>` se expande/colapsa al click sin JS adicional. `npm run build` pasa.
- [ ] **Step 3:** Commit:
      ```bash
      git add components/public/Faq.tsx
      git commit -m "feat: add Faq section"
      ```

---

## Task 7: Formulario de contacto (Resend)

**Files:**
- Modify: `package.json` (agregar dependencia `resend`)
- Create: `app/api/contact/route.ts`
- Create: `components/public/ContactSection.tsx`

**Interfaces:**
- Produces: `POST /api/contact` — recibe JSON `{ company, name, email, category, message }`
  (todos `string`), responde `{ ok: true }` (200) o `{ error: string }` (400/500).
- Consumes: env var `RESEND_API_KEY` (no commiteada — se carga en `.env.local` local y en
  Vercel).

- [ ] **Step 1:** Instalar el paquete:
      ```bash
      npm install resend
      ```
- [ ] **Step 2:** Crear `app/api/contact/route.ts`:
      ```ts
      import { NextResponse } from "next/server";
      import { Resend } from "resend";

      const resend = new Resend(process.env.RESEND_API_KEY);

      export async function POST(request: Request) {
        const body = await request.json();
        const { company, name, email, category, message } = body as {
          company?: string;
          name?: string;
          email?: string;
          category?: string;
          message?: string;
        };

        if (!company || !name || !email || !message) {
          return NextResponse.json(
            { error: "Missing required fields." },
            { status: 400 },
          );
        }

        try {
          await resend.emails.send({
            from: "RANIC GROUP Contact Form <onboarding@resend.dev>",
            to: "nicolas.conti@ranicgroup.com",
            replyTo: email,
            subject: `New supplier inquiry: ${company}`,
            text: `Company: ${company}\nContact name: ${name}\nEmail: ${email}\nCategory: ${category ?? "N/A"}\n\nMessage:\n${message}`,
          });
          return NextResponse.json({ ok: true });
        } catch {
          return NextResponse.json(
            { error: "Failed to send message." },
            { status: 500 },
          );
        }
      }
      ```
      Nota: `onboarding@resend.dev` es el remitente de pruebas de Resend, funciona sin verificar
      un dominio propio. Si más adelante Nico verifica `ranicgroup.com` en Resend, este `from` se
      puede cambiar a algo como `contact@ranicgroup.com` — no es necesario para que esto funcione
      ahora.
- [ ] **Step 3:** Crear `components/public/ContactSection.tsx`:
      ```tsx
      "use client";

      import { useState, type FormEvent } from "react";

      const CATEGORIES = [
        "Beauty & Personal Care",
        "Home & Pet",
        "Entertainment & Toys",
        "General Merchandise",
        "Other",
      ] as const;

      type Status = "idle" | "submitting" | "success" | "error";

      export function ContactSection() {
        const [status, setStatus] = useState<Status>("idle");

        async function handleSubmit(event: FormEvent<HTMLFormElement>) {
          event.preventDefault();
          setStatus("submitting");

          const form = event.currentTarget;
          const data = {
            company: (form.elements.namedItem("company") as HTMLInputElement)
              .value,
            name: (form.elements.namedItem("name") as HTMLInputElement).value,
            email: (form.elements.namedItem("email") as HTMLInputElement).value,
            category: (
              form.elements.namedItem("category") as HTMLSelectElement
            ).value,
            message: (
              form.elements.namedItem("message") as HTMLTextAreaElement
            ).value,
          };

          try {
            const response = await fetch("/api/contact", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error("Request failed");
            setStatus("success");
            form.reset();
          } catch {
            setStatus("error");
          }
        }

        return (
          <section id="contact" className="px-6 py-16">
            <div className="mx-auto max-w-3xl">
              <p className="mb-2 font-sans text-sm font-semibold uppercase tracking-wide text-ink-soft">
                Get in touch
              </p>
              <h2 className="font-display text-3xl font-bold text-ink">
                Sell your brand to RANIC
              </h2>
              <p className="mt-3 text-ink-soft">
                Tell us about your brand and we&apos;ll get back to you.
                Prefer email?{" "}
                <a
                  href="mailto:nicolas.conti@ranicgroup.com"
                  className="underline hover:text-ink"
                >
                  Write to us directly
                </a>
                .
              </p>

              <form
                onSubmit={handleSubmit}
                className="mt-8 grid gap-4 rounded-card border border-kraft bg-kraft/20 p-6 sm:grid-cols-2"
              >
                <div>
                  <label
                    htmlFor="company"
                    className="block text-xs font-semibold uppercase tracking-wide text-ink-soft"
                  >
                    Company / Brand
                  </label>
                  <input
                    id="company"
                    name="company"
                    required
                    className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink"
                  />
                </div>
                <div>
                  <label
                    htmlFor="name"
                    className="block text-xs font-semibold uppercase tracking-wide text-ink-soft"
                  >
                    Contact Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    required
                    className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink"
                  />
                </div>
                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-semibold uppercase tracking-wide text-ink-soft"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink"
                  />
                </div>
                <div>
                  <label
                    htmlFor="category"
                    className="block text-xs font-semibold uppercase tracking-wide text-ink-soft"
                  >
                    Category
                  </label>
                  <select
                    id="category"
                    name="category"
                    defaultValue={CATEGORIES[0]}
                    className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink"
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor="message"
                    className="block text-xs font-semibold uppercase tracking-wide text-ink-soft"
                  >
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={4}
                    className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={status === "submitting"}
                    className="rounded-control bg-olive px-6 py-3 font-sans text-sm font-semibold text-stone transition hover:bg-olive-deep disabled:opacity-60"
                  >
                    {status === "submitting" ? "Sending…" : "Send message"}
                  </button>
                  {status === "success" && (
                    <p className="mt-3 text-sm text-olive-deep">
                      Thanks — we&apos;ll get back to you soon.
                    </p>
                  )}
                  {status === "error" && (
                    <p className="mt-3 text-sm text-stamp">
                      Something went wrong. Please try again or email us
                      directly.
                    </p>
                  )}
                </div>
              </form>
            </div>
          </section>
        );
      }
      ```
- [ ] **Step 4:** Crear `.env.local` (si no existe ya, está gitignored) con una key de prueba o
      pedirle a Nico la real:
      ```
      RESEND_API_KEY=re_xxxxxxxxxxxx
      ```
- [ ] **Step 5:** Verificar: `npm run dev`, ir a `/` (una vez ensamblada en Task 8), completar el
      formulario y enviarlo. Con una `RESEND_API_KEY` válida, debe aparecer el mensaje "Thanks —
      we'll get back to you soon." y llegar un email a `nicolas.conti@ranicgroup.com`. Si no hay
      key válida todavía, confirmar al menos que el estado de error se muestra correctamente.
      `npm run build` pasa.
- [ ] **Step 6:** Commit:
      ```bash
      git add package.json package-lock.json app/api/contact/route.ts components/public/ContactSection.tsx
      git commit -m "feat: add contact form with Resend email delivery"
      ```

---

## Task 8: Ensamblar la home con las 7 secciones

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `Hero` (existente), `WhyUs` (Task 3), `HowWeWork` (Task 4), `CategoriesSection`
  (Task 2), `MapBrandProtection` (Task 5), `Faq` (Task 6), `ContactSection` (Task 7),
  `SiteFooter` (existente).

- [ ] **Step 1:** Reemplazar todo el contenido de `app/page.tsx`:
      ```tsx
      import { CategoriesSection } from "@/components/public/CategoriesSection";
      import { ContactSection } from "@/components/public/ContactSection";
      import { Faq } from "@/components/public/Faq";
      import { Hero } from "@/components/public/Hero";
      import { HowWeWork } from "@/components/public/HowWeWork";
      import { MapBrandProtection } from "@/components/public/MapBrandProtection";
      import { SiteFooter } from "@/components/public/SiteFooter";
      import { WhyUs } from "@/components/public/WhyUs";

      export const metadata = {
        title: "RANIC GROUP LLC | Wholesale Buyer & Amazon Seller",
        description:
          "U.S.-based wholesale buyer and Amazon seller in Summit, NJ, purchasing inventory directly from brands with MAP discipline.",
        alternates: { canonical: "/" },
        openGraph: {
          title: "RANIC GROUP LLC | Wholesale Buyer & Amazon Seller",
          description:
            "U.S.-based wholesale buyer and Amazon seller in Summit, NJ, purchasing inventory directly from brands.",
          url: "https://www.ranicgroup.com/",
          siteName: "RANIC GROUP LLC",
          type: "website",
        },
      };

      export default function Home() {
        return (
          <>
            <main className="flex-1">
              <Hero />
              <WhyUs />
              <HowWeWork />
              <CategoriesSection />
              <MapBrandProtection />
              <Faq />
              <ContactSection />
            </main>
            <SiteFooter />
          </>
        );
      }
      ```
- [ ] **Step 2:** Verificar: `npm run dev`, abrir `/` y revisar visualmente las 7 secciones en
      orden, responsive (mobile: todo a una columna) y que el formulario de contacto funcione
      (ver Task 7, Step 5). `npm run build` pasa.
- [ ] **Step 3:** Commit:
      ```bash
      git add app/page.tsx
      git commit -m "feat: assemble v2 home page with 7 sections"
      ```

---

## Task 9: `/privacy` y `/terms` en inglés

**Files:**
- Modify: `app/privacy/page.tsx`
- Modify: `app/terms/page.tsx`

**Interfaces:**
- No cambia ninguna firma — mismos `export default function PrivacyPage()` /
  `TermsPage()`, sin props.

- [ ] **Step 1:** Reemplazar todo el contenido de `app/privacy/page.tsx`:
      ```tsx
      import type { Metadata } from "next";
      import { SiteFooter } from "@/components/public/SiteFooter";

      export const metadata: Metadata = {
        title: "Privacy Policy",
        description:
          "How RANIC GROUP LLC collects and uses information on ranicgroup.com.",
        alternates: { canonical: "/privacy" },
      };

      export default function PrivacyPage() {
        return (
          <>
            <main className="flex-1 px-6 py-16">
              <div className="mx-auto max-w-3xl">
                <h1 className="font-display text-3xl font-bold text-ink">
                  Privacy Policy
                </h1>
                <p className="mt-2 text-sm text-ink-soft">
                  Last updated: June 2026.
                </p>

                <div className="mt-10 space-y-8 text-sm leading-relaxed text-ink">
                  <section>
                    <h2 className="font-display text-lg font-semibold text-ink">
                      Information we collect
                    </h2>
                    <p className="mt-2">
                      This site has a contact form. If you submit it, we
                      collect your company/brand name, contact name, email
                      address, the category you select, and your message.
                      That information is sent directly to our email through
                      Resend, a transactional email provider — it is not
                      stored in any database on this site. If you email us
                      directly instead, that communication stays in our
                      inbox. To understand site traffic, we use Vercel
                      Analytics, which records visits in an aggregated,
                      anonymous way, without third-party tracking cookies and
                      without identifying individual visitors.
                    </p>
                  </section>

                  <section>
                    <h2 className="font-display text-lg font-semibold text-ink">
                      How we use this information
                    </h2>
                    <p className="mt-2">
                      We use contact form submissions to respond to your
                      inquiry, and aggregated Vercel Analytics data to
                      understand how many people visit the site and improve
                      its content. We don&apos;t sell or share visitor or
                      contact information with third parties.
                    </p>
                  </section>

                  <section>
                    <h2 className="font-display text-lg font-semibold text-ink">
                      Cookies
                    </h2>
                    <p className="mt-2">
                      This site does not use third-party tracking cookies.
                    </p>
                  </section>

                  <section>
                    <h2 className="font-display text-lg font-semibold text-ink">
                      Third-party links
                    </h2>
                    <p className="mt-2">
                      This site is informational. Any purchase of our
                      products happens on third-party platforms, subject to
                      their own privacy policies, not this one.
                    </p>
                  </section>

                  <section>
                    <h2 className="font-display text-lg font-semibold text-ink">
                      Changes to this policy
                    </h2>
                    <p className="mt-2">
                      We may update this policy occasionally. The date of the
                      last update always appears at the top of this page.
                    </p>
                  </section>

                  <section>
                    <h2 className="font-display text-lg font-semibold text-ink">
                      Contact
                    </h2>
                    <p className="mt-2">
                      For any privacy questions, write to us at{" "}
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
- [ ] **Step 2:** Reemplazar todo el contenido de `app/terms/page.tsx`:
      ```tsx
      import type { Metadata } from "next";
      import { SiteFooter } from "@/components/public/SiteFooter";

      export const metadata: Metadata = {
        title: "Terms of Use",
        description: "Terms of use for ranicgroup.com.",
        alternates: { canonical: "/terms" },
      };

      export default function TermsPage() {
        return (
          <>
            <main className="flex-1 px-6 py-16">
              <div className="mx-auto max-w-3xl">
                <h1 className="font-display text-3xl font-bold text-ink">
                  Terms of Use
                </h1>
                <p className="mt-2 text-sm text-ink-soft">
                  Last updated: June 2026.
                </p>

                <div className="mt-10 space-y-8 text-sm leading-relaxed text-ink">
                  <section>
                    <h2 className="font-display text-lg font-semibold text-ink">
                      Acceptance of terms
                    </h2>
                    <p className="mt-2">
                      By using this site, you accept these terms of use. If
                      you disagree, please don&apos;t use it.
                    </p>
                  </section>

                  <section>
                    <h2 className="font-display text-lg font-semibold text-ink">
                      Use of the site
                    </h2>
                    <p className="mt-2">
                      This site is informational: it presents RANIC GROUP LLC
                      as a wholesale buyer and Amazon seller, and the product
                      categories we purchase. We don&apos;t sell products
                      directly through this site — any transaction happens
                      on third-party marketplaces, outside our control.
                    </p>
                  </section>

                  <section>
                    <h2 className="font-display text-lg font-semibold text-ink">
                      Intellectual property
                    </h2>
                    <p className="mt-2">
                      The content of this site (text, design, brand) belongs
                      to RANIC GROUP LLC. It may not be reproduced without
                      authorization.
                    </p>
                  </section>

                  <section>
                    <h2 className="font-display text-lg font-semibold text-ink">
                      No warranties
                    </h2>
                    <p className="mt-2">
                      This site is provided &quot;as is&quot;, with no
                      warranties of any kind regarding its availability or
                      accuracy.
                    </p>
                  </section>

                  <section>
                    <h2 className="font-display text-lg font-semibold text-ink">
                      Limitation of liability
                    </h2>
                    <p className="mt-2">
                      RANIC GROUP LLC is not liable for damages arising from
                      the use or inability to use this site.
                    </p>
                  </section>

                  <section>
                    <h2 className="font-display text-lg font-semibold text-ink">
                      Governing law
                    </h2>
                    <p className="mt-2">
                      These terms are governed by the laws of the State of
                      New Jersey, United States.
                    </p>
                  </section>

                  <section>
                    <h2 className="font-display text-lg font-semibold text-ink">
                      Contact
                    </h2>
                    <p className="mt-2">
                      For any questions about these terms, write to us at{" "}
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
- [ ] **Step 3:** Verificar: `npm run dev`, abrir `/privacy` y `/terms` — texto completo en
      inglés, sin layout roto. `npm run build` pasa.
- [ ] **Step 4:** Commit:
      ```bash
      git add app/privacy/page.tsx app/terms/page.tsx
      git commit -m "feat: translate privacy and terms pages to English, disclose contact form data"
      ```

---

## Task 10: Verificación final, doc y push

**Files:**
- Modify: `CLAUDE.md` (actualizar pointer a la v2)

**Steps:**
- [ ] **Step 1:** En `CLAUDE.md`, en la sección "Documentos rectores", bajo "Fase 2 — Sitio
      público", agregar una línea apuntando a este plan y al spec v2:
      ```md
      - **Spec v2 (revisión):** `docs/superpowers/specs/2026-06-27-ranic-public-site-v2-design.md`
      - **Plan v2 (revisión):** `docs/superpowers/plans/2026-06-27-ranic-public-site-v2.md`
      ```
- [ ] **Step 2:** `npm run build` — debe pasar sin errores ni warnings de tipos.
- [ ] **Step 3:** `npm run dev` y revisar manualmente:
      - `/` en inglés: las 7 secciones en orden, hero con mención de Amazon, FAQ funcionando con
        `<details>`, formulario de contacto enviando y mostrando el mensaje de éxito.
      - Responsive (mobile: una columna en todas las secciones).
      - `prefers-reduced-motion` activado — el sello del hero aparece sin animación.
      - `/privacy` y `/terms` en inglés, con la sección de privacidad mencionando el formulario y
        Resend.
      - `/sitemap.xml` y `/robots.txt` responden correctamente.
      - Confirmar que `/admin` sigue funcionando igual que antes, en español, sin cambios.
- [ ] **Step 4:** Confirmar con Nico que la `RESEND_API_KEY` real ya está cargada en Vercel
      (Project Settings → Environment Variables) antes de pedir el siguiente deploy de preview.
- [ ] **Step 5:** Commit y push:
      ```bash
      git add CLAUDE.md
      git commit -m "docs: point CLAUDE.md to Fase 2 v2 spec and plan"
      git push origin fase-2-sitio-publico
      ```
- [ ] **Step 6:** Confirmar que el preview de Vercel del PR #2 (ya existente, se actualiza solo
      con este push) pasa el build, y avisar para revisión antes de mergear — no mergear sin
      aprobación explícita.

---

## Self-Review (cobertura del spec v2)

- Idioma: todo el contenido público en inglés, CRM intacto en español → Tasks 1-2, 9. ✅
- Mención abierta de Amazon en el sitio (vs. regla de los emails, que no se toca) → Task 2
  (Hero). ✅
- 7 secciones nuevas (Hero, Why Us, How We Work, Categories, MAP & Brand Protection, FAQ,
  Contact) → Tasks 2-8. ✅
- Formulario de contacto con envío real vía Resend, sin almacenamiento ni cambios en `/admin` →
  Task 7. ✅
- SEO técnico (metadata por página, OG, sitemap, robots, canonical, JSON-LD `Organization`) →
  Tasks 1, 8, 9. ✅
- `/privacy` actualizado para reflejar el formulario nuevo → Task 9. ✅
- Identidad visual extendida (no reemplazada): tarjeta PO/sello sin cambios, nuevas secciones con
  tratamiento propio dentro del mismo sistema, sin usar `olive-tint` ni tokens de semáforo del
  CRM → Tasks 3-6 (ver Global Constraints). ✅
- PR #2 no se mergea hasta aprobación explícita → Task 10, Step 6. ✅
