# Automatización de outreach a proveedores — Implementation Plan

> **Para quien ejecuta este plan (Claude en VS Code):** seguí las tareas en orden, una por una,
> con un commit al final de cada una. Task 6 (archivo JSON de la service account de Gmail) y
> Task 8 (service account de Firebase) tienen pasos bloqueantes que dependen de Nico — pausá ahí
> y esperá antes de seguir. Tasks 3, 5 y 11 ya están resueltas.

**Goal:** Importar los ~2500 proveedores del Excel de Nico al CRM, y enviar automáticamente el
primer contacto por email en tandas graduales (protegiendo la reputación de
`nicolas.conti@ranicgroup.com`), registrando todo en el CRM existente y detectando respuestas.

**Architecture:** Reusa el modelo `Provider` y el Follow-up Track ya existentes. Agrega: (1) un
template CAN-SPAM-compliant, (2) un script de import del Excel, (3) un cliente Gmail API
server-side autenticado por OAuth2, (4) **Firebase Admin SDK** para que los endpoints de cron
puedan leer/escribir Firestore sin sesión de usuario (las rules exigen `request.auth != null`; el
SDK cliente no sirve desde un cron sin login), (5) un endpoint de envío en tandas que Vercel Cron
(o un cron externo, ver Task 11) dispara periódicamente dentro de una ventana horaria, (6) un
endpoint de reply-detection, (7) un panel de control en `/admin/outreach`.

**Tech Stack:** Next.js App Router + TypeScript + Firestore (ya en uso). `googleapis` (nuevo) para
Gmail API. `firebase-admin` (nuevo) para el acceso server-side sin sesión. `xlsx` (ya instalado)
para leer el Excel.

**Spec:** `docs/superpowers/specs/2026-08-14-outreach-automation-design.md`

## Global Constraints

- Firma de emails: teléfono correcto es **+1 (908) 656-6042** (NO el `+1 (201) 572-1383` viejo, que
  es el teléfono personal de un tío de Nico y estaba mal puesto por error).
- Saludo sin nombre de contacto: `"Dear [Company] Team,"`.
- Nunca mencionar Amazon en el cuerpo del email (ya forzado por los tests existentes de
  `lib/emails.ts` — no tocar esa regla).
- **CAN-SPAM:** todo email de outreach automático (no los que Nico manda a mano desde el CRM) debe
  incluir dirección postal física y una forma de opt-out. Ver Task 3.
- Envío gradual: arrancar en ~20/día, ventana horaria **9am–12pm America/New_York**, ajustable
  desde `/admin/outreach` sin redeploy.
- **Todo endpoint que corre por cron usa `firebase-admin`, nunca el SDK cliente de Firebase** — el
  SDK cliente requiere una sesión de usuario autenticado que un cron no tiene, y con las
  `firestore.rules` actuales (`request.auth != null` en todo) cualquier llamada del cron con el
  SDK cliente devuelve `permission-denied`.
- **Todo campo nuevo agregado a `Provider` en este plan va opcional (`?:`), nunca requerido.** El
  tipo se arma completo en al menos 3 lugares del repo (form de proveedores, `scripts/seed.ts`,
  `scripts/import-providers.ts`) y un campo requerido rompe el build en los tres — confirmado en
  la Task 4.
- Booth/Stand, Description y Brands del Excel **se descartan**, no se importan.
- Secretos (Gmail refresh token, client secret, service account de Firebase) van en env vars
  server-side, nunca en el repo ni en `NEXT_PUBLIC_*`.
- UI en español, contenido de emails en inglés (regla existente del proyecto).

---

### Task 1: Corregir el teléfono de la firma

**Files:**
- Modify: `lib/emails.ts:8`
- Modify: `CLAUDE.md:71` (regla de dominio documentada)
- Modify: `lib/__tests__/emails.test.ts:51`

**Interfaces:**
- Produces: `SIGNATURE` en `lib/emails.ts` con el teléfono correcto — todas las tareas siguientes
  que generen emails dependen de este valor.

- [ ] **Step 1: Actualizar el test para el teléfono correcto**

```ts
// lib/__tests__/emails.test.ts:51
expect(generateEmail(t, p)).toContain("+1 (908) 656-6042");
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- emails`
Expected: FAIL — el test busca `"+1 (908) 656-6042"` pero `SIGNATURE` todavía tiene el número viejo.

- [ ] **Step 3: Corregir `SIGNATURE`**

```ts
// lib/emails.ts:4-8
const SIGNATURE = `Nicolas Conti
Managing Member | RANIC GROUP LLC
nicolas.conti@ranicgroup.com
www.ranicgroup.com
+1 (908) 656-6042`;
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test -- emails`
Expected: PASS

- [ ] **Step 5: Corregir la firma documentada en `CLAUDE.md`**

Reemplazar `+1 (201) 572-1383` por `+1 (908) 656-6042` en el bloque de firma de §"Reglas de
dominio" de `CLAUDE.md`.

- [ ] **Step 6: Commit**

```bash
git add lib/emails.ts lib/__tests__/emails.test.ts CLAUDE.md
git commit -m "fix: corregir teléfono de la firma de emails (era el de un familiar de Nico)"
```

---

### Task 2: Saludo sin nombre de contacto

**Files:**
- Modify: `lib/emails.ts`
- Modify: `lib/__tests__/emails.test.ts`

**Interfaces:**
- Consumes: `Provider.contact`, `Provider.company` (ya existen en `lib/types.ts`).
- Produces: `generateEmail(type, p)` ahora resuelve el saludo con fallback — usado por Task 10
  (endpoint de envío).

- [ ] **Step 1: Escribir el test que falla**

```ts
// lib/__tests__/emails.test.ts — agregar al final del describe existente
test("sin contact, saluda 'Dear [Company] Team,'", () => {
  const noContact = { company: "Acme Distributors", contact: "" } as Provider;
  expect(generateEmail("first_short", noContact).startsWith("Dear Acme Distributors Team,")).toBe(
    true,
  );
});
test("con contact, sigue saludando por nombre", () => {
  expect(generateEmail("first_short", p).startsWith("Dear Ces,")).toBe(true);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- emails`
Expected: FAIL — hoy `generateEmail` con `contact: ""` produce `"Dear ,"`.

- [ ] **Step 3: Implementar el fallback**

```ts
// lib/emails.ts — reemplazar la función generateEmail existente
export function generateEmail(type: EmailType, p: Provider): string {
  const greetingName = p.contact.trim() || `${p.company} Team`;
  return TEMPLATES[type]
    .replaceAll("[Contact]", greetingName)
    .replaceAll("[Company]", p.company)
    .replaceAll("[signature]", SIGNATURE)
    .trim();
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test -- emails`
Expected: PASS (todos, incluidos los preexistentes — `[Contact]` sigue sin aparecer sin reemplazar).

- [ ] **Step 5: Commit**

```bash
git add lib/emails.ts lib/__tests__/emails.test.ts
git commit -m "feat: saludo 'Dear [Company] Team,' cuando no hay nombre de contacto"
```

---

### Task 3: Compliance CAN-SPAM en el template de outreach automático

**Ya no bloquea.** Dirección postal confirmada: `3 Ridgedale Ave, Summit, NJ 07901`.

**Por qué:** CAN-SPAM (ley de EEUU sobre email comercial) exige que todo email comercial no
solicitado incluya una dirección postal física válida y un mecanismo claro de opt-out. Esta
tarea solo aplica al envío **automático** (el que dispara el cron, Task 10) — los emails que Nico
sigue mandando a mano desde el CRM con criterio propio no cambian.

**Files:**
- Create: `lib/outreachEmail.ts`
- Create: `lib/__tests__/outreachEmail.test.ts`
- Modify: `lib/types.ts` (campo `optedOut` en `Provider`)

**Interfaces:**
- Consumes: `generateEmail` (Task 2), `Provider`.
- Produces: `generateOutreachEmail(p: Provider): string` — el texto exacto que manda Task 10 (NO
  usa `generateEmail("first_short", p)` directo, le agrega el footer de compliance encima).

- [ ] **Step 1: Agregar `optedOut` a `Provider` — opcional, no requerido**

Igual que los campos de la Task 4, `Provider` se arma completo en al menos 3 lugares
(`app/admin/(crm)/proveedores/page.tsx`, `scripts/seed.ts`, `scripts/import-providers.ts`) — un
campo requerido nuevo rompe el build en los tres. Usar `?:`.

```ts
// lib/types.ts — agregar dentro del type Provider
/** true = el proveedor pidió no recibir más emails. Se excluye de cualquier envío automático. */
optedOut?: boolean;
```

- [ ] **Step 2: Escribir el test que falla**

```ts
// lib/__tests__/outreachEmail.test.ts
import { describe, expect, test } from "vitest";
import { generateOutreachEmail } from "../outreachEmail";
import type { Provider } from "../types";

const p = { company: "Acme Distributors", contact: "" } as Provider;

describe("generateOutreachEmail", () => {
  test("incluye la dirección postal física", () => {
    expect(generateOutreachEmail(p)).toContain("RANIC GROUP LLC"); // + dirección real, ver Step 3
  });
  test("incluye instrucción de opt-out", () => {
    expect(generateOutreachEmail(p).toLowerCase()).toContain(
      "let us know and we'll remove you",
    );
  });
  test("sigue teniendo el cuerpo del first_short original", () => {
    expect(generateOutreachEmail(p)).toContain("recurring monthly orders");
  });
});
```

- [ ] **Step 3: Implementar `generateOutreachEmail`**

```ts
// lib/outreachEmail.ts
// Envuelve generateEmail("first_short", p) agregando lo que exige CAN-SPAM para outreach
// automático masivo: dirección postal física + opt-out. Solo lo usa el endpoint de envío
// automático (Task 10) — los emails manuales del CRM no pasan por acá.
import { generateEmail } from "./emails";
import type { Provider } from "./types";

const COMPLIANCE_FOOTER = `

RANIC GROUP LLC
3 Ridgedale Ave, Summit, NJ 07901

If you'd prefer not to receive future emails from us, just reply and let us know and we'll remove you from our list.`;

export function generateOutreachEmail(p: Provider): string {
  return generateEmail("first_short", p) + COMPLIANCE_FOOTER;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test -- outreachEmail`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/outreachEmail.ts lib/__tests__/outreachEmail.test.ts lib/types.ts
git commit -m "feat: compliance CAN-SPAM (dirección postal + opt-out) en outreach automático"
```

---

### Task 4: Extender el modelo `Provider` y agregar `OutreachConfig`

**Files:**
- Modify: `lib/types.ts`

**Interfaces:**
- Produces: campos nuevos en `Provider` (`gmailThreadId`, `sendAttemptedAt`, `sendError`,
  `source`) y el tipo `OutreachConfig` — usados por Tasks 5, 9, 10, 11, 12, 13.

- [ ] **Step 1: Agregar los campos nuevos a `Provider`**

```ts
// lib/types.ts — agregar dentro del type Provider, después de followUpForced
/** Thread de Gmail del primer contacto automático. null si no se envió por acá. */
gmailThreadId: string | null;
/** Timestamp del último intento de envío automático (éxito o error). */
sendAttemptedAt: number | null;
/** Motivo de un envío automático fallido (bounce, dirección inválida, etc.). null si no falló. */
sendError: string | null;
/** Origen del proveedor, para auditoría. "manual" para todo lo cargado a mano hasta ahora. */
source: "expo-outreach-import" | "csv-import" | "manual";
```

- [ ] **Step 2: Agregar el tipo `OutreachConfig`**

```ts
// lib/types.ts — agregar al final del archivo
/** Configuración del envío automático de outreach, un solo doc en Firestore (id fijo "config"). */
export type OutreachConfig = {
  /** Máximo de emails automáticos por día. Ajustable desde /admin/outreach sin redeploy. */
  dailyLimit: number;
  /** true = el cron manda emails; false = pausado. */
  enabled: boolean;
  /** Cuántos emails ya se mandaron automáticamente hoy (se resetea a las 00:00 America/New_York). */
  sentToday: number;
  /** yyyy-mm-dd (America/New_York) del último reset de sentToday. */
  lastResetDate: string;
};
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run build`
Expected: build verde.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts
git commit -m "feat: campos de outreach automático en Provider + tipo OutreachConfig"
```

---

### Task 5: Script de import del Excel de 2500 proveedores

**Ya no bloquea.** Archivo confirmado: `docs/Lista-de-Empresas-Exhibidoras.xlsx` (hoja "NHS 2026
Exhibitors", 2715 filas). Columnas verificadas exactas: `Company Name`, `Description`, `Brands`,
`Website`, `Email Address`, `Phone Number`, `Booth/Stand` — el parser de abajo ya las usa tal cual.

**Filtro de elegibilidad (agregado 2026-08-17, tras el dry-run).** El dry-run dio 2417 empresas
únicas, 2034 con email. Pero es el National Hardware Show: ~28% de los teléfonos tienen prefijo
internacional no-US y hay 189 emails en webmails asiáticos — buena parte de la lista son
fabricantes OEM, no distribuidores mayoristas de EEUU. El template `first_short` no les aplica
(no tienen UPCs ni lista mayorista; venden por contenedor con MOQ), y mandarles en frío es
exactamente el perfil que genera bounces y marcas de spam — justo lo que el diseño gradual intenta
evitar. Se importan igual los 2417 (el import no manda nada), pero se marca cuáles son candidatos
al envío automático:

- **No usar `contactMethod: "Web"` como marca de exclusión.** `contactMethod` es un dato real del
  proveedor y además es la condición que activa el Follow-up Track en `lib/followup.ts`; ponerle
  "Web" a un fabricante que sí tiene email mete un dato falso en el CRM.
- Campo dedicado `outreachEligible?: boolean` en `Provider` (opcional, ver Global Constraint de
  campos requeridos). Lo calcula el importador; la query de Task 10 filtra por él.
- **Heurística — `false` si se cumple cualquiera de estas:** teléfono con prefijo internacional
  distinto de `+1`; TLD del sitio o del dominio del email en `.cn .tw .in .hk .kr .vn .pk .tr .ru`;
  dominio de email en `163.com 126.com qq.com foxmail.com sina.com aliyun.com naver.com`; o sin
  email válido. En cualquier otro caso, `true`. Las listas van como constantes nombradas arriba del
  archivo, para poder ajustarlas sin tocar la lógica.
- **Quinto criterio (agregado 2026-08-17, tras el primer dry-run).** Mirar solo el `+` deja pasar
  fabricantes asiáticos que escriben el código de país sin él (`0086-563-...`, `86-579-82210960`,
  `13901574565`, `886-4-7569959`). Se agrega: `false` si el teléfono, normalizado a dígitos, **no**
  cumple formato NANP — 10 dígitos, u 11 empezando en `1`, con código de área y central en `[2-9]`.
  **Sin teléfono no penaliza** (el dato faltante no contradice nada; esos siguen elegibles si pasan
  el resto). Sobre el primer dry-run esto mueve elegibles de 1143 a ~900.
- **Normalización del teléfono antes de evaluar NANP (agregado 2026-08-17, tras revisar el CSV).**
  La revisión de los 240 excluidos por NANP dio ~12 falsos positivos, todos por dos agujeros del
  normalizador, no por el criterio: (a) números **vanity** con letras del teclado
  (`1-800-456-ESCO`, `(855) PAINT-09`, `814-452-FOAM`, `(833) TURF-AID`); (b) **extensiones y
  varios números en el mismo campo** (`877-311-2287 X101`, `888-659-3512 x 178`,
  `877 864-2201 or 310 952-9000`, `360-703-0159   866-745-7490`). Antes de evaluar NANP hay que
  mapear letras a dígitos del teclado y partir el campo en fragmentos (`/`, `or`, `ext`, `x`,
  doble espacio), aceptando si **alguno** de los fragmentos es NANP válido.
- **Casos que NO se rescatan:** LLCs estadounidenses con teléfono y operación en China
  (Bakerstone International, CARSON TOP, International Product Services, Neocraft Direct,
  Leisure Import). El template `first_short` tampoco les aplica.
- **Antes del import real:** dry-run con desglose (total / elegibles / no elegibles, y cuántos
  cayeron por cada criterio) + volcado a CSV en `docs/` de los excluidos (company, email, teléfono,
  website, criterio) para que Nico revise si la heurística se está comiendo distribuidores
  legítimos de EEUU.

**Files:**
- Create: `scripts/import-outreach-list.ts`
- Modify: `package.json` (script `import-outreach-list`)

**Interfaces:**
- Consumes: `Provider`/`Status`/`ContactMethod` de `lib/types.ts`.
- Produces: docs nuevos en la colección `providers` con `source: "expo-outreach-import"`.

- [ ] **Step 1: Escribir el script**

```ts
// scripts/import-outreach-list.ts
/**
 * Import masivo del Excel de ~2500 proveedores de outreach (feria/exhibitors) a `providers`.
 * Descarta Booth/Stand, Description y Brands (spec §7). Dedupea contra proveedores existentes y
 * blacklist por nombre normalizado, mismo patrón que scripts/import-providers.ts.
 *
 * Uso:
 *   npm run import-outreach-list -- --file "C:/ruta/al/archivo.xlsx" --dry-run
 *   npm run import-outreach-list -- --file "C:/ruta/al/archivo.xlsx"
 */
import "./env";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { signInWithEmailAndPassword } from "firebase/auth";
import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import type { ContactMethod, Provider, Status } from "../lib/types";

function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ParsedProvider = Omit<Provider, "id" | "createdAt" | "updatedAt">;

function parseRows(filePath: string): Map<string, ParsedProvider> {
  const buf = readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const providers = new Map<string, ParsedProvider>();
  for (const row of rows) {
    const company = clean(row["Company Name"]);
    if (!company) continue;

    const key = slug(company);
    if (providers.has(key)) continue; // duplicado dentro del mismo excel, se queda con el primero

    const email = clean(row["Email Address"]);
    const contactMethod: ContactMethod = EMAIL_RE.test(email) ? "Email" : "Web";
    const status: Status = "Por Contactar";

    providers.set(key, {
      company,
      contact: "", // el excel no trae persona de contacto → fallback de saludo (Task 2)
      email: EMAIL_RE.test(email) ? email : "",
      category: "General Merchandise", // sin descripción/notas confiables para inferCategory
      status,
      website: clean(row["Website"]),
      blacklisted: false,
      phone: clean(row["Phone Number"]),
      address: "",
      contactMethod,
      score: 0,
      firstContactDate: null,
      lastEmailDate: null,
      followUpStep: -1,
      notes: [],
      gmailThreadId: null,
      sendAttemptedAt: null,
      sendError: null,
      source: "expo-outreach-import",
      optedOut: false,
    });
  }
  return providers;
}

async function existingSlugs(): Promise<Set<string>> {
  const [providersSnap, blacklistSnap] = await Promise.all([
    getDocs(collection(db, "providers")),
    getDocs(collection(db, "blacklist")),
  ]);
  const slugs = new Set<string>();
  for (const d of providersSnap.docs) slugs.add(d.id);
  for (const d of blacklistSnap.docs) slugs.add(d.id);
  return slugs;
}

async function main() {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf("--file");
  if (fileIdx === -1 || !args[fileIdx + 1]) {
    console.error("Falta --file <ruta al .xlsx>");
    process.exit(1);
  }
  const filePath = args[fileIdx + 1];
  const dryRun = args.includes("--dry-run");

  const providers = parseRows(filePath);

  const password = process.env.SEED_USER_PASSWORD;
  const email = process.env.SEED_USER_EMAIL ?? "nicolas.conti@ranicgroup.com";
  if (password) await signInWithEmailAndPassword(auth, email, password);
  const existing = await existingSlugs();

  const toImport = [...providers].filter(([key]) => !existing.has(key));
  const withEmail = toImport.filter(([, p]) => p.email !== "");

  console.log(`\nFilas en el Excel: ${providers.size}`);
  console.log(`Ya existían (proveedor o blacklist): ${providers.size - toImport.length}`);
  console.log(`Nuevos a importar: ${toImport.length}`);
  console.log(`  con email válido: ${withEmail.length}`);
  console.log(`  sin email: ${toImport.length - withEmail.length}`);

  if (dryRun) {
    console.log("\n(--dry-run) No se escribió nada en Firestore.");
    process.exit(0);
  }

  if (!password) {
    console.error("\nFalta SEED_USER_PASSWORD en .env.local para escribir.\n");
    process.exit(1);
  }

  const now = Date.now();
  const CHUNK = 50;
  for (let i = 0; i < toImport.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const [key, p] of toImport.slice(i, i + CHUNK)) {
      batch.set(doc(db, "providers", key), { ...p, createdAt: now, updatedAt: now });
    }
    await batch.commit();
  }

  const count = (await getCountFromServer(collection(db, "providers"))).data().count;
  console.log(`\n✓ Import completo. providers: ${count}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Error en el import:", err?.code ?? err);
  process.exit(1);
});
```

- [ ] **Step 2: Agregar el script a `package.json`**

```json
"import-outreach-list": "tsx scripts/import-outreach-list.ts"
```

- [ ] **Step 3: Correr en dry-run con el archivo real**

Run: `npm run import-outreach-list -- --file "docs/Lista-de-Empresas-Exhibidoras.xlsx" --dry-run`
Expected: reporta ~2715 filas leídas, menos duplicados/existentes. Revisar con Nico que los números
tengan sentido antes de importar de verdad — es una lista de exhibitors de una feria de EEUU
(National Hardware Show), va a incluir proveedores internacionales (ej. de China) mezclados con
locales; eso es esperado, no es un bug del parser.

- [ ] **Step 4: Commit**

```bash
git add scripts/import-outreach-list.ts package.json
git commit -m "feat: script de import del excel de outreach (2500 proveedores)"
```

---

### Task 6: Gmail API — setup manual (Nico), vía domain-wide delegation

**Esta tarea no es código.** Nico confirmó que es dueño/admin de Google Workspace de
`ranicgroup.com`, así que se usa **domain-wide delegation** en vez de OAuth de usuario — es más
simple (menos pasos, sin consent screen, sin "test users") y **no caduca nunca** (el problema del
refresh token de 7 días del flujo OAuth normal no aplica acá). Nico tiene que conseguir 1 archivo
(`GMAIL_SERVICE_ACCOUNT_JSON`) que Task 7 necesita como env var. Quien ejecute el plan debe pausar
acá, pasarle estos pasos a Nico tal cual, y esperar el archivo antes de seguir.

**Pasos para Nico (con `nicolas.conti@ranicgroup.com` logueado en el navegador):**

1. Andá a **console.cloud.google.com** → si te pide crear un proyecto, creá uno nuevo, nombre
   sugerido `ranic-outreach` (podés reusar el mismo proyecto de Firebase si ya tenés uno).
2. En el buscador de arriba escribí **"Gmail API"** → entrá → botón **"Enable"** (habilitar).
3. Andá a **"IAM & Admin" → "Service Accounts"** → **"+ Create Service Account"**:
   - Nombre: `ranic-outreach-sender`.
   - No hace falta asignarle ningún rol de IAM en los pasos siguientes — dejalo como está y
     "Done".
4. Entrá a la service account recién creada → pestaña **"Keys"** → **"Add Key" → "Create new key"
   → JSON** → se descarga un archivo `.json`. **Guardalo, es el valor que me vas a pasar en el
   Step 6.**
5. En esa misma pantalla de la service account, copiá el **"Unique ID"** (un número largo, no el
   email) — lo vas a necesitar en el próximo paso.
6. Andá a **admin.google.com** (la consola de administración de Workspace, distinta de Cloud
   Console) → **"Security" → "Access and data control" → "API controls" → "Domain-wide
   Delegation"** → **"Add new"**:
   - Client ID: pegá el "Unique ID" del paso 5.
   - OAuth Scopes: `https://www.googleapis.com/auth/gmail.send,https://www.googleapis.com/auth/gmail.readonly`
     (las dos, separadas por coma, en el mismo campo).
   - Autorizar.
7. Pasame el **contenido completo del archivo `.json`** del paso 4 — se va a guardar como env var
   `GMAIL_SERVICE_ACCOUNT_JSON` en `.env.local` (local) y en Vercel (producción), **nunca en el
   repo**.

- [x] **RESUELTO 2026-08-17.** Nico completó los 7 pasos. La service account es
  `ranic-outreach-sender@ranic-group.iam.gserviceaccount.com` (proyecto `ranic-group`, el mismo de
  Firebase), Client ID `109056235511337216012`, con los dos scopes autorizados en la delegación de
  todo el dominio. `GMAIL_SERVICE_ACCOUNT_JSON` **ya está cargada en `.env.local`** — no hace falta
  pedirle nada más para Task 7.

  **Gotcha que costó una hora, documentado por si reaparece:** la organización `ranicgroup.com`
  tenía la política `constraints/iam.disableServiceAccountKeyCreation` heredada y activa (Google la
  activa por defecto en orgs nuevas), que bloquea descargar claves de service account en cualquier
  proyecto del dominio. Además el rol "Administrador de la organización" que ya tenía Nico solo
  permite *ver* políticas, no modificarlas, y el buscador de roles de la consola no devuelve
  `roles/orgpolicy.policyAdmin` con ningún texto. Se resolvió por Cloud Shell:

  ```bash
  gcloud organizations add-iam-policy-binding 454849479921 \
    --member=user:nicolas.conti@ranicgroup.com --role=roles/orgpolicy.policyAdmin
  gcloud resource-manager org-policies disable-enforce \
    iam.disableServiceAccountKeyCreation --project=ranic-group
  ```

  La anulación quedó acotada al proyecto `ranic-group`; el resto del dominio sigue con la política
  original.

---

### Task 7: Cliente Gmail (envío + lectura de threads)

**Files:**
- Create: `lib/gmail.ts`
- Modify: `package.json` (dependencia `googleapis`)

**Interfaces:**
- Consumes: env var `GMAIL_SERVICE_ACCOUNT_JSON` (de Task 6).
- Produces: `sendOutreachEmail(to: string, subject: string, body: string): Promise<{ threadId: string }>`
  y `hasNewReply(threadId: string): Promise<boolean>` — usados por Tasks 10 y 12.

- [ ] **Step 1: Instalar `googleapis`**

Run: `npm install googleapis`

- [ ] **Step 2: Escribir `lib/gmail.ts`**

```ts
// lib/gmail.ts
// Cliente Gmail API server-side. Usa domain-wide delegation (ver Task 6 del plan de outreach):
// la service account "impersona" a nicolas.conti@ranicgroup.com vía JWT, autorizado a nivel de
// todo el Workspace en admin.google.com — sin OAuth de usuario, sin token que caduque. Nunca
// importar este archivo desde código que corre en el browser — usa env vars sin NEXT_PUBLIC_.
import { google } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
];

function client() {
  const key = JSON.parse(process.env.GMAIL_SERVICE_ACCOUNT_JSON ?? "{}");
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: SCOPES,
    subject: "nicolas.conti@ranicgroup.com",
  });
  return google.gmail({ version: "v1", auth });
}

function buildRawMessage(to: string, subject: string, body: string): string {
  const from = "nicolas.conti@ranicgroup.com";
  const msg = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\n");
  return Buffer.from(msg)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Envía el primer contacto. Devuelve el threadId de Gmail para reply-detection (Task 12). */
export async function sendOutreachEmail(
  to: string,
  subject: string,
  body: string,
): Promise<{ threadId: string }> {
  const gmail = client();
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: buildRawMessage(to, subject, body) },
  });
  if (!res.data.threadId) throw new Error("Gmail no devolvió threadId");
  return { threadId: res.data.threadId };
}

/** true si el thread tiene más de 1 mensaje (o sea, hubo respuesta además del envío inicial). */
export async function hasNewReply(threadId: string): Promise<boolean> {
  const gmail = client();
  const res = await gmail.users.threads.get({ userId: "me", id: threadId, format: "minimal" });
  return (res.data.messages?.length ?? 0) > 1;
}
```

- [ ] **Step 3: Agregar la env var a `.env.local` (local, con el JSON que pasó Nico)**

```
GMAIL_SERVICE_ACCOUNT_JSON='{"type":"service_account", ... todo el json en una sola línea ...}'
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add lib/gmail.ts package.json package-lock.json
git commit -m "feat: cliente Gmail API server-side para envío y reply-detection"
```

(No commitear `.env.local` — ya está gitignored.)

---

### Task 8: Firebase Admin SDK — acceso server-side para el cron

**Por qué:** `firestore.rules` exige `request.auth != null` en toda la base (`match /{document=**}`).
El SDK cliente de Firebase (el que usa `lib/firebase.ts`, `lib/providers.ts`, etc.) necesita una
sesión de usuario logueado para pasar esa regla — un endpoint de cron no tiene eso. `firebase-admin`
usa una service account y **ignora las rules de Firestore por diseño** (están pensadas para
clientes no confiables; el server sí es confiable), que es exactamente lo que necesitan los
endpoints de Task 10 y Task 12. No se toca nada del SDK cliente que ya usa el resto del CRM
(browser, `onSnapshot`, etc.) — sigue igual.

**Files:**
- Create: `lib/firebaseAdmin.ts`
- Modify: `package.json` (dependencia `firebase-admin`)

**Interfaces:**
- Consumes: env var `FIREBASE_SERVICE_ACCOUNT_JSON`.
- Produces: `adminDb` (instancia de Firestore del Admin SDK) — usado por Tasks 9 (variante admin),
  10 y 12.

- [ ] **Step 1: Conseguir la service account (Nico)**

**RESUELTO 2026-08-17.** `FIREBASE_SERVICE_ACCOUNT_JSON` ya está cargada en `.env.local`
(service account `firebase-adminsdk-fbsvc@ranic-group.iam.gserviceaccount.com`). Requirió el mismo
desbloqueo de política de organización documentado en Task 6. No hay que pedirle nada a Nico acá.

- [ ] **Step 2: Instalar `firebase-admin`**

Run: `npm install firebase-admin`

- [ ] **Step 3: Escribir `lib/firebaseAdmin.ts`**

```ts
// lib/firebaseAdmin.ts
// Firestore vía Admin SDK — solo para código server-side (API routes de cron). Ignora
// firestore.rules por diseño (service account de confianza). Nunca importar desde componentes
// de cliente ni desde código que corre en el browser.
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? "{}");

const app =
  getApps()[0] ??
  initializeApp({
    credential: cert(serviceAccount),
  });

export const adminDb = getFirestore(app);
```

- [ ] **Step 4: Agregar la env var a `.env.local`**

```
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account", ... todo el json en una sola línea ...}'
```

- [ ] **Step 5: Verificar que compila**

Run: `npm run build`

- [ ] **Step 6: Commit**

```bash
git add lib/firebaseAdmin.ts package.json package-lock.json
git commit -m "feat: Firebase Admin SDK para acceso server-side (cron de outreach)"
```

---

### Task 9: Configuración de outreach (límite diario) en Firestore

**Files:**
- Create: `lib/outreachConfig.ts` (para el panel `/admin/outreach`, browser, SDK cliente)
- Create: `lib/outreachConfigAdmin.ts` (para los endpoints de cron, Admin SDK)
- Modify: `firestore.rules` (colección `outreachConfig`, mismo criterio `request.auth != null`)

**Interfaces:**
- Consumes: `OutreachConfig` de `lib/types.ts` (Task 4), `adminDb` de `lib/firebaseAdmin.ts`
  (Task 8).
- Produces: `getOutreachConfig()`, `subscribeOutreachConfig(cb)`, `updateOutreachConfig(patch)`
  (Task 13, panel); `getOutreachConfigAdmin()`, `incrementSentTodayAdmin()` (Task 10, cron).

- [ ] **Step 1: Escribir `lib/outreachConfig.ts` (cliente, para el panel)**

```ts
// lib/outreachConfig.ts
// Solo para código de browser (el panel /admin/outreach) — usa el SDK cliente, requiere sesión.
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { OutreachConfig } from "./types";

const REF = doc(db, "outreachConfig", "config");

const DEFAULT_CONFIG: OutreachConfig = {
  dailyLimit: 20,
  enabled: false, // arranca pausado; Nico lo activa a mano desde /admin/outreach cuando esté listo
  sentToday: 0,
  lastResetDate: new Date().toISOString().slice(0, 10),
};

export async function getOutreachConfig(): Promise<OutreachConfig> {
  const snap = await getDoc(REF);
  if (!snap.exists()) {
    await setDoc(REF, DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }
  return snap.data() as OutreachConfig;
}

export function subscribeOutreachConfig(cb: (c: OutreachConfig) => void) {
  return onSnapshot(REF, (snap) => {
    if (snap.exists()) cb(snap.data() as OutreachConfig);
  });
}

export function updateOutreachConfig(patch: Partial<OutreachConfig>) {
  return updateDoc(REF, patch);
}
```

- [ ] **Step 2: Escribir `lib/outreachConfigAdmin.ts` (Admin SDK, para el cron)**

```ts
// lib/outreachConfigAdmin.ts
// Solo para endpoints de cron (Task 10) — usa Admin SDK, ignora firestore.rules.
import { adminDb } from "./firebaseAdmin";
import type { OutreachConfig } from "./types";

const REF = adminDb.collection("outreachConfig").doc("config");

const DEFAULT_CONFIG: OutreachConfig = {
  dailyLimit: 20,
  enabled: false,
  sentToday: 0,
  lastResetDate: new Date().toISOString().slice(0, 10),
};

export async function getOutreachConfigAdmin(): Promise<OutreachConfig> {
  const snap = await REF.get();
  if (!snap.exists) {
    await REF.set(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }
  return snap.data() as OutreachConfig;
}

/** yyyy-mm-dd en America/New_York (la ventana de envío se piensa en esa zona). */
function todayNY(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

/**
 * Resetea sentToday si cambió el día (America/New_York), y suma 1. Devuelve el config resultante
 * para que el caller sepa si ya llegó al límite.
 */
export async function incrementSentTodayAdmin(): Promise<OutreachConfig> {
  const current = await getOutreachConfigAdmin();
  const today = todayNY();
  const next: OutreachConfig =
    current.lastResetDate === today
      ? { ...current, sentToday: current.sentToday + 1 }
      : { ...current, sentToday: 1, lastResetDate: today };
  await REF.set(next);
  return next;
}
```

- [ ] **Step 3: Agregar la colección a `firestore.rules`**

Agregar `match /outreachConfig/{id} { allow read, write: if request.auth != null; }` junto a las
reglas de `providers` existentes, y publicar las reglas nuevas en la consola de Firebase (mismo
gotcha ya documentado en la memoria del proyecto: hay que pegarlas manualmente en Firestore →
Rules → Publicar, no alcanza con el archivo del repo). Nota: esta rule solo afecta al SDK cliente
(el panel) — el Admin SDK de `outreachConfigAdmin.ts` la ignora, como corresponde.

- [ ] **Step 4: Verificar que compila**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add lib/outreachConfig.ts lib/outreachConfigAdmin.ts firestore.rules
git commit -m "feat: config de outreach (límite diario, on/off) — variante cliente y admin"
```

---

### Task 10: Endpoint de envío en tandas

**Files:**
- Create: `app/api/outreach/send-batch/route.ts`

**Interfaces:**
- Consumes: `sendOutreachEmail` (Task 7), `getOutreachConfigAdmin`/`incrementSentTodayAdmin`
  (Task 9), `generateOutreachEmail` (Task 3), `advanceFollowUp` (`lib/followup.ts`, ya existe),
  `adminDb` (Task 8).
- Produces: `POST /api/outreach/send-batch` — lo dispara el cron de Task 11.

- [ ] **Step 1: Escribir el endpoint**

```ts
// app/api/outreach/send-batch/route.ts
// Manda hasta un lote chico de emails de primer contacto por corrida (llamado seguido por el
// cron de Task 11), respetando el límite diario de OutreachConfig. Server-only, usa Admin SDK
// (ver Task 8) porque no hay sesión de usuario en un cron.
import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebaseAdmin";
import { generateOutreachEmail } from "../../../../lib/outreachEmail";
import { advanceFollowUp } from "../../../../lib/followup";
import { sendOutreachEmail } from "../../../../lib/gmail";
import {
  getOutreachConfigAdmin,
  incrementSentTodayAdmin,
} from "../../../../lib/outreachConfigAdmin";
import type { Provider } from "../../../../lib/types";

const BATCH_SIZE = 3; // por corrida de cron; el ritmo diario lo marca dailyLimit + frecuencia del cron

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const config = await getOutreachConfigAdmin();
  if (!config.enabled) {
    return NextResponse.json({ sent: 0, reason: "outreach pausado" });
  }
  if (config.sentToday >= config.dailyLimit) {
    return NextResponse.json({ sent: 0, reason: "límite diario alcanzado" });
  }

  const remaining = config.dailyLimit - config.sentToday;
  const take = Math.min(BATCH_SIZE, remaining);

  // Scoped a source === "expo-outreach-import" a propósito: los 79 proveedores manuales
  // pre-existentes no tienen optedOut seteado (Firestore no matchea "== false" contra un campo
  // ausente), y aunque lo tuvieran, el envío automático no debe tocar relaciones que Nico ya
  // gestiona a mano desde el CRM.
  const snap = await adminDb
    .collection("providers")
    .where("status", "==", "Por Contactar")
    .where("contactMethod", "==", "Email")
    .where("source", "==", "expo-outreach-import")
    .where("outreachEligible", "==", true)
    .where("optedOut", "==", false)
    .where("sendAttemptedAt", "==", null)
    .limit(take)
    .get();

  let sent = 0;
  for (const d of snap.docs) {
    const p = { id: d.id, ...(d.data() as Omit<Provider, "id">) };
    const now = Date.now();
    try {
      const body = generateOutreachEmail(p);
      const subject = `Wholesale inquiry — ${p.company}`;
      const { threadId } = await sendOutreachEmail(p.email, subject, body);
      const today = new Date().toISOString().slice(0, 10);
      await adminDb
        .collection("providers")
        .doc(p.id)
        .update({
          status: "Contactado",
          gmailThreadId: threadId,
          sendAttemptedAt: now,
          sendError: null,
          updatedAt: now,
          ...advanceFollowUp(p, today),
        });
      await incrementSentTodayAdmin();
      sent++;
    } catch (err) {
      await adminDb.collection("providers").doc(p.id).update({
        sendAttemptedAt: now,
        sendError: err instanceof Error ? err.message : String(err),
        updatedAt: now,
      });
    }
  }

  return NextResponse.json({ sent });
}
```

- [ ] **Step 2: Agregar `CRON_SECRET` a `.env.local`**

Cualquier string random largo, ej. generado con `openssl rand -hex 32`. Se usa para que solo
Vercel Cron (o Nico a mano con curl) pueda disparar el endpoint.

- [ ] **Step 3: Crear el índice compuesto de Firestore**

La query de arriba filtra por 5 igualdades (`status`, `contactMethod`, `source`, `optedOut`,
`sendAttemptedAt`) — Firestore va a pedir un índice compuesto. **No esperar a que falle en
producción**: correr la query una vez en local/dev primero (o abrir Firebase Console → Firestore →
Indexes → crear manualmente uno compuesto sobre `providers` con esos 5 campos, todos "Ascending"),
así el primer disparo real del cron no se pierde por un error de índice.

- [ ] **Step 4: Probar a mano**

Run:
```bash
curl -X POST http://localhost:3000/api/outreach/send-batch -H "Authorization: Bearer <CRON_SECRET local>"
```
Expected: con `enabled: false` (default de Task 9) responde `{ "sent": 0, "reason": "outreach pausado" }`.
Activar `enabled: true` a mano en Firestore con 1-2 proveedores de prueba (emails propios de Nico,
no proveedores reales) antes de habilitar el cron de verdad.

- [ ] **Step 5: Commit**

```bash
git add app/api/outreach/send-batch/route.ts
git commit -m "feat: endpoint de envío en tandas de outreach automático (admin SDK)"
```

---

### Task 11: Disparo periódico dentro de la ventana horaria

**Resuelto:** el proyecto está en plan **Hobby** de Vercel (Nico no paga, no hay upgrade
planeado), que solo permite cron *diario* — no sirve para disparar cada 20 minutos. Se usa un
**GitHub Actions workflow con `schedule`** en el mismo repo (gratis, no depende del plan de
Vercel). El endpoint de Task 10 no cambia — es agnóstico de quién lo llama, solo valida
`CRON_SECRET`.

**Nota sobre precisión:** los `schedule` de GitHub Actions son *best-effort* — en la práctica se
atrasan entre 5 y 20 minutos bajo carga de la plataforma, así que el `*/20` de abajo no va a caer
siempre puntual. Para este caso da igual: `dailyLimit` en `OutreachConfig` acota el total
independientemente de cuántas corridas hubo en la ventana. Si más adelante se quiere timing más
predecible, **cron-job.org** (gratis, dispara con más precisión) es un reemplazo directo — mismo
endpoint, mismo header, sin tocar código.

**Files:**
- Create: `.github/workflows/outreach-send-batch.yml`

**Interfaces:**
- Consumes: `CRON_SECRET` como GitHub Actions secret (mismo valor que en Vercel/`.env.local`),
  `https://ranicgroup.com/api/outreach/send-batch`.

- [ ] **Step 1: Escribir el workflow de envío**

```yaml
# .github/workflows/outreach-send-batch.yml
name: Outreach — send batch
on:
  schedule:
    # cada 20 min, 13-16 UTC ≈ 9am-12pm America/New_York (ajustar ±1h en horario de verano)
    - cron: "*/20 13-16 * * *"
  workflow_dispatch: {} # permite disparar manualmente desde la pestaña Actions, para probar
jobs:
  send:
    runs-on: ubuntu-latest
    steps:
      - name: POST /api/outreach/send-batch
        run: |
          curl -sS -X POST https://ranicgroup.com/api/outreach/send-batch \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            --fail
```

- [ ] **Step 2: Agregar `CRON_SECRET` como secret del repo**

GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret** → nombre
`CRON_SECRET`, mismo valor que en `.env.local` y en Vercel (Settings → Environment Variables —
cargarlo ahí también, lo necesita el endpoint en producción independientemente de quién lo llame).

- [ ] **Step 3: Probar el workflow a mano**

GitHub → pestaña **Actions** → el workflow "Outreach — send batch" → **"Run workflow"** (gracias al
`workflow_dispatch` del Step 1) → confirmar que corre verde. Con `enabled: false` (default de Task
9) el endpoint responde 200 igual, solo que no manda nada.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/outreach-send-batch.yml
git commit -m "feat: disparo periódico del envío gradual de outreach vía GitHub Actions"
```

---

### Task 12: Reply detection

**Por qué la rotación:** revisar TODOS los proveedores "Contactado" en una sola corrida escala mal
— con cientos/miles de contactados, son igual de cientos/miles de llamadas secuenciales a la Gmail
API en una sola invocación serverless, y se corta por timeout (10s en funciones gratis, hasta 300s
en planes pagos) mucho antes de terminar, revisando siempre los mismos primeros y sin llegar nunca
a los últimos. Se resuelve ordenando por `replyCheckedAt` ascendente y limitando a 50 por corrida —
cada hora revisa los 50 más "viejos" (los que hace más tiempo no se chequean) y rota, así en pocas
horas cubre todo el universo sin pasarse del timeout nunca.

**Files:**
- Create: `app/api/outreach/check-replies/route.ts`
- Create: `.github/workflows/outreach-check-replies.yml`
- Modify: `lib/types.ts` (campo `replyCheckedAt` en `Provider`, opcional — mismo motivo que
  `optedOut` en Task 3)

**Interfaces:**
- Consumes: `hasNewReply` (Task 7), `adminDb` (Task 8).
- Produces: marca `notes` del proveedor cuando detecta respuesta, para que Nico la vea en el
  dashboard y decida el siguiente paso a mano (no cambia `status` automáticamente — la
  clasificación de la respuesta es manual, spec §3).

- [ ] **Step 1: Agregar `replyCheckedAt` a `Provider`**

```ts
// lib/types.ts — agregar dentro del type Provider
/** Timestamp del último chequeo de reply-detection. Ordena la rotación del Task 12. */
replyCheckedAt?: number;
```

- [ ] **Step 2: Escribir el endpoint**

```ts
// app/api/outreach/check-replies/route.ts
// Revisa los threads de proveedores en "Contactado" con gmailThreadId, y si detecta respuesta
// agrega una nota visible — Nico decide a mano el siguiente status. Usa Admin SDK (Task 8).
// Rotación por replyCheckedAt (ver nota de la Task): revisa los BATCH_SIZE más viejos por corrida,
// nunca todos, para no pasarse del timeout serverless a medida que crece el volumen.
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../lib/firebaseAdmin";
import { hasNewReply } from "../../../../lib/gmail";
import type { NoteEntry, Provider } from "../../../../lib/types";

const REPLY_NOTE_TEXT = "Respuesta detectada — revisar Gmail.";
const BATCH_SIZE = 50;

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const snap = await adminDb
    .collection("providers")
    .where("status", "==", "Contactado")
    .orderBy("replyCheckedAt", "asc") // docs sin el campo ordenan primero (undefined < cualquier número)
    .limit(BATCH_SIZE)
    .get();

  let flagged = 0;
  for (const d of snap.docs) {
    const p = { id: d.id, ...(d.data() as Omit<Provider, "id">) };
    const now = Date.now();
    if (!p.gmailThreadId) {
      await adminDb.collection("providers").doc(p.id).update({ replyCheckedAt: now });
      continue;
    }
    const alreadyFlagged = p.notes.some((n) => n.text === REPLY_NOTE_TEXT);
    const patch: Record<string, unknown> = { replyCheckedAt: now };
    if (!alreadyFlagged && (await hasNewReply(p.gmailThreadId))) {
      const note: NoteEntry = { date: new Date().toISOString().slice(0, 10), text: REPLY_NOTE_TEXT };
      patch.notes = FieldValue.arrayUnion(note);
      patch.updatedAt = now;
      flagged++;
    }
    await adminDb.collection("providers").doc(p.id).update(patch);
  }

  return NextResponse.json({ flagged, checked: snap.docs.length });
}
```

- [ ] **Step 3: Escribir el workflow, 1 vez por hora, corriendo todo el día** (no hace falta
      limitarlo a la ventana de envío)

```yaml
# .github/workflows/outreach-check-replies.yml
name: Outreach — check replies
on:
  schedule:
    - cron: "0 * * * *"
  workflow_dispatch: {}
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - name: POST /api/outreach/check-replies
        run: |
          curl -sS -X POST https://ranicgroup.com/api/outreach/check-replies \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            --fail
```

- [ ] **Step 4: Deploy y probar a mano** (pestaña Actions → "Run workflow") contra un thread real
      de prueba

- [ ] **Step 5: Commit**

```bash
git add app/api/outreach/check-replies/route.ts .github/workflows/outreach-check-replies.yml lib/types.ts
git commit -m "feat: reply-detection de outreach automático (admin SDK, rotación por replyCheckedAt)"
```

---

### Task 13: Opt-out manual + panel `/admin/outreach`

**Por qué el opt-out manual:** el footer CAN-SPAM de la Task 3 promete "reply and let us know and
we'll remove you from our list", pero en ningún lugar del plan hay algo que escriba
`optedOut = true` — la reply-detection de la Task 12 solo deja una nota, no lo hace por vos. Sin un
control que lo setee, la única forma de honrar un pedido de baja sería editar Firestore a mano, y
CAN-SPAM da 10 días hábiles para cumplirlo. Se resuelve con un checkbox simple en la ficha del
proveedor — Nico lee la nota "Respuesta detectada", abre el mail real, y si es un pedido de baja
tilda el checkbox.

**Files:**
- Modify: `components/ProviderDetail.tsx` y/o `components/ProviderForm.tsx` (checkbox
  "No contactar más")
- Create: `app/admin/(crm)/outreach/page.tsx`
- Modify: navegación del sidebar/bottom-nav existente (agregar el link "Outreach")

**Interfaces:**
- Consumes: `updateProvider` (`lib/providers.ts`, ya existe), `subscribeOutreachConfig`,
  `updateOutreachConfig` (Task 9, variante cliente); `subscribeProviders` (`lib/providers.ts`, ya
  existe) filtrado por `source === "expo-outreach-import"` para las métricas.

- [ ] **Step 1: Agregar el checkbox de opt-out**

En `components/ProviderDetail.tsx` (o `ProviderForm.tsx`, el que ya edite el proveedor — abrir
ambos y usar el que corresponda al patrón existente), agregar un checkbox rotulado
**"No contactar más"** ligado a `provider.optedOut`, que al tildarse llame
`updateProvider(provider.id, { optedOut: true })` (y `{ optedOut: false }` al destildar). Sin
código completo acá porque depende de la estructura exacta del componente existente — replicar el
patrón que ya usan los otros campos booleanos/checkbox de ese archivo, si los hay, o el de un
input controlado simple si no.

- [ ] **Step 2: Escribir la página del panel**

Seguir el patrón visual y de componentes que ya usan las otras vistas de `/admin` (ver
`app/admin/(crm)/finanzas/page.tsx` o `stock/page.tsx` como referencia de estructura — MetricCards
+ tabla). Contenido mínimo:
- Toggle "Envío automático activo" (`enabled`).
- Input numérico "Límite diario" (`dailyLimit`), con guardado on-blur vía `updateOutreachConfig`.
- 3 MetricCards: "Enviados hoy" (`sentToday`/`dailyLimit`), "Contactados (outreach)" (count de
  `providers` con `source === "expo-outreach-import"` y `status !== "Por Contactar"`), "Respuestas
  a revisar" (count de proveedores con la nota "Respuesta detectada — revisar Gmail." y `status`
  todavía en `"Contactado"`).
- Tabla de los últimos 20 `sendError != null`, para que Nico vea envíos fallidos sin tener que
  bucear en Firestore.

No se incluye código completo del componente acá porque depende de los componentes UI compartidos
del proyecto (`MetricCard`, layout de `/admin`) — quien implemente debe abrir una vista existente
(`finanzas` o `stock`) y replicar la estructura exacta de imports/layout antes de escribir esta.

- [ ] **Step 3: Agregar el link de navegación**

Ubicar el componente de sidebar/bottom-nav (`components/`), agregar la entrada "Outreach" apuntando
a `/admin/outreach`, siguiendo el mismo patrón que las entradas existentes (Finanzas, Stock, etc.).

- [ ] **Step 4: Verificar en el browser (build + preview)**

Run: `npm run build && npm run dev`, abrir `/admin/outreach` logueado, confirmar que el toggle y el
input de límite escriben en Firestore (`onSnapshot` refleja el cambio sin recargar). Abrir también
la ficha de un proveedor y confirmar que el checkbox "No contactar más" persiste `optedOut`.

- [ ] **Step 5: Commit**

```bash
git add app/admin/\(crm\)/outreach/page.tsx components/ lib/types.ts
git commit -m "feat: opt-out manual + panel /admin/outreach (control de envío gradual + métricas)"
```

---

### Task 14: Clasificación de rebotes + cortacircuito por tasa de rebote

> **Corrección de la premisa original (2026-08-17, tras la prueba con un rebote real).** Esta task
> se escribió afirmando que los rebotes entraban al CRM como interés del proveedor, porque Gmail
> entregaría el aviso de `mailer-daemon` *dentro del hilo original* y `hasNewReply()` devolvería
> `true`. **Eso es falso.** Se mandó a propósito a `noexiste@ranicgroup.com` y el DSN llegó en un
> hilo **distinto** (`1a011835f8a4084b`) del envío (`1a0118359093412c`), que quedó con un solo
> mensaje. O sea que los rebotes nunca contaminaron la detección de respuestas.
>
> La primera implementación de esta task, que inspeccionaba el hilo del envío, era **inerte**: no
> podía detectar un solo rebote, y tenía 89 tests en verde. La detección tiene que partir del
> buzón, no del hilo.

**Por qué:** no hay ningún manejo de rebotes. Cuando mandemos a los 917, una parte va a rebotar
—direcciones de una lista de feria, muchas de hace meses— y hoy eso es **invisible**: el aviso
queda en la casilla de Nico sin que nadie lo lea ni lo registre, y el proveedor queda en
"Contactado" para siempre aunque el mail nunca haya llegado a nadie. Ensucia los datos, y peor: el
Follow-up Track le va a pedir a Nico que insista los días 4, 7 y 12 contra casillas muertas.

La segunda mitad es de reputación: una tasa de rebote alta es la forma más rápida de arruinar el
dominio, que es lo que todo el diseño gradual intenta proteger. `dailyLimit` acota el ritmo, pero
si el 30% de la lista rebota el sistema sigue mandando hasta que alguien lo note a mano.

**Latencia de detección:** no hay. Con el mecanismo correcto —recuperar los DSN del buzón por
consulta, no rotar hilos— cada corrida procesa **todos** los rebotes de la ventana, haya 20
contactados o 917. La versión anterior de este plan advertía un ciclo de ~19 horas al final de la
campaña; esa limitación era consecuencia de la rotación por `replyCheckedAt`, y desaparece con el
cambio de mecanismo. La detección de **respuestas** sigue rotando y sigue teniendo ese ciclo, pero
ahí no importa: una respuesta que se lee unas horas más tarde no le hace daño a nadie, y un rebote
sin detectar sí.

**Files:**
- Modify: `lib/gmail.ts` (`hasNewReply` → `inspectThread`)
- Modify: `lib/types.ts` (`OutreachConfig`: `sentTotal`, `bouncedTotal`, `pausedReason`)
- Modify: `lib/outreachConfigAdmin.ts` (`recordBounceAdmin`, `sentTotal` en el incremento)
- Modify: `app/api/outreach/check-replies/route.ts` (clasificar en vez de "hay respuesta sí/no")
- Modify: `app/api/outreach/send-batch/route.ts` (evaluar el cortacircuito antes de mandar)
- Modify: `app/admin/(crm)/outreach/page.tsx` (banner del motivo de pausa + botón de limpiarlo)
- Create: `lib/__tests__/bounceClassification.test.ts`

**Interfaces:**
- Produces: `listRecentBounces(days): Promise<Bounce[]>` con
  `Bounce = { messageId, recipient, state, reason, receivedAt }` — recupera los DSN del buzón.
- Produces: `inspectThread(threadId): Promise<{ state, reason }>` — sigue existiendo para la
  detección de **respuestas**; reemplaza a `hasNewReply`, que deja de existir.

- [ ] **Step 1: Recuperación de los DSN — sobre-capturar y dejar que la clasificación filtre**

**La consulta NO puede ser `from:mailer-daemon`.** Ese es cómo rebota Google; cuando el
destinatario está en Outlook, en un servidor corporativo o en cualquier MTA que no sea Google, el
DSN llega de `postmaster@`, de `MAILER-DAEMON@<dominio-remoto>` o con remitente nulo. Con 917
destinatarios en dominios ajenos, **la mayoría de los rebotes reales no vienen de
`mailer-daemon`**. La prueba del 2026-08-17 fue interna al dominio, que es justo el único caso
donde esa consulta acierta — otra forma en que una prueba puede pasar por la razón equivocada.

La regla: **la recuperación sobre-captura, la clasificación filtra.** Traer un conjunto amplio
—remitentes tipo daemon/postmaster **más** asuntos típicos (`undeliverable`, `delivery status
notification`, `returned mail`, `failure notice`)— y que `classifyThread` decida. Ya es una
función pura y ya sabe decir que no. Un falso positivo en la consulta no cuesta nada; un falso
negativo es un rebote que nunca detectamos.

Nota: que el asunto entre en la **consulta** no contradice la regla de no clasificar por asunto.
Son dos capas distintas: la consulta amplía el candidato, la clasificación decide. El test de un
mail humano con asunto `"Re: Delivery Status Notification (Failure)"` clasificado como respuesta
sigue valiendo y ahora cubre exactamente este camino.

**Ventana: 4 días.** Los rebotes duros llegan en segundos, pero los blandos llegan cuando el MTA
remoto se rinde después de reintentar, típicamente entre 3 y 5 días. Con 2 días se perdían casi
todos. La idempotencia por `alreadyNoted` ya cubre el reprocesamiento, así que ampliar la ventana
solo cuesta unas consultas por hora.

- [ ] **Step 2: Criterio de clasificación** (sin cambios respecto de lo ya implementado)

1. **Señal primaria:** `Content-Type: multipart/report; report-type=delivery-status` (RFC 3464) o
   la cabecera `X-Failed-Recipients`. Son estructurales del rebote; ningún mail legítimo las trae.
2. **Corroboración, nunca suficiente sola:** `From` tipo `mailer-daemon@` / `postmaster@`. Para
   contar como rebote necesita además un código DSN en el cuerpo. Apoyarse en el `From` haría que
   esto funcione contra Google y falle contra cualquier otro MTA — y al revés, un proveedor que
   escribe de verdad desde `postmaster@suempresa.com` no es un rebote.
3. **Nunca el asunto** como criterio de clasificación: depende del idioma de la cuenta y un humano
   puede responder citándolo.

**Duro vs blando:** el cuerpo trae `Status: 5.x.x` (permanente) o `4.x.x` (transitorio). Sin línea
`Status:` legible → blando. La asimetría es deliberada: marcar duro de más apaga el envío y el
follow-up de un proveedor que quizás está vivo; marcar blando de más solo deja una nota.

- [ ] **Step 3: Correlación del DSN con el proveedor**

Por `X-Failed-Recipients` (o el `Final-Recipient` del reporte) contra `Provider.email`. Tres
guardas, todas necesarias:

1. `status == "Contactado"` y `source == "expo-outreach-import"` — no tocar proveedores que Nico
   gestiona a mano.
2. El proveedor tiene `sendAttemptedAt` — le mandamos nosotros.
3. **La fecha del DSN es posterior a `sendAttemptedAt`.** Sin esta guarda temporal, un rebote de
   un mail que Nico mandó a mano hace tres días entra en la ventana y mata retroactivamente a un
   proveedor al que le escribimos hoy y que tal vez recibió bien.

Si un DSN correlaciona con **varios** proveedores, se marcan todos: si la casilla está muerta, lo
está para los dos. Eso es correcto, no es una pérdida de precisión.

- [ ] **Step 2: Qué se escribe en cada caso**

Todo con campos que ya existen; no se toca el enum de `Status`.

| Caso | Campos |
|---|---|
| `respuesta` | nota "Respuesta detectada — revisar Gmail." (igual que hoy) |
| `rebote-duro` | `sendError: "Rebote duro: <status> <diagnóstico>"`, `outreachEligible: false`, `followUpStopped: true`, nota "Rebote duro — la dirección no existe.", **y NO la nota de respuesta** |
| `rebote-blando` | nota "Rebote transitorio — puede reintentarse.", nada más |
| `sin-respuesta` | solo `replyCheckedAt` |

`followUpStopped: true` es el que más impacto tiene: sin eso el Follow-up Track le pide a Nico que
insista los días 4, 7 y 12 contra una casilla que no existe — tres recordatorios inútiles por cada
rebote. Ya existe en `Provider`, `lib/followup.ts` lo respeta devolviendo `null` y `ProviderDetail`
lo muestra: cero UI nueva.

**No usar `optedOut` para rebotes.** Ese campo significa "pidió no recibir más" y es el registro de
la promesa CAN-SPAM; mezclarle direcciones muertas le quita valor como constancia de un pedido
explícito.

- [ ] **Step 3: Contadores en `OutreachConfig`**

```ts
/**
 * Envíos automáticos acumulados desde siempre. NO es una ventana móvil: la tasa de rebote que
 * calcula el cortacircuito es HISTÓRICA sobre toda la campaña. Para 917 envíos alcanza; si algún
 * día la campaña fuera continua y de años, habría que pasar a una ventana.
 */
sentTotal: number;
/** Rebotes DUROS acumulados. Los blandos no suman: un buzón lleno no dice nada de la lista. */
bouncedTotal: number;
/** Motivo de la última pausa automática. null = nunca pasó o alguien lo limpió a mano. */
pausedReason: string | null;
```

`sentTotal` se incrementa en la misma transacción que `sentToday` (`incrementSentTodayAdmin`).
`bouncedTotal` se incrementa desde `check-replies` con un `recordBounceAdmin()` transaccional,
**una vez por DSN, no una vez por proveedor correlacionado**. Si un DSN matchea dos proveedores,
los dos se marcan pero el contador sube 1: si no, la tasa se distorsiona hacia arriba justo cuando
el cortacircuito la está mirando.

- [ ] **Step 4: Cortacircuito en `send-batch`**

Antes de mandar, después de leer el config:

- **Piso mínimo de muestra: no evaluar la tasa con `sentTotal < 50`.** Con contadores históricos, 1
  rebote en los primeros 5 envíos da 20% y pausaría todo el primer día. Por debajo del piso los
  rebotes se registran igual, solo que no cortan.
- Si `sentTotal >= 50` y `bouncedTotal / sentTotal > 0.05` → `enabled: false` +
  `pausedReason: "Pausado automáticamente: tasa de rebote 7.2% (18 de 250)"` y responder sin
  mandar. El 5% es más o menos donde los proveedores de correo empiezan a penalizar; arriba de 10%
  ya es daño hecho.
- `pausedReason` **no se borra al volver a encender**: queda hasta que alguien lo limpie
  explícitamente desde el panel. Un `enabled: false` silencioso es indistinguible de que Nico lo
  apagó a mano, y se perdería el registro de que el sistema cortó solo.

- [ ] **Step 5: Banner en el panel**

En `/admin/outreach`, si `pausedReason` no es null, mostrarlo arriba de todo con el estilo de alerta
que ya usa el proyecto (`text-status-overdue`), con un botón "Limpiar aviso" que haga
`updateOutreachConfig({ pausedReason: null })`. Agregar además una MetricCard con la tasa de rebote
acumulada (`bouncedTotal / sentTotal`).

- [ ] **Step 6: Tests de clasificación**

`lib/__tests__/bounceClassification.test.ts`, sobre la función pura de clasificación (sin red):
rebote duro 5.1.1, rebote blando 4.2.2, respuesta normal de un humano, hilo sin respuesta, y
rebote sin línea `Status:` legible → blando.

- [ ] **Step 7: Verificación contra un rebote real**

El rebote ya existe: el envío a `noexiste@ranicgroup.com` del 2026-08-17 dejó un DSN auténtico de
Gmail en el buzón, y `0-test-rebote` quedó en "Contactado" esperándolo. **No hace falta mandar
nada nuevo**: una corrida de `check-replies` con el mecanismo corregido tiene que levantarlo. Es la
mejor verificación posible, porque el rebote es anterior al código y no puede haberse acomodado a él.

Esperado: `hardBounces: 1`, y el proveedor con `sendError`, `outreachEligible: false`,
`followUpStopped: true` y la nota de rebote — y **sin** la nota de respuesta detectada.

Recién cuando eso dé verde: contadores a 0 (`reset-totals`) y PR.

**Nota metodológica, para lo que venga:** la primera implementación de esta task tenía 89 tests en
verde y no podía detectar un solo rebote. Los tests validaban la clasificación, que estaba bien;
lo que estaba mal era el supuesto sobre de dónde sale el mensaje, y ningún test unitario iba a
encontrarlo. Por eso la verificación va contra Gmail real y no contra un fixture.

- [ ] **Step 8: Commit**

```bash
git add lib/gmail.ts lib/types.ts lib/outreachConfigAdmin.ts app/api/outreach \
  app/admin/\(crm\)/outreach/page.tsx lib/__tests__/bounceClassification.test.ts
git commit -m "feat: clasificación de rebotes + cortacircuito por tasa de rebote"
```

---

## Self-review

- **Cobertura del spec:** §2.1 import → Task 5. §2.2 motor de envío → Tasks 6-7-10. §2.3 envío
  gradual configurable → Tasks 9-11. §2.4 reply detection → Task 12. §2.5 reuso de
  Status/Follow-up → Task 10 (`advanceFollowUp`). §4 campos nuevos → Task 4. §6
  endpoint/scheduler/límite → Tasks 10-11. §7.1 teléfono → Task 1. §7.2 saludo → Task 2. §7.5/§7.6
  booth/description descartados → Task 5 (el parser ni los lee). CAN-SPAM (no estaba en el spec
  original, agregado tras revisión) → Task 3. Acceso server-side sin sesión (no estaba en el spec
  original, agregado tras revisión) → Task 8.
- **Placeholders:** ninguno — la dirección postal de Task 3 ya está resuelta (`3 Ridgedale Ave,
  Summit, NJ 07901`). Task 13 es la única con una nota explícita de "no incluyo el JSX completo"
  porque depende de componentes compartidos que el ejecutor debe mirar primero.
- **Consistencia de tipos:** `OutreachConfig`, `sendOutreachEmail`, `hasNewReply`,
  `getOutreachConfigAdmin`/`incrementSentTodayAdmin`/`getOutreachConfig`/`updateOutreachConfig`,
  `generateOutreachEmail`, `adminDb` se usan con la misma firma en todas las tareas que los
  consumen.
- **Hallazgos de la implementación real de VS Code Claude (2026-08-14), incorporados:**
  1. `optedOut` requerido rompía el build en 3 call-sites — pasado a opcional (Task 3), y se
     agregó la regla general a Global Constraints para no repetir el error en campos futuros.
  2. El footer de opt-out no tenía forma de registrarse — agregado checkbox manual en Task 13
     (`ProviderDetail`/`ProviderForm`) que setea `optedOut`.
  3. `check-replies` no escalaba (todas las llamadas a Gmail en una corrida, timeout serverless) —
     agregada rotación por `replyCheckedAt` con lotes de 50 (Task 12).
  4. La query de envío (`optedOut == false`) no matchea documentos donde el campo está ausente —
     se agregó `source == "expo-outreach-import"` a la query de Task 10 para no tocar
     accidentalmente a los 79 proveedores manuales pre-existentes (que nunca tendrán `optedOut`
     seteado) y para que el filtro sea siempre consistente en los datos que sí lo importan.

## Siguiente paso

Pasale este plan a Claude en VS Code (mismo flujo de siempre: ejecuta tarea por tarea, te trae la
respuesta, yo la valido). Bloqueantes tuyos que quedan, en el orden en que los va a pedir:
**Task 6** (archivo JSON de la service account de Gmail, vía domain-wide delegation) y **Task 8**
(service account de Firebase, distinta de la de Gmail). Tasks 3, 5 y 11 ya están resueltas.
