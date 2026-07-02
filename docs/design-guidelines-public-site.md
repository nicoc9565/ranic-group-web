# RANIC GROUP — Guía de diseño visual (sitio público) — v3

Dirección para implementar `/`, `/privacy` y `/terms`. **No modifica**
`docs/design-guidelines.md` (esa sigue siendo la guía del CRM en `/admin`, intacta).

> **v3 (rediseño con más presencia).** Cambios clave respecto de v1/v2: fuente display
> **League Spartan** (la del logo) en lugar de Space Grotesk; **logo recreado en código**;
> **header fijo**; nuevas secciones (barra de credenciales, About Us); FAQ ampliado; footer
> completo sobre `olive-deep`. El idioma del sitio es **inglés** (empresa y audiencia de EE.UU.)
> y el CTA principal hace **scroll al formulario de contacto** (`#contact`), no `mailto:`.

## Concepto

El objeto central del mundo de un proveedor wholesale es la **orden de compra**: el documento
que confirma que alguien va a comprarle, en qué términos, y si fue aprobado. El hero de esta
página usa ese objeto literalmente — una tarjeta con la forma de una purchase order, con un
sello "APROBADO" que se asienta al cargar — en vez de un stat-card genérico. Es la pieza
memorable de la página. El lenguaje de "documento oficial verificado" se extiende con disciplina
a la **barra de credenciales** (hechos duros presentados como datos validados).

## Paleta (tokens Tailwind — extienden, no reemplazan, los del CRM)

| Token | Hex | Uso | Origen |
|---|---|---|---|
| `olive` | `#556B2F` | CTA primario, acentos, links | Heredado del CRM |
| `olive-deep` | `#3E4F1D` | Footer, wordmark del logo (header), texto fuerte | Heredado del CRM |
| `stone` | `#F3F4EF` | Fondo general, fondo del header | Heredado del CRM |
| `ink` | `#1C1B17` | Texto principal | Heredado del CRM |
| `ink-soft` | `#6B6A60` | Texto secundario | Heredado del CRM |
| `kraft` | `#D9CBA3` | Tarjeta "Purchase Order"; fondo tenue de la barra de credenciales (`kraft/20`) | **Nuevo**, de este sitio |
| `stamp` | `#B23A2E` | **Solo** el sello "APROBADO" — en ningún otro lado | **Nuevo** (mismo rojo que `status-overdue` del CRM — refuerzo intencional de marca) |

Crema del logo en fondo oscuro: `#F1EBDA` (hex directo, no token). No usar `olive-tint` ni los
tokens de semáforo del CRM (`status-today`, `status-ontrack`).

## Tipografía

Vía `next/font` (ya configuradas en el proyecto):

- **Display / titulares: `League Spartan`** (`font-league`, pesos 500/700/800) — la fuente del
  logo: la marca "habla" con sus propias letras. Titulares del hero, secciones, About, contacto,
  páginas legales y logo. Interletrado apretado (`tracking-tight`, ~`-0.03em` a `-0.055em` en
  tamaños grandes). **Reemplaza a Space Grotesk en el sitio público.** Space Grotesk
  (`font-display`) sigue siendo del CRM — no se toca esa guía.
- **Body: `Inter`** (`font-sans`) — párrafos, nav, botones.
- **Mono: `JetBrains Mono`** (`font-mono`) — datos de la PO en el hero, líneas de credencial,
  códigos de categoría, datos de contacto y línea del footer. No usar mono para texto largo.

No usar `Archivo` (eyebrows del CRM).

## Logo (recreado en código) — `components/public/Logo.tsx`

Wordmark **"ranic group."** + "LLC" en League Spartan, peso 800, `tracking-[-0.055em]`, sin
bajada. Componente de texto estilado (no imagen): nítido, transparente, recoloreable, liviano.

- **`variant="light"` (fondo claro, header):** wordmark `#3E4F1D` (`olive-deep`); el punto "." y
  "LLC" en `#556B2F` (`olive`).
- **`variant="dark"` (fondo oscuro `olive-deep`, footer):** todo en crema `#F1EBDA`.

## Estructura de la Home (orden de secciones)

Header fijo + one-pager. Componentes en `components/public/`, ensamblados en `app/page.tsx`:

1. **Header (`SiteHeader.tsx`)** — sticky, fondo `stone/95` con `backdrop-blur` y borde inferior
   `line`. Izquierda: `<Logo variant="light">`. Desktop: nav de anclas **About · How we work ·
   Categories · FAQ** + botón **"Work with us"** (`olive`, → `#contact`). Mobile: logo + botón
   hamburguesa que despliega el nav.
2. **Hero (`Hero.tsx`)** — 50/50 en desktop (tarjeta debajo en mobile). Izquierda: titular grande
   en League Spartan, subhead en Inter, CTA `olive` "Work with us" (→ `#contact`) y línea de
   credencial en mono `Registered U.S. LLC · Summit, NJ`. Derecha: `<PurchaseOrderCard>`.
3. **Barra de credenciales (`CredentialsBar.tsx`)** — banda `kraft/20` con borde, 4 hechos duros
   (label mono + dato en League Spartan). 4 columnas en desktop, 2x2 en mobile. Sin números de
   catálogo ni año.
4. **About Us (`AboutUs.tsx`)** — ancla `#about`. "Who we are" + 1–2 párrafos con sustancia.
5. **Why brands work with us (`WhyUs.tsx`)** — 4 tarjetas (MAP discipline, Transparent sourcing,
   Long-term focus, U.S. operations), glyph en círculo kraft, copy desarrollado.
6. **How we work (`HowWeWork.tsx`)** — ancla `#how-we-work`. 4 pasos **numerados** `01→04` (el
   orden encierra información — proceso real).
7. **Categories we buy (`CategoriesSection.tsx`)** — ancla `#categories`. Grilla 2x2 con código
   mono por categoría (BPC, H&P, E&T, GM).
8. **MAP & brand protection (`MapBrandProtection.tsx`)** — señal de confianza para marcas.
9. **FAQ (`Faq.tsx`)** — ancla `#faq`. Preguntas de legitimidad (registro, MAP, marketplaces,
   compra directa, cómo empezar).
10. **Contact (`ContactSection.tsx`)** — ancla `#contact`. **El formulario de contacto ya existe
    y se conserva tal cual** (campos Company/Brand, Contact Name, Email, Category, Message → POST
    a `/api/contact` vía Resend). No se toca su lógica ni el endpoint. Solo se refresca lo visual:
    título en League Spartan y una línea de datos reales
    (`nicolas.conti@ranicgroup.com · +1 (201) 572-1383 · Summit, NJ`). El `mailto:` de "Write to
    us directly" se conserva como alternativa secundaria.
11. **Footer (`SiteFooter.tsx`)** — fondo `olive-deep`. `<Logo variant="dark">` (crema), links
    **About · Privacy · Terms**, y línea final en mono `RANIC GROUP LLC · Summit, NJ · … · © 2026`.

Las anclas usan `scroll-mt-20` para que el header fijo no tape los títulos al saltar.

### Páginas `/privacy` y `/terms`

Mismo `SiteHeader` + `SiteFooter` que la home (sin hero ni secciones). Títulos en League Spartan
(`font-league`), cuerpo en Inter. **El texto legal no se reescribe** — solo el marco visual
(header + fuente de títulos). Sin tarjeta PO ni sello (son páginas de lectura, no de conversión).

## Signature element — "Purchase Order" + sello

Tarjeta con fondo `kraft`, borde fino, esquinas levemente redondeadas. Contenido en JetBrains
Mono (`BUYER:`, `TERMS: NET 30`, `STATUS: [ APROBADO ]`). El sello es un elemento rotado ~-8°,
color `stamp`, con "APROBADO" en mayúsculas.

**Animación de carga (única animación orquestada):** la tarjeta aparece primero (fade + slide),
y 200–300ms después el sello "cae" y asienta con leve overshoot + rotación. Con
`prefers-reduced-motion: reduce`, el sello aparece directo en su posición final.

## Motion (general)

Fuera de la animación del sello: micro-interacciones sobrias (leve elevación/sombra en tarjetas y
botones; el header fijo puede ganar una leve sombra al hacer scroll). Nada de scroll-reveal por
sección ni animación ambiental.

## Quality floor

Responsive completo (header colapsa a menú; hero a columna única; grillas a 1 columna;
credenciales a 2x2). Foco de teclado visible en nav, CTAs y links. `prefers-reduced-motion`
respetado (bloque global en `globals.css`). Contraste AA sobre `olive-deep`, `kraft` y `stone`.
Copy en **inglés**, voz activa, sin relleno. En el sitio público **sí se menciona Amazon**
abiertamente (distinto de los emails del CRM, que nunca lo mencionan — audiencias y momentos
distintos).
