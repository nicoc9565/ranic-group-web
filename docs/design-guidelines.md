# RANIC CRM — Guía de diseño visual

Dirección para implementar la UI del CRM. Es una **herramienta operativa de uso diario** (no una
landing de marketing): densa en datos, escaneable, con carácter. Concepto rector: **"consola de
operaciones / manifiesto de almacén"** — el mundo del negocio es wholesale, catálogos, UPCs,
fechas, montos y seguimiento de envíos, y la interfaz lo refleja.

## Concepto

El acto central del CRM es **seguir el estado de cada proveedor a lo largo de una secuencia**
(Day 1 → 4 → 7 → 12), igual que se sigue un envío. Esa metáfora de *tracking logístico* es la
columna vertebral del diseño y su elemento memorable.

## Paleta (tokens Tailwind)

| Token | Hex | Uso |
|---|---|---|
| `olive` | `#556B2F` | Marca/primario: sidebar, botones primarios, acentos |
| `olive-deep` | `#3E4F1D` | Sidebar activo, hover de primarios |
| `olive-tint` | `#EDF0E4` | Fondos sutiles: fila hover, badges, selección |
| `stone` | `#F3F4EF` | Fondo de la app (neutro frío levemente verdoso — NO cream cliché) |
| `surface` | `#FFFFFF` | Cards y tablas |
| `ink` | `#1C1B17` | Texto principal (casi negro cálido, dialoga con olive) |
| `ink-soft` | `#6B6A60` | Texto secundario / labels / muted |
| `line` | `#E4E4DD` | Hairlines, bordes de tabla y cards |

**Estados de follow-up — semáforo logístico** (no rojo/amarillo/verde puros; tonos apagados que
conviven con el olive):

| Token | Hex | Significado |
|---|---|---|
| `status-overdue` | `#B23A2E` | Vencido (rojo ladrillo) |
| `status-today` | `#C98A2B` | Vence hoy (ámbar/mostaza) |
| `status-ontrack` | `#4E7A3F` | En fecha (verde) |

## Tipografía (todas Google Fonts vía `next/font`)

- **Display / titulares de sección y números de métricas:** `Space Grotesk` (600/700).
  Geométrico, técnico, con personalidad — sin caer en el serif editorial cliché.
- **Eyebrows / labels de sección:** `Archivo Expanded` (o `Archivo` con `tracking-widest`),
  uppercase, tamaño chico, color `ink-soft`. Da el aire de etiqueta de almacén.
- **Body / UI / tablas:** `Inter`. Neutral y legible en densidad alta.
- **Datos "de máquina":** `JetBrains Mono`. Usar SIEMPRE para **email, website, UPC, fechas,
  montos, contadores e IDs**. Es lo que ancla el mundo de catálogos/datos.

Escala de tipo clara: métricas grandes (Space Grotesk ~32–40px), títulos de sección ~20–24px,
body 14–15px, datos mono 13–14px, eyebrows 11–12px uppercase.

## Layout

- **Desktop:** sidebar fija a la izquierda con fondo `olive-deep` y texto crema; ítem activo en
  `olive` más claro con barra/realce. Contenido sobre fondo `stone`, cards `surface` con borde
  `line` hairline.
- **Mobile:** bottom nav fija (mismos ítems), contenido a ancho completo.
- **Densidad:** herramienta de trabajo → compacta pero respirable. Filas de tabla ~44px.
- **Radius:** 6px en cards, 4px en controles. Nada de 0px (cliché broadsheet) ni full-pill,
  salvo los badges de estado.
- **Tablas:** hairlines `line`, header con eyebrow, fila hover en `olive-tint`, estado como pill
  con punto de color del semáforo.

## Elemento de firma — "Follow-up Track"

El componente memorable: una **mini-timeline de tracking** de la secuencia Day 1 → 4 → 7 → 12.
Cuatro nodos conectados por una línea; los pasos ya enviados se rellenan en `olive`, el próximo
paso se resalta con el color del semáforo según urgencia (overdue/today/ontrack). Aparece:
- en las **alertas del dashboard** (versión compacta por proveedor),
- en el **detalle del proveedor** (versión completa con fechas bajo cada nodo).

Al "marcar como enviado", el siguiente nodo se rellena con una transición breve (respetar
`prefers-reduced-motion`).

## Motion

Discreto y al servicio del dato. Hover states en filas y botones; la animación de avance del
Follow-up Track es el único momento orquestado. Sin animaciones ambientales decorativas (suman
sensación de "generado por IA").

## Quality floor

Responsive hasta mobile, foco de teclado visible, `prefers-reduced-motion` respetado, contraste
AA en texto sobre olive. Copy en español, claro y en voz activa ("Marcar como enviado",
"Copiar email", "Nuevo proveedor"); los estados vacíos invitan a actuar, los errores explican
qué pasó y cómo resolverlo.
