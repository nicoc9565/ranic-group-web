# RANIC GROUP — Guía de diseño visual (sitio público) — v4 "orgánico premium"

Dirección para implementar `/`, `/privacy` y `/terms`. **No modifica**
`docs/design-guidelines.md` (esa sigue siendo la guía del CRM en `/admin`, intacta).

> **v4 (re-piel orgánica premium).** Reemplaza la estética "documento/kraft" de v2–v3:
> se elimina la tarjeta Purchase Order, el sello APROBADO y el motivo kraft-documento.
> La firma visual pasa a ser el **follaje SVG ilustrado** desbordando esquinas, sobre un
> sistema de degradé oliva profundo, fondos cream cálidos, paneles flotantes y CTA pill
> dorado. Sin fotografía ni imágenes raster: toda la materia visual es código (SVG).

## Concepto

Naturaleza disciplinada: lo orgánico (hojas, verdes profundos, dorado cálido) transmite
crecimiento y cuidado; la ejecución (grillas limpias, paneles con sombra suave, tipografía
apretada) transmite seriedad operativa. La audiencia sigue siendo un brand manager que
verifica que RANIC es real y seria antes de responder un outreach.

## Paleta (tokens Tailwind — extienden, no reemplazan, los del CRM)

| Token | Hex | Rol |
|---|---|---|
| `olive` | `#556B2F` | Acentos sobre claro, eyebrows, chips, paso numerado |
| `olive-deep` | `#3E4F1D` | Inicio del degradé firma, wordmark del logo (header) |
| `forest` | `#26330F` | **Nuevo.** Fin del degradé, fondos oscuros profundos |
| `sage` | `#8CA06A` | **Nuevo.** Hojas claras, detalles/credencial sobre oscuro |
| `gold` | `#C7A662` | **Nuevo.** CTA principal, eyebrows sobre oscuro, acentos cálidos |
| `cream` | `#F5F1E6` | **Nuevo.** Fondo claro cálido del sitio público (reemplaza a `stone` acá) |
| `kraft` | `#D9CBA3` | Legado; ya no protagoniza (sin motivo documento) |
| `ink` / `ink-soft` / `line` / `surface` | — | Texto, hairlines y paneles blancos (heredados) |

- **Degradé firma:** `bg-gradient-to-br from-olive-deep to-forest` (hero, banda MAP, footer).
- **`stamp` no se usa** en el sitio público (el error del form usa `status-overdue`).
- Texto del CTA dorado: `#2C3A12` (hex directo). Hover del pill del header: `#B8965A`.
- Chips de tarjeta: `#EAF0DE` (verde tenue) y `#F3E9D2` (dorado tenue), hex directos.

## Tipografía

- **Display / titulares: League Spartan** (`font-league`, extrabold, `tracking-tight`) — la
  fuente del logo. Titulares grandes con `leading` ~0.98 en el hero.
- **Body: Inter** (`font-sans`). Eyebrows: Inter semibold uppercase `tracking-[0.22em]`,
  `text-gold` sobre oscuro y `text-olive` sobre claro.
- **Mono: JetBrains Mono** (`font-mono`) — líneas de credencial/datos y chips de categoría.
- Space Grotesk (`font-display`) es del CRM; no se usa en el sitio público.

## Firma visual — follaje SVG (`components/public/Foliage.tsx`)

Hojas sólidas con nervaduras, en capas de tonos oliva/sage/gold, **siempre desbordando una
esquina** (el contenedor lleva `overflow-hidden`); nunca en medallón/círculo ni centradas como
ilustración. Tres exports:

- `Foliage` — arreglo grande (~7 hojas) para el hero (esquina superior derecha).
- `FoliageAccent` — 2 hojas tenues para banda MAP (inferior izquierda) y footer (superior derecha).
- `LeafIcon` — hoja individual para los chips de las tarjetas de Why Us.

Todo `aria-hidden` (decorativo). La Purchase Order y su animación de sello quedaron eliminadas
(keyframes `po-card-in`/`stamp-in` removidos de `globals.css`).

## Componentes del sistema

- **Paneles flotantes:** `bg-surface rounded-2xl shadow-[0_10px_26px_rgba(38,51,15,0.09)]`;
  hover `hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(38,51,15,0.14)] transition
  duration-200` (credenciales, Why Us, categorías, form de contacto).
- **CTA principal:** pill `rounded-full bg-gold text-[#2C3A12] font-semibold` con sombra suave
  y micro-lift al hover (hero, header, submit del form).
- **Tarjetas suaves sobre blanco:** `bg-cream rounded-2xl` sin sombra (pasos de How We Work,
  filas del FAQ).
- **Chips:** código de categoría en pill `bg-olive/10 text-olive font-mono`; ícono de hoja en
  cuadrado redondeado `rounded-xl` con fondo tenue.

## Estructura de la Home

Header sticky `bg-cream/95 backdrop-blur` (logo + nav de anclas + pill dorado) y luego:
Hero (degradé + follaje + credencial en sage) → CredentialsBar (panel flotante 4 hechos) →
About (`#about`, blanco) → Why Us (cream, 4 paneles con hoja) → How we work (`#how-we-work`,
blanco, pasos 01→04, el 04 en gold) → Categories (`#categories`, cream, paneles con chip) →
banda MAP (degradé + FoliageAccent) → FAQ (`#faq`, blanco, filas cream) → Contact (`#contact`,
cream, panel blanco con el **form real intacto** → `/api/contact` vía Resend) → Footer
(degradé + FoliageAccent + logo crema + links About/Privacy/Terms).

Anclas con `scroll-mt-20`. `main` de la Home con `bg-cream`.

### Páginas `/privacy` y `/terms`

Mismo header/footer; `main` con `bg-cream`; títulos en League Spartan. Texto legal intacto.

## Motion

Sin animación de carga (la del sello se eliminó). Solo micro-interacciones: lift + sombra en
paneles y CTAs (`transition duration-200`). `prefers-reduced-motion` respetado (bloque global
en `globals.css`).

## Quality floor

Responsive completo (header colapsa a menú; grillas a 1 columna; credenciales 2x2). Foco de
teclado visible. Contraste AA: `cream` sobre degradé oscuro, `#2C3A12` sobre `gold`, `ink`
sobre `cream`/`surface`. Copy en **inglés**, voz activa, sin relleno. En el sitio público sí
se menciona Amazon (distinto de los emails del CRM). El formulario de contacto (Resend) se
conserva tal cual — su lógica y endpoint no se tocan.
