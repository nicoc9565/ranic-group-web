# Automatización de outreach a proveedores — Design Spec

**Fecha:** 2026-08-14
**Contexto:** Nico tiene un Excel de ~2500 posibles proveedores (de una feria/lista de exhibitors),
con columnas Company Name, Description, Brands, Website, Email Address, Phone Number, Booth/Stand.
Hoy contactar 1 a 1 a mano es inviable. El objetivo es importar la lista al CRM, enviar el primer
contacto por email de forma automática pero **gradual** (para no arruinar la reputación de
`nicolas.conti@ranicgroup.com`), y trackear respuestas.

## 1. Estado actual (lo que ya existe, no se rediseña)

- `lib/types.ts` — modelo `Provider` con `status` (8 valores), `contactMethod`, `score`,
  `firstContactDate`, `lastEmailDate`, `followUpStep`, `notes`.
- `lib/followup.ts` — Follow-up Track de días [1, 4, 7, 12] desde `firstContactDate`, solo activo
  si `contactMethod === "Email"`.
- `lib/emails.ts` — genera el texto de 8 tipos de email (incluye `first_short`, que es exactamente
  el template que Nico ya usa). Placeholders `[Contact]`, `[Company]`, `[signature]`.
- `scripts/import-providers.ts` — precedente de import masivo desde CSV externo: parsea, dedupea
  contra proveedores existentes (`SKIP_SLUGS`), separa filas "Estafa" a `blacklist`, escribe en
  batches de 50.
- **Lo que NO existe:** ningún envío de email real. `generateEmail()` solo produce texto para
  copiar/pegar a mano (decisión explícita de Fase 1: "Notificaciones por email/push" quedó fuera
  de alcance, "el dashboard es el recordatorio").

## 2. Alcance de esta feature

1. **Import del Excel de 2500 filas** a `providers`, con dedup contra los ~79 existentes y contra
   `blacklist` (26 empresas), igual que hace `import-providers.ts` hoy.
2. **Motor de envío real** vía Gmail API, autenticado como `nicolas.conti@ranicgroup.com` — esto es
   la pieza nueva. Server-side (API route de Next.js), no client-side.
3. **Envío gradual y configurable**: cron job que manda N emails por día, espaciados, dentro de una
   ventana horaria — el límite diario se ajusta desde la UI del CRM, no hardcodeado, para poder ir
   subiendo el ritmo a medida que se confirma que no hay problemas de entregabilidad.
4. **Reply detection**: cuando llega respuesta a un thread enviado, el proveedor se marca para
   revisión (no se clasifica automáticamente como positiva/negativa — eso lo decide Nico a mano
   viendo el mail real).
5. Reusa el Status existente: `Por Contactar` → (envío automático) → `Contactado` →
   (respuesta detectada) → queda visible para que Nico lo pase a mano a `En Negociación` /
   `Aprobado` / `Rechazado` / etc.

## 3. Fuera de alcance (explícito)

- Envío automático de los follow-ups de día 4/7/12 — por ahora solo se automatiza el primer
  contacto. Si el piloto funciona bien, se evalúa como feature separada.
- Clasificación de intención de la respuesta (IA leyendo si es positiva/negativa) — fuera de
  alcance, Nico revisa a mano.
- Verificación SMTP real de emails (confirmar que el buzón existe) — solo validación de formato.
  Bounces se manejan por lo que reporte Gmail al enviar (ver §6).
- Los ~2500 proveedores del Excel no tienen "Booth/Stand" ni "Description"/"Brands" en el modelo
  `Provider` actual — decisión pendiente en §7.

## 4. Modelo de datos — campos nuevos en `Provider`

```ts
// lib/types.ts — agregar a Provider
gmailThreadId: string | null;   // thread de Gmail del primer contacto, para reply detection
sendAttemptedAt: number | null; // timestamp del intento de envío automático
sendError: string | null;       // si el envío falló (bounce inmediato, address inválida, etc.)
source: "expo-import" | "csv-import" | "manual"; // de dónde vino el proveedor, para auditoría
```

`Booth/Stand`, `Description`, `Brands` del Excel → van a `notes` como una entrada inicial de texto
libre al importar (igual patrón que `import-providers.ts` hace con la columna "Notas"), **si Nico
confirma en §7 que quiere guardarlos**.

## 5. Import del Excel

- Mismo patrón que `scripts/import-providers.ts`: slug de company name para dedup, batches de 50,
  `--dry-run` para contar antes de escribir.
- Filas sin email → se importan igual (quedan en `Por Contactar` pero no son candidatas de envío
  automático hasta que alguien les cargue un email a mano).
- Filas cuyo `company` (normalizado) ya existe en `providers` o `blacklist` → se saltan, se
  reportan en el log del script (no se pisan).
- `contactMethod` = `"Email"` si tiene email, si no `"Web"`.

## 6. Motor de envío (pieza nueva)

- **Auth:** OAuth2 contra la Gmail API, autorizando `nicolas.conti@ranicgroup.com` con scope de
  envío (`gmail.send`) + lectura de threads (`gmail.readonly`) para la reply detection. El refresh
  token se guarda como env var server-side (nunca en el repo, mismo patrón que
  `SEED_USER_PASSWORD`).
- **Endpoint de envío** (API route, ej. `/api/outreach/send-batch`): toma hasta N proveedores en
  `Por Contactar` con email válido y `sendAttemptedAt === null`, genera el texto con
  `generateEmail("first_short", provider)`, envía por Gmail API, y en éxito: `status → "Contactado"`,
  aplica `advanceFollowUp()` (ya existe en `lib/followup.ts`), guarda `gmailThreadId`. En error:
  guarda `sendError`, no reintenta solo — queda visible para revisión manual.
- **Scheduler:** Vercel Cron Job pegándole a ese endpoint cada X minutos durante una ventana
  horaria configurable (ej. 9am–5pm hora de Nico), cada corrida manda un lote chico (ej. 2-3), así
  se llega al límite diario espaciado en vez de todo junto.
- **Límite diario configurable** desde una pantalla nueva del CRM (ej. `/admin/outreach`), guardado
  en un doc de config en Firestore — no hardcodeado, así Nico lo sube gradualmente sin depender de
  un deploy.

## 7. Decisiones — resueltas 2026-08-14

1. **Teléfono de la firma:** `+1 (908) 656-6042`. El `+1 (201) 572-1383` que estaba hardcodeado es
   el teléfono personal de un tío de Nico — **error a corregir**, nunca debió estar ahí.
2. **Saludo sin nombre de contacto:** `"Dear [Company] Team,"`.
3. **Ritmo de arranque:** ~20/día, espaciados, ventana horaria genérica de mañana/media mañana en
   horario de EEUU (se usa **9am–12pm America/New_York**, ajustable después desde el panel).
4. **Gmail API:** Nico lo hace, pero necesita guía paso a paso completa (nunca usó Google Cloud
   Console) — la Tarea 8 del plan incluye el runbook detallado.
5. **Booth/Stand:** se descarta, no se importa.
6. **Description/Brands:** se descartan, no se importan.

## 8. Siguiente paso

Plan de implementación: `docs/superpowers/plans/2026-08-14-outreach-automation.md`.

## 9. Correcciones tras revisión de VS Code Claude (2026-08-14)

Dos gaps reales que este spec no había contemplado, incorporados al plan:

- **Acceso server-side sin sesión:** `firestore.rules` exige `request.auth != null` en toda la
  base. Los endpoints de cron (envío, reply-detection) no tienen sesión de usuario → con el SDK
  cliente de Firebase darían `permission-denied`. Se resuelve con **Firebase Admin SDK** (service
  account, ignora las rules por diseño) para todo lo que corre server-side sin usuario logueado.
- **CAN-SPAM:** el outreach automático masivo (2500 emails fríos a empresas de EEUU) requiere
  dirección postal física y mecanismo de opt-out en el email — el template `first_short` no los
  tenía porque fue diseñado para envío manual 1 a 1, no para outreach algorítmico masivo. Se agrega
  un footer de compliance solo al flujo automático (`generateOutreachEmail`), sin tocar el template
  original que Nico sigue usando a mano desde el CRM.

Pendientes de Nico para poder implementar: dirección postal física de RANIC GROUP LLC, plan de
Vercel del proyecto (Hobby/Pro), y si tiene acceso de admin de Google Workspace (para evaluar
domain-wide delegation como alternativa al refresh token de OAuth).

## 10. Resuelto — 2026-08-14

- **Excel confirmado:** `docs/Lista-de-Empresas-Exhibidoras.xlsx`, hoja "NHS 2026 Exhibitors",
  2715 filas, columnas exactas al parser (`Company Name`, `Description`, `Brands`, `Website`,
  `Email Address`, `Phone Number`, `Booth/Stand`). Es la lista de exhibitors del National Hardware
  Show — va a traer proveedores internacionales mezclados con locales, es esperado.
- **Vercel: plan Hobby.** El cron de Task 11 pasa de Vercel Cron a un workflow de GitHub Actions
  con `schedule` (gratis, mismo repo) pegándole al endpoint por HTTP con `CRON_SECRET`.
- **Workspace: Nico es admin.** Task 6/7 cambian de OAuth de usuario (refresh token que caduca a
  los 7 días en modo Testing) a **domain-wide delegation**: una service account de Google Cloud
  autorizada en `admin.google.com` para impersonar `nicolas.conti@ranicgroup.com` vía JWT. Menos
  pasos para Nico y sin vencimiento.
- **Dirección postal — resuelta.** Nico confirmó usar su domicilio: `3 Ridgedale Ave, Summit, NJ
  07901`. Ya está en el footer de `lib/outreachEmail.ts` (Task 3 del plan). Si más adelante
  prefiere no exponerlo (queda en miles de emails salientes), las alternativas siguen siendo
  válidas para un cambio futuro: PO Box de USPS o casillero de UPS Store (ambos cuentan como
  dirección válida según la guía de cumplimiento de la FTC), o la dirección del registered agent
  de la LLC si es distinta.
