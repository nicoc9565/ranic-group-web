# RANIC GROUP — Sitio público (Fase 2, v2) — Revisión

**Fecha:** 2026-06-27
**Estado:** Aprobado por el usuario
**Repo:** `ranic-web`
**Dominio:** ranicgroup.com
**Supersede a:** `docs/superpowers/specs/2026-06-26-ranic-public-site-design.md` (Fase 2 v1)

---

## 0. Por qué esta revisión

La Fase 2 v1 se implementó completa (PR #2, 13 tareas, preview verde en Vercel). Al revisarlo,
el usuario encontró dos problemas:

1. **Idioma:** el sitio se escribió en español. RANIC GROUP LLC es una empresa de EE.UU.
   (Summit, NJ) y la audiencia son proveedores/marcas estadounidenses — el sitio público debe
   estar **100% en inglés**. (El CRM en `/admin` sigue en español — eso no cambia, es una
   herramienta interna para Nico/César.)
2. **Pobre/incompleto:** comparado con el sitio estático viejo (descartado en la Fase 1, pero
   recuperado del historial de git para esta revisión), la v1 tenía muy poco contenido — un
   one-pager de 3 secciones contra un sitio anterior con 7+ secciones, FAQ, y formulario.

Esta v2 no descarta el trabajo de la v1: mantiene su identidad visual (paleta olive/kraft/stamp,
tipografías, la tarjeta "Purchase Order" + sello "APROBADO" como elemento de firma) y expande el
contenido y la estructura. El PR #2 no se mergea — se reemplaza por el trabajo de esta v2 sobre
el mismo branch o uno nuevo.

## 1. Posicionamiento (cambio clave respecto a v1)

A diferencia de los emails de outreach del CRM (que **nunca mencionan Amazon**, por estrategia de
primer contacto), el sitio público **sí menciona abiertamente** que RANIC vende en Amazon y
marketplaces. Razón: la audiencia de este sitio es gente que ya recibió un email y está buscando
verificar quién es RANIC — no hay nada que ocultar, y ocultarlo resultaría menos profesional, no
más. Esta distinción es intencional y no se debe "corregir" para que coincida con la regla de los
emails: son audiencias y momentos distintos.

Mensaje central: *"Somos un comprador wholesale profesional que vende en Amazon y marketplaces,
respetamos MAP y reglas de marca, y buscamos marcas con las que asociarnos a largo plazo."*

## 2. Audiencia

Marcas/proveedores evaluando si vender wholesale a RANIC — tanto los que ya recibieron un email
de outreach (audiencia primaria, igual que en v1) como los que llegan por una búsqueda orgánica de
"Ranic Group LLC" en Google (audiencia secundaria nueva, habilitada por el trabajo de SEO de esta
revisión — ver §6).

## 3. Estructura del sitio

`/` pasa de 3 a **7 secciones**, en este orden:

1. **Hero** — headline + subhead (mencionando Amazon/marketplaces abiertamente) + CTA primario
   (mailto, acción rápida) + la tarjeta "Purchase Order" con el sello (sin cambios respecto a v1).
2. **Why Us** — 4 razones para vendernos wholesale: disciplina de MAP, sourcing transparente y
   documentado, foco en sell-through a largo plazo (no arbitraje de corto plazo), operación en
   EE.UU. desde Summit, NJ.
3. **How We Work** — proceso real en 4 pasos: (1) catalog & channel audit, (2) SKU selection &
   pricing guardrails, (3) procurement & compliance check, (4) marketplace execution & reporting.
   Es una secuencia real → **sí se numera** (a diferencia de "Categories", que no es secuencial).
4. **Categories** — sin cambios respecto a v1: 4 categorías de presentación (Beauty & Personal
   Care, Home & Pet, Entertainment & Toys, General Merchandise), sin numerar.
5. **MAP & Brand Protection** — sección dedicada, tono "manifesto" corto y firme: RANIC respeta
   MAP, no compite a precio destructivo, protege la calidad del listing y la reputación de marca.
   Es la sección que más debe transmitir "somos serios, seguimos las reglas".
6. **FAQ** — 4 preguntas típicas de una marca evaluando vendernos: ¿compran wholesale o trabajan a
   consignación?, ¿cómo protegen el MAP?, ¿qué categorías priorizan?, ¿son revendedor autorizado?
7. **Contact** — formulario (ver §5) como mecanismo principal, más el mismo CTA mailto del hero
   como acción alternativa rápida.
8. **Footer** — igual que v1 (línea tipo etiqueta de envío), en inglés.

`/privacy` y `/terms` se mantienen como páginas separadas (no cambian de estructura), pero su
copy se reescribe en inglés y `/privacy` debe actualizarse para reflejar el formulario de
contacto nuevo (ver §5 y §7).

## 4. Copy / tono

Mismas reglas que v1 pero **todo en inglés**: voz activa, específica, sin relleno. Mismo registro
profesional que ya define `CLAUDE.md` para los emails (sin ser idéntico — el sitio puede mencionar
Amazon, los emails no). CTAs con verbo de acción claro, no genéricos.

## 5. Formulario de contacto

Reemplaza el mailto-only de v1 como mecanismo principal de conversión (el mailto se mantiene como
botón secundario rápido en el hero).

- **Campos:** Company / Brand Name (texto, requerido), Contact Name (texto, requerido), Email
  (email, requerido), Category (select: las mismas 4 categorías de §3.4 + "Other"), Message
  (textarea, requerido).
- **Entrega:** sin backend propio de almacenamiento (sin Firestore nuevo, sin tocar el CRM). El
  formulario pega a una API route propia de Next.js (`/api/contact`), que valida los campos
  server-side y envía un email a `nicolas.conti@ranicgroup.com` usando **Resend**
  (`resend.com`, plan gratis, hasta 3000 emails/mes — más que suficiente para este volumen).
- **Env var nueva:** `RESEND_API_KEY` — la genera Nico en resend.com y la carga en Vercel, mismo
  procedimiento que con las claves de Firebase en la Fase 1.
- **Sin almacenamiento de los envíos** más allá del email que llega a la casilla — no hay
  colección nueva en Firestore ni vista nueva en `/admin` para esto (fuera de alcance, ver §8).
- **Confirmación al usuario:** mensaje en pantalla tipo "Thanks — we'll get back to you soon"
  tras un envío exitoso; mensaje de error claro si falla el envío.

## 6. SEO (cambio respecto a v1 — ya no está fuera de alcance)

El sitio viejo posicionaba bien en Google para "Ranic Group LLC" — se busca mantener eso. Se
agrega SEO técnico (no contenido de blog/marketing extenso, que sigue fuera de alcance):

- **Metadata por página** (`title`, `description`) específica para `/`, `/privacy`, `/terms` —
  no solo el `metadata` genérico compartido del layout raíz.
- **Open Graph + Twitter card** tags en `/` (título, descripción, imagen — se puede reusar el
  logo existente si hay uno disponible, o un placeholder simple si no).
- **`app/sitemap.ts`** generando `sitemap.xml` con las 3 rutas públicas.
- **`app/robots.ts`** generando `robots.txt` permitiendo todo excepto `/admin`.
- **Canonical URL** apuntando a `https://www.ranicgroup.com/` en cada página pública.
- **JSON-LD `Organization`** en el layout o en la home: nombre legal, dirección (Summit, NJ),
  email de contacto, `sameAs` si hay redes (no hay por ahora, se omite).

## 7. Contenido legal (`/privacy`, `/terms`) — ajustes respecto a v1

Mismo enfoque que v1 (contenido real, escrito de cero, no recuperado del sitio viejo) pero:

- **Todo en inglés.**
- `/privacy` debe actualizar la sección de "información que recolectamos" para reflejar que
  ahora SÍ hay un formulario de contacto propio: declarar qué datos pide (nombre de
  empresa/contacto, email, categoría, mensaje), que se envían por email vía Resend (un proveedor
  de terceros que procesa el envío, no que almacena ni vende los datos), y que no se guardan en
  ninguna base de datos del sitio.
- El resto de las secciones de v1 (analítica vía Vercel Analytics, sin cookies de terceros,
  enlaces a terceros, cambios a la política, contacto) se mantienen conceptualmente, solo
  traducidas y ajustadas.

## 8. Visual (extiende, no reemplaza, `docs/design-guidelines-public-site.md`)

Se mantiene sin cambios: paleta (`olive`, `olive-deep`, `stone`, `kraft`, `stamp`, `ink`,
`ink-soft`), tipografías (Space Grotesk / Inter / JetBrains Mono), y el elemento de firma (tarjeta
"Purchase Order" + sello "APROBADO" en el hero, con su animación de carga).

Para que las secciones nuevas no se sientan genéricas, cada una tiene su propio tratamiento dentro
del mismo sistema (no una tarjeta gris repetida):

- **Why Us:** tarjetas con un glifo/inicial simple (no numeradas — no es una secuencia).
- **How We Work:** lista de pasos numerada de verdad (1→2→3→4, con conectores visuales tipo
  tracking — coherente con el lenguaje del CRM, sin copiar su componente).
- **MAP & Brand Protection:** banda destacada en `olive-deep` o `kraft`, tipografía display
  grande, tono de declaración/manifesto — el contraste de esta banda es lo que debe transmitir
  "seriedad" con más fuerza que cualquier otra sección.
- **FAQ:** acordeón simple, tratamiento "documento/contrato" (líneas finas, mono para las
  preguntas) — coherente con el mundo de la purchase order.
- **Contact:** el formulario dentro de una tarjeta con el mismo lenguaje visual (fondo `kraft`
  suave o borde fino, inputs simples, sin look de SaaS genérico).

`docs/design-guidelines-public-site.md` se actualiza (no se reemplaza) agregando estas
indicaciones de tratamiento por sección nueva.

## 9. Fuera de alcance (sin cambios salvo lo indicado)

- Blog, casos de éxito, testimonios, logos de marcas reales.
- Cualquier cambio a `/admin` (Fase 1) — el formulario de contacto NO agrega una vista nueva al
  CRM ni una colección de Firestore.
- Productos a la venta en el sitio (el sitio no es un catálogo ni una tienda).
- Almacenamiento de los envíos del formulario más allá del email entregado vía Resend.
- ~~SEO avanzado~~ — ya no aplica, ver §6 (SEO técnico SÍ está en alcance; contenido de blog para
  tráfico orgánico sigue fuera).
- ~~Sin formulario de contacto~~ — ya no aplica, ver §5.

## 10. Acciones que dependen de Nico

- Crear cuenta en **resend.com**, generar una API key, y cargarla en Vercel como
  `RESEND_API_KEY` (igual que con las claves de Firebase).
- Confirmar si existe un archivo de logo disponible para usar en Open Graph/favicon, o si se usa
  un placeholder simple generado del nombre de la empresa.
