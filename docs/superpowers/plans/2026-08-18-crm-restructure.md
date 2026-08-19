# Reestructuración del CRM (`/admin`) — 2026-08-18

## Contexto

El CRM se diseñó cuando había ~9 proveedores gestionados a mano. Hoy hay **2417 proveedores
importados** (917 elegibles) y desde esta mañana el outreach automático está mandando 20 emails
por día. Las nueve pantallas del nav reflejan el CRM viejo, no lo que el sistema hace ahora:

- **Expo West** es una lista de proveedores aparte que nunca entra al envío automático.
- **Emails** es un generador manual que pide elegir un proveedor de un `<select>` con 2417 opciones.
- **Follow-ups** está por inundarse (ver abajo).
- **Proveedores** no muestra en ninguna parte a quién ya contactó el programa, quién respondió,
  quién rebotó ni quién nunca contestó.
- **Blacklist** es de solo lectura: no hay forma de marcar un proveedor malo desde el CRM.

El objetivo es dejar el nav en **6 pantallas** y que Proveedores sea el registro único del estado
real de cada proveedor, alimentado automáticamente por el outreach. Finanzas y Stock no se tocan.

## Lo urgente: Follow-ups se inunda el sábado 22

`app/api/outreach/send-batch/route.ts:113` llama a `advanceFollowUp(p, today)` en cada envío, lo
que escribe `firstContactDate = hoy` y `followUpStep = 0`. Como esos proveedores tienen
`contactMethod: "Email"`, `nextFollowUpDate()` (`lib/followup.ts:22`)
devuelve `firstContactDate + 4 días` y todos entran a la pantalla de Follow-ups.

Los primeros 20 envíos salieron hoy 2026-08-18 → **el 2026-08-22 aparecen las primeras 20 tarjetas
pidiendo acción manual**, y crecen ~20 por día hasta ~900. La pantalla queda inservible y el banner
del Dashboard también. **La Tarea 4 tiene que estar en producción antes del 22.**

## Nav resultante

| Antes (9) | Después (6) |
|---|---|
| Dashboard | **Dashboard** — centro de acción (absorbe Follow-ups) |
| Proveedores | **Proveedores** — registro único, con estado de contacto automático |
| Follow-ups | ~~se elimina~~ → sección del Dashboard, con alcance acotado |
| Emails | ~~se elimina~~ → el generador se muda al detalle del proveedor |
| Outreach | **Outreach** — panel de la campaña (sin cambios de fondo) |
| Blacklist | **Blacklist** — ahora escribible |
| Expo West | ~~se elimina~~ → los prospectos migran a `providers` y entran al envío automático |
| Finanzas | **Finanzas** — sin tocar |
| Stock | **Stock** — sin tocar |

## Idea central: el estado de contacto es *derivado*, no un campo más

Nico pidió "marcar" quién fue contactado, quién no contestó nunca, quién contestó y con quién se
abrió cuenta. Un campo mutable extra se desincroniza con `status` a la primera. En vez de eso, una
función pura calcula la etapa a partir de datos que el cron **ya escribe**:

```
sin-contactar → contactado → sin-respuesta
                          ↘ respondio → cuenta
                          ↘ rebotado
                                        descartado (transversal)
```

`status` sigue siendo el campo del pipeline que Nico maneja a mano; la etapa de contacto es lo que
el sistema observó. Se muestran las dos.

---

## Tareas

### Task 1 — `lib/contactStage.ts` + campos nuevos en `Provider` (TDD)

**Archivos:** `lib/types.ts`, `lib/contactStage.ts` (nuevo), `lib/__tests__/contactStage.test.ts` (nuevo)

Agregar a `Provider`:
- `replyDetectedAt?: number | null` — timestamp de la respuesta detectada. Reemplaza el match por
  string contra `notes` que hoy hace `app/admin/(crm)/outreach/page.tsx:54`.
- `bounceType?: "hard" | "soft" | null` — clasificación del rebote.
- `companyLower?: string` — `company.toLowerCase()`, para búsqueda y orden.

Agregar `"expo-west-import"` a la unión de `source`.

`contactStage(p: Provider, today: Date): ContactStage` con **precedencia estricta** (gana el primero):

1. `blacklisted || optedOut || status ∈ {Rechazado, No Acepta Nuevos}` → `descartado`
2. `status ∈ {Aprobado, En Negociación}` → `cuenta`
3. `bounceType === "hard"` → `rebotado`
4. `replyDetectedAt != null` → `respondio`
5. `sendAttemptedAt == null && !firstContactDate` → `sin-contactar`
6. días desde `firstContactDate` > `NO_REPLY_DAYS` (14) → `sin-respuesta`
7. resto → `contactado`

Exportar también `CONTACT_STAGE_LABELS` (español) y `NO_REPLY_DAYS = 14`. 14 = la secuencia de
follow-up se agota al día 12; dos días de margen.

**TDD** (CLAUDE.md lo exige para lógica pura): un test por rama más los casos de precedencia —
blacklisteado con respuesta detectada → `descartado`; rebote duro con `firstContactDate` viejo →
`rebotado`, no `sin-respuesta`; `Aprobado` con `replyDetectedAt` → `cuenta`.

### Task 2 — `check-replies` escribe los campos nuevos

**Archivo:** `app/api/outreach/check-replies/route.ts`

- Al detectar respuesta: `patch.replyDetectedAt = now` **solo si venía en null** (idempotente, igual
  que el chequeo `alreadyNoted` que ya existe).
- Rebote duro: `patch.bounceType = "hard"`. Rebote blando: `patch.bounceType = "soft"` **sin pisar
  un `"hard"` ya escrito** (un duro no se degrada a blando).
- Las notas se siguen escribiendo igual: son el log humano.
- Corregir el comentario de cabecera del archivo: todavía afirma que *"Gmail entrega el aviso de
  rebote de mailer-daemon DENTRO del hilo original"*, premisa que el test real falsificó y que
  `listRecentBounces` ya reemplazó.

**Verificación:** correr el endpoint contra producción con el `CRON_SECRET` de `.env.local`. El
proveedor que ya tiene el DSN real registrado debe quedar con `bounceType: "hard"`, y una segunda
corrida no debe cambiar nada.

### Task 3 — Backfill de los campos nuevos

**Archivos:** `scripts/migrate-contact-fields.ts` (nuevo), `lib/providers.ts`

Script con `--dry-run` obligatorio primero, escrituras en batches de 500:
- `companyLower` para los 2417 proveedores.
- `replyDetectedAt` / `bounceType` deducidos **una única vez** de las notas existentes
  (`"Respuesta detectada — revisar Gmail."`, `"Rebote duro — la dirección no existe."`,
  `"Rebote transitorio — puede reintentarse."`). Este es el único lugar donde leer esos strings es
  correcto: es la traducción del formato viejo al nuevo.
- Fecha: usar `NoteEntry.date` como aproximación del timestamp (medianoche UTC de ese día).

En `lib/providers.ts`: `addProvider` y `updateProvider` deben mantener `companyLower` sincronizado
cuando cambia `company`.

Reportar el conteo real de documentos tocados.

### Task 4 — El outreach frío sale del track de follow-up (**antes del 2026-08-22**)

**Archivos:** `lib/followup.ts`, `lib/__tests__/followup.test.ts`

En `nextFollowUpDate`, después del guard de `followUpStopped`:

```ts
// El outreach frío no entra a la secuencia manual: son ~900 proveedores que nunca escribimos a
// mano. Si uno responde aparece en "Requieren tu atención" del Dashboard, no acá. Nico lo mete a
// la secuencia a mano con "Iniciar seguimiento" (followUpForced), que ya existe.
const isColdOutreach =
  p.source === "expo-outreach-import" || p.source === "expo-west-import";
if (isColdOutreach && !p.followUpForced) return null;
```

Tests: proveedor de outreach sin `followUpForced` → `null`; el mismo con `followUpForced: true` →
fecha normal; proveedor manual sin `source` → comportamiento actual intacto.

Esta tarea es autónoma: se puede mergear y deployar sola, antes que el resto.

### Task 5 — El Dashboard absorbe Follow-ups

**Archivos:** `app/admin/(crm)/dashboard/page.tsx`, `components/FollowUpList.tsx` (nuevo),
borrar `app/admin/(crm)/follow-ups/`

- Métricas con **`getCountFromServer`** en vez de suscribirse a los 2417 documentos: total de
  proveedores, contactados, respuestas sin revisar, cuenta abierta. Son 4 lecturas contra ~2417.
- Sección nueva **"Requieren tu atención"**, en este orden:
  1. Respuestas sin triar — `replyDetectedAt != null && status == "Contactado"`.
  2. Rebotes duros de los últimos 7 días — `bounceType == "hard"`.
  3. Follow-ups vencidos o de hoy — la lista ya acotada por la Task 4.
  Cada fila linkea a `/admin/proveedores?id=…` (el detalle ya soporta ese parámetro,
  `app/admin/(crm)/proveedores/page.tsx:40`).
- Las tarjetas de follow-up (con `FollowUpTrack`, "Marcar como enviado" y detener) se extraen tal
  cual a `components/FollowUpList.tsx` — es UI que ya funciona, no se rediseña.
- El banner ámbar actual se elimina: queda redundante con la sección nueva.
- Mantener Tareas.

### Task 6 — Proveedores: estado de contacto, contadores y tope de render

**Archivos:** `app/admin/(crm)/proveedores/page.tsx`, `components/ProviderTable.tsx`,
`components/ContactStageBadge.tsx` (nuevo)

- Fila de contadores arriba, uno por etapa (Total, Sin contactar, Contactado, Sin respuesta,
  Respondió, Cuenta o lista, Rebotado, Descartado). Se calculan en el cliente sobre la suscripción
  que ya existe.
- Control segmentado que filtra por etapa, además de los filtros actuales de estado y categoría.
- Columna nueva **"Contacto"** en `ProviderTable` con el badge de etapa, junto a la de "Estado".
- **Tope de render: 100 filas + "Cargar más"** (slice en el cliente). Hoy la tabla renderiza las
  2417 filas de una; ese es el motivo real de que la pantalla vaya lenta.
- La columna "Próximo" pasa a mostrar `—` para el outreach frío (consecuencia de la Task 4);
  está bien, es la señal correcta.

### Task 7 — Blacklist escribible, y marcable desde el proveedor

**Archivos:** `lib/blacklist.ts`, `app/admin/(crm)/blacklist/page.tsx`, `components/ProviderDetail.tsx`

- `lib/blacklist.ts`: `addBlacklistEntry(name)` y `removeBlacklistEntry(id)`.
- Página Blacklist: formulario para agregar y botón para quitar en cada entrada. Se mantiene el
  aviso rojo.
- `ProviderDetail`: acción **"Marcar como estafa / no contactar"** que en una sola escritura deja
  `blacklisted: true, optedOut: true, outreachEligible: false, followUpStopped: true` y crea la
  entrada en `blacklist` con el nombre de la empresa. Y la acción inversa para deshacer.
  **Reutiliza los filtros que el sender ya tiene** (`optedOut == false`, `outreachEligible == true`
  en `app/api/outreach/send-batch/route.ts:65`) — así el proveedor
  blacklisteado sale del envío automático sin tocar la query ni crear índices nuevos.
- Endurecer `isBlacklisted`: hoy matchea por inclusión en ambos sentidos, así que una entrada corta
  como `"Ace"` marcaría media lista. Exigir coincidencia exacta para nombres de menos de 4
  caracteres. Con la blacklist volviéndose escribible, esto pasa de teórico a probable.

### Task 8 — Expo West se borra (los prospectos se descartan)

**Archivos:** borrar `app/admin/(crm)/expo-west/`, `lib/expo.ts`, `scripts/import-expo.ts`

**Corrección del 2026-08-18.** Esta tarea decía migrar los prospectos de `expoProspects` a
`providers` y meterlos al envío automático. La auditoría de la colección lo desarmó: **los 112
documentos tienen `email` vacío y `website` vacío.** Cero direcciones en toda la colección — solo
`company`, `brands`, `category`, `city` y `state`. Los 3 marcados `mailSent: true` ya existen en
`providers` por nombre.

Migrarlos habría agregado 112 filas incontactables a una lista de 2502, con `contactMethod: "Web"`
y sin ninguna posibilidad de entrar al envío automático, que necesita una dirección. El trabajo de
mapear categorías, dedupear y escribir el script no compraba nada.

Nico decidió descartarlos. La tarea queda en:

1. Borrar `app/admin/(crm)/expo-west/`, `lib/expo.ts` y `scripts/import-expo.ts` (y su entrada en
   `package.json`).
2. **NO** tocar el filtro de `source` en `send-batch`: queda en `== "expo-outreach-import"`.
3. **NO** escribir `scripts/migrate-expo-to-providers.ts`.
4. **La colección `expoProspects` queda INTACTA en Firestore.** No se borran datos. El tipo
   `ExpoProspect` se conserva en `lib/types.ts` como única documentación de su forma.
5. `"expo-west-import"` se deja en la unión de `source` y en el guard de `lib/followup.ts`, con un
   comentario explicando que está sin uso. Sacarlo obliga a volver a tocar `followup.ts` para nada.

Los Excel originales siguen en la máquina de Nico. Si algún día consigue los contactos, se importan
de cero por el pipeline normal, que para entonces ya tiene el heurístico de
`lib/outreachEligibility.ts` **más el chequeo de MX** — mejor de lo que habría hecho esta migración.

La extracción de la heurística de elegibilidad a `lib/outreachEligibility.ts` (punto 1 de la
versión original) **sí se hizo**, junto con el pre-flight de MX, porque el pipeline de import la
necesita igual.

### Task 9 — El generador de emails se muda al detalle del proveedor

**Archivos:** `components/ProviderEmailComposer.tsx` (nuevo), `components/ProviderDetail.tsx`,
borrar `app/admin/(crm)/emails/`

El generador **no se elimina**: el envío automático sólo manda el primer contacto. Los templates
`catalog_upcs`, `reply_approval` y `clarification` son exactamente lo que hace falta cuando un
proveedor responde, que es el punto de toda la campaña. Lo que sobra es la pantalla suelta con su
`<select>` de 2417 proveedores.

- `ProviderEmailComposer` recibe el `Provider` por props (adiós al selector): selector de tipo de
  email, textarea en inglés, traducción de referencia plegable, "Copiar email", "Marcar como
  enviado". Es `EmailsPageContent` sin el primer `<select>` y sin `useSearchParams`.
- Se monta como sección plegable dentro de `ProviderDetail`.
- `lib/emails.ts` y `lib/emailsEs.ts` **no se tocan** — las reglas de dominio de CLAUDE.md quedan
  intactas.
- El botón "Redactar email" de las tarjetas de follow-up ahora abre el detalle del proveedor.

### Task 10 — Nav a 6 items

**Archivo:** `components/Nav.tsx`

- `NAV` queda en Dashboard, Proveedores, Outreach, Blacklist, Finanzas, Stock.
- Bottom nav de mobile: `grid-cols-9` → `grid-cols-6` (hoy son 9 items apretados en el ancho de un
  teléfono).
- Borrar los iconos `followups`, `emails` y `expo`, que quedan sin uso.

---

## Orden de ejecución

`1 → 2 → 3 → 4` primero y en un PR aparte si hace falta: la **Task 4 tiene que estar deployada
antes del 2026-08-22**. Después `5 → 6 → 7 → 8 → 9 → 10`.

Un commit por tarea, mensajes en el estilo del repo (`feat:`, `fix:`, `chore:`).

## Verificación

Además de la verificación por tarea:

1. `npm test` verde (los tests nuevos de `contactStage`, `followup` y `outreachEligibility`).
2. `npm run build` sin errores de tipo.
3. Con el preview corriendo: entrar a Proveedores y comprobar que los contadores por etapa suman el
   total, que el filtro por etapa cambia la tabla y que "Cargar más" trae las siguientes 100.
4. Dashboard: que "Requieren tu atención" muestre los rebotes duros reales que ya hay en la base y
   que las métricas coincidan con las de Outreach.
5. Blacklistear un proveedor de prueba y correr `POST /api/outreach/send-batch?dryRun=1` en
   producción: no tiene que aparecer entre los candidatos.
6. Después de la Task 8, `?dryRun=1` tiene que seguir devolviendo candidatos y el conteo de
   `providers` NO tiene que cambiar: los prospectos de Expo West se descartaron, no se migran.
7. Verificar en el navegador, no pedirle a Nico que pruebe a mano (CLAUDE.md).

---

## Decisiones ya tomadas (aprobadas por Nico el 2026-08-18)

1. **Follow-ups** se fusiona en el Dashboard como sección "Requieren tu atención", acotado a
   proveedores manuales y a los que respondieron.
2. **Emails**: el generador se muda al detalle del proveedor, no se borra.
3. **Blacklist** queda como pantalla propia, ahora escribible.
4. **"Sin respuesta" a los 14 días** desde el primer contacto (`NO_REPLY_DAYS`).

## Fuera de alcance

- **Finanzas y Stock**: no se tocan en esta reestructuración.
- **Paginación server-side de Proveedores.** Con Emails y Follow-ups borrados y el Dashboard y
  Outreach usando `getCountFromServer`, queda **una sola** pantalla que baja los 2417 documentos
  (hoy son cinco). Son ~2400 lecturas de Firestore por visita a Proveedores; con el tier gratuito
  de 50.000/día alcanza. Si en el futuro se importa otra lista, hay que pasar a queries paginadas
  con cursor sobre `companyLower`, que la Task 3 ya deja escrito.
- **Follow-up automático por el cron.** El sistema manda sólo el primer contacto; automatizar los
  días 4/7/12 es más volumen y más riesgo de reputación — decisión aparte.
