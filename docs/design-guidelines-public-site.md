# RANIC GROUP — Guía de diseño visual (sitio público)

Dirección para implementar `/`, `/privacy` y `/terms`. **No modifica**
`docs/design-guidelines.md` (esa sigue siendo la guía del CRM en `/admin`, intacta).

## Concepto

El objeto central del mundo de un proveedor wholesale es la **orden de compra**: el documento
que confirma que alguien va a comprarle, en qué términos, y si fue aprobado. El hero de esta
página usa ese objeto literalmente — una tarjeta con la forma de una purchase order, con un
sello "APROBADO" que se asienta al cargar — en vez de un stat-card genérico. Es la pieza
memorable de la página.

## Paleta (tokens Tailwind — extienden, no reemplazan, los del CRM)

| Token | Hex | Uso | Origen |
|---|---|---|---|
| `olive` | `#556B2F` | CTA primario, acentos | Heredado del CRM |
| `olive-deep` | `#3E4F1D` | Banda de la sección CTA, texto fuerte | Heredado del CRM |
| `stone` | `#F3F4EF` | Fondo general | Heredado del CRM |
| `ink` | `#1C1B17` | Texto principal | Heredado del CRM |
| `ink-soft` | `#6B6A60` | Texto secundario | Heredado del CRM |
| `kraft` | `#D9CBA3` | Fondo/borde de la tarjeta "Purchase Order" | **Nuevo**, de este sitio |
| `stamp` | `#B23A2E` | El sello "APROBADO" y su realce | **Nuevo** (mismo rojo que `status-overdue` del CRM — refuerzo intencional de marca, no coincidencia) |

No usar `olive-tint` ni los demás tokens de semáforo del CRM (`status-today`,
`status-ontrack`) — son específicos del lenguaje de follow-up del CRM y no aplican acá.

## Tipografía

Mismas 3 familias que el CRM, vía `next/font` (ya configuradas en el proyecto):

- **Display:** `Space Grotesk` (600/700) — titulares del hero y de cada sección.
- **Body:** `Inter` — párrafos, botones, nav.
- **Mono:** `JetBrains Mono` — específicamente para los "datos de la PO" en el hero (`BUYER:`,
  `TERMS: NET 30`, etc.) y para los códigos cortos en las tarjetas de categoría. No usar mono
  para texto largo.

No usar `Archivo` (esa es la fuente de eyebrows del CRM, este sitio no tiene eyebrows
numerados — ver más abajo).

## Layout

One-pager, sin densidad de dashboard. Cuatro secciones, en este orden:

### 1. Hero
- Layout asimétrico en desktop (50/50): izquierda = headline (Space Grotesk, grande) + subhead
  (Inter) + botón CTA primario; derecha = la tarjeta "Purchase Order" (signature element, ver
  abajo). En mobile, la tarjeta va debajo del texto, ambos a ancho completo.
- Headline: mensaje de comprador wholesale, sin mencionar Amazon, coherente con los emails
  (ver spec §8).
- Botón CTA primario en `olive`, texto "Trabajá con nosotros" → `mailto:`.

### 2. Categorías
- Eyebrow simple "Categorías que compramos" (Inter, no Archivo — este sitio no hereda el
  estilo de eyebrow uppercase del CRM).
- Grilla de 4 tarjetas (2x2 en desktop, 1 columna en mobile), una por categoría de §5 del spec.
  Cada tarjeta: un código corto en `JetBrains Mono` (ej. `BPC`, `H&P`, `E&T`, `GM`) + nombre de
  la categoría + una línea descriptiva.
- **Sin numeración (01/02/03/04):** el orden de las categorías no encierra información, así que
  no se numeran — ver Design Principles, "Structure is information".

### 3. CTA "Trabajá con nosotros"
- Banda de ancho completo en fondo `olive-deep`, texto en `stone`/blanco.
- Mensaje corto reforzando "recurring monthly orders" + botón "Escribinos" → mismo `mailto:`
  del hero (redundante a propósito: es el segundo y último punto de conversión de la página).

### 4. Footer
- Estilo "etiqueta de envío": una sola línea en `JetBrains Mono`, separada por `·`:
  `RANIC GROUP LLC · Summit, NJ · +1 (201) 572-1383 · Privacidad · Términos`
- Los links de Privacidad/Términos van a `/privacy` y `/terms`.

### Páginas `/privacy` y `/terms`
- Mismo header/footer simple que la home (sin el hero ni las demás secciones).
- Tipografía: título en Space Grotesk, cuerpo en Inter. Sin tarjeta PO ni sello — esas páginas
  son de lectura, no de conversión.

## Signature element — "Purchase Order" + sello

Tarjeta con fondo `kraft`, borde fino, esquinas levemente redondeadas (no 0px, no pill).
Contenido en `JetBrains Mono`:
```
PURCHASE ORDER
───────────────────
BUYER:    RANIC GROUP LLC
TERMS:    NET 30
STATUS:   [ sello: APROBADO ]
```
El sello es un elemento rotado ~-8°, color `stamp`, borde tipo sello de goma (doble borde o
textura simple), con la palabra "APROBADO" en mayúsculas, Space Grotesk bold.

**Animación de carga (única animación orquestada de la página):** la tarjeta aparece primero
(fade + slide sutil), y 200-300ms después el sello "cae" y asienta con un pequeño rebote
(scale 1.15 → 1.0 con leve overshoot, más la rotación final). Con `prefers-reduced-motion:
reduce`, el sello aparece directamente en su posición final, sin animación.

## Motion (general)

Fuera de la animación del sello: hover sutil (leve elevación/sombra) en las tarjetas de
categoría y en los botones CTA. Nada de animación ambiental ni scroll-reveal en cada sección —
la página es corta y no lo necesita.

## Quality floor

Responsive completo (hero pasa a columna única en mobile, grilla de categorías a 1 columna).
Foco de teclado visible en CTAs y links. `prefers-reduced-motion` respetado. Contraste AA en
texto sobre `olive-deep` y sobre `kraft`. Copy en español, voz activa, sin relleno.
