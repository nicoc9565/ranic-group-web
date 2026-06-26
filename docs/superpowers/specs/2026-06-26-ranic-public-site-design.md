# RANIC GROUP — Sitio público (Fase 2)

**Fecha:** 2026-06-26
**Estado:** Aprobado por el usuario
**Repo:** `ranic-web` (mismo proyecto Next.js que ya tiene el CRM en `/admin`)
**Dominio:** ranicgroup.com

---

## 1. Resumen

Rediseño completo del sitio público de RANIC GROUP LLC (`/`, `/privacy`, `/terms`), que hoy es
solo un placeholder ("RANIC GROUP LLC" centrado, de la Fase 1). Convive en el mismo repo y
proyecto Next.js que el CRM (`/admin`), sin tocar nada de la Fase 1.

## 2. Objetivo y audiencia

- **Objetivo:** credibilidad institucional + generación de leads de proveedores. El sitio
  refuerza lo que ya dice un email de primer contacto, para que un proveedor que recibió ese
  email confíe en que RANIC GROUP LLC es una empresa real y seria, y responda.
- **Audiencia:** casi exclusivamente proveedores/marcas potenciales que ya recibieron (o van a
  recibir) un email de outreach de RANIC. No es una landing para tráfico general ni para
  clientes finales (esos compran en el marketplace, no acá).
- **No objetivo:** captura de leads vía formulario propio. El canal de outreach real ya es el
  email gestionado desde el CRM; este sitio no duplica esa función.

## 3. Estructura del sitio

- **`/`** — página única (one-pager) con 4 secciones: Hero → Categorías → CTA "Trabajá con
  nosotros" → Footer/contacto.
- **`/privacy`** — política de privacidad, contenido nuevo (ver §6).
- **`/terms`** — términos de uso, contenido nuevo (ver §6).
- Mismo repo y deploy que el CRM; rutas públicas (`/`, `/privacy`, `/terms`) sin autenticación,
  conviven con `/admin` (autenticado, sin tocar).

## 4. Contacto / CTA

- Botón **"Trabajá con nosotros"** → `mailto:nicolas.conti@ranicgroup.com`. Sin formulario, sin
  backend nuevo, sin colección de Firestore adicional.
- El seguimiento de cualquier proveedor que escriba desde acá sigue pasando por el CRM
  (`/admin`), igual que cualquier otro proveedor.

## 5. Categorías (sección "Sobre nosotros")

Se presentan **4 categorías de presentación** (agrupación de las 6 categorías operativas del
CRM, solo para esta vista pública — la taxonomía interna del CRM no cambia):

| Categoría pública | Categorías CRM que agrupa |
|---|---|
| Beauty & Personal Care | Fragancias & Beauty + Health & Personal Care |
| Home & Pet | Home Products + Pet Products |
| Entertainment & Toys | Entertainment & Toys |
| General Merchandise | General Merchandise |

## 6. Contenido legal

`/privacy` y `/terms` se escriben **de cero** (no se recupera el contenido del sitio viejo —
descartado explícitamente por el usuario). Deben ser textos reales y razonables para una LLC de
wholesale/retail online operando desde Summit, NJ, cubriendo como mínimo:

- **Analítica:** el sitio usa **Vercel Analytics** (`@vercel/analytics`, ya disponible en el
  plan de Vercel del proyecto) para conteo de visitas — sin cookies de terceros, sin tracking
  individual. No se agrega Google Analytics ni ninguna otra herramienta. Esto es lo único que
  se recolecta del visitante.
- **Privacy:** declarar exactamente eso (Vercel Analytics, sin cookies de terceros, sin
  formulario propio por lo que no se recolectan datos de contacto salvo que el visitante envíe
  un email voluntariamente), cómo se usa esa información, contacto para consultas de privacidad.
- **Terms:** uso aceptable del sitio, propiedad intelectual del contenido, ausencia de garantías
  sobre disponibilidad de productos vía el sitio (las transacciones reales ocurren en el
  marketplace, no en ranicgroup.com), ley aplicable (NJ, EE.UU.), contacto.

Esto lo redacta quien implemente (VS Code), siguiendo esta guía — no son placeholders: el plan
de implementación debe traer el texto completo y real, no un "TODO: agregar términos".

## 7. Diseño visual

Dirección definida con la skill frontend-design; ver detalle completo en
`docs/design-guidelines-public-site.md` (documento hermano de
`docs/design-guidelines.md`, que sigue vigente para el CRM y no se modifica).

Resumen:
- **Paleta:** `olive #556B2F`, `olive-deep #3E4F1D`, `stone #F3F4EF`, `kraft #D9CBA3`,
  `stamp #B23A2E`, `ink #1C1B17`, `ink-soft #6B6A60`. Olive/stone/ink heredados del CRM
  (continuidad de marca); `kraft` y `stamp` son nuevos, específicos de este sitio.
- **Tipografía:** Space Grotesk (display), Inter (body), JetBrains Mono (datos: términos tipo
  "NET 30", "MOQ $500", códigos de categoría) — mismos roles que el CRM.
- **Layout:** one-pager, hero asimétrico (texto + tarjeta de "Purchase Order"), sección de
  categorías sin numeración, banda CTA en `olive-deep`, footer tipo etiqueta de envío.
- **Elemento de firma:** la tarjeta de "Purchase Order" en el hero, con un sello "APROBADO"
  (`stamp`) que se asienta con una animación breve al cargar (respeta
  `prefers-reduced-motion`). Es el único momento de animación orquestada de la página.

## 8. Copy / tono

- Mensaje del hero coherente con los emails de outreach ya existentes: "recurring monthly
  orders", presentarse como comprador wholesale, nunca mencionar Amazon, base en Summit, NJ.
- Voz activa, específica, sin relleno — mismo registro que las reglas de email del CRM.
- CTA con verbo de acción claro ("Trabajá con nosotros", "Escribinos"), no genérico ("Contacto").

## 9. Fuera de alcance

- Formulario de contacto propio / captura de leads con backend.
- Blog, casos de éxito, testimonios, logos de marcas reales (no hay autorización de marcas para
  mostrar sus logos en este sitio).
- Cualquier cambio a `/admin` (Fase 1, ya en producción — no se toca).
- SEO avanzado / contenido extenso para tráfico orgánico (la audiencia es dirigida, no orgánica).
