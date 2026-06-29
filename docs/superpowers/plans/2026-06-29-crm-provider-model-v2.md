# RANIC CRM — Modelo de proveedores v2 + importación histórica Implementation Plan

> **For agentic workers (Claude en VS Code):** Ejecutá este plan tarea por tarea, en orden, con
> commit al final de cada tarea. Esto solo toca `/admin` (CRM) — no tocar nada del sitio público
> (`app/page.tsx`, `app/privacy`, `app/terms`, `components/public/`). Trabajá en un branch nuevo
> (ej. `crm-proveedores-v2`) y abrí un PR cuando termines, igual que en la Fase 2 — no commitear
> directo a `main`.

**Goal:** Ampliar el modelo de `Provider` (teléfono, dirección, método de contacto, score),
expandir los estados de 5 a 8, condicionar el Follow-up Track al método de contacto, e importar
los proveedores históricos de la planilla CSV de Nico a Firestore.

**Architecture:** Cambios de tipo en `lib/types.ts` que se propagan por inferencia de TypeScript
a `lib/providers.ts` (sin tocarlo) y a los componentes que construyen/leen `Provider`. Un módulo
puro nuevo (`lib/categoryInference.ts`, testeado con TDD) decide la categoría de las filas
importadas que no la tienen. Un script nuevo (`scripts/import-providers.ts`), calcado en
estructura a `scripts/import-expo.ts`, hace el import real con el SDK web autenticado.

**Tech Stack:** TypeScript, Firebase Web SDK, Vitest (TDD para `lib/followup.ts` y
`lib/categoryInference.ts`), `csv-parse` (nuevo, para parsear el CSV con campos entre comillas).

**Spec de referencia:** `docs/superpowers/specs/2026-06-29-crm-provider-model-v2-design.md`.

## Global Constraints

- **No tocar el sitio público** (`app/page.tsx`, `app/privacy/`, `app/terms/`,
  `components/public/`) — este plan es 100% CRM (`/admin`).
- **No agregar un campo de "fuente/origen del lead"** separado de `contactMethod` —
  `Status: "Referido"` ya cubre ese caso.
- **No expandir `BlacklistEntry`** más allá de `name`.
- **Idioma:** labels de UI en español (consistente con el resto del CRM).
- **4 empresas del CSV se saltan del import porque ya existen como proveedores activos**:
  `Fragrancex` (slug `fragrancex`, ya está como "FragranceX"), `EE Distribution`, `TPS-Wholesale`
  (slug `tps-wholesale`, ya está como "TPS Wholesale"), `BD Distributors`. No se sobreescriben.
- **"Miami Trading Zone" se trata como estafa**: no se importa a `providers` (ya está en
  `blacklist` desde la Fase 1, ahí se queda).
- **La fila con Status "Estafa" del CSV (AJ-Globals) va a `blacklist`, no a `providers`.**

---

## File Structure

```
ranic-web/
├── lib/
│   ├── types.ts                          # Modify: ContactMethod, Status (8), Provider (+4 campos)
│   ├── followup.ts                       # Modify: nextFollowUpDate gateado por contactMethod
│   ├── categoryInference.ts              # Create: inferCategory(notes) puro y testeado
│   └── __tests__/
│       ├── followup.test.ts              # Modify: + casos de contactMethod
│       └── categoryInference.test.ts     # Create
├── components/
│   ├── ProviderForm.tsx                  # Modify: + teléfono/dirección/método/score
│   ├── ProviderTable.tsx                 # Modify: + columna Score
│   └── ProviderDetail.tsx                # Modify: + campos nuevos, Follow-up Track condicional
├── scripts/
│   └── import-providers.ts               # Create: import CSV + backfill de los 9 existentes
└── package.json                          # Modify: + csv-parse, + script import-providers
```

---

## Task 1: Extender los tipos del dominio

**Files:**
- Modify: `lib/types.ts:4-91`

**Interfaces:**
- Produces: `ContactMethod` (nuevo tipo), `CONTACT_METHODS: ContactMethod[]`, `Status` (8
  valores), `STATUSES: Status[]` (8 valores), `Provider` con 4 campos nuevos:
  `phone: string`, `address: string`, `contactMethod: ContactMethod`, `score: number`.

- [ ] **Step 1:** En `lib/types.ts`, reemplazar el bloque `Status` (líneas 12-17) por:
      ```ts
      export type Status =
        | "Por Contactar"
        | "Contactado"
        | "En Espera de Respuesta"
        | "En Negociación"
        | "Aprobado"
        | "Rechazado"
        | "No Acepta Nuevos"
        | "Referido";

      export type ContactMethod = "Email" | "Llamada" | "Web";
      ```
- [ ] **Step 2:** En el `type Provider`, agregar los 4 campos nuevos (después de `website`):
      ```ts
      export type Provider = {
        id: string;
        company: string;
        contact: string;
        email: string;
        phone: string;
        address: string;
        category: Category;
        status: Status;
        website: string;
        contactMethod: ContactMethod;
        score: number;
        blacklisted: boolean;
        /** Fecha del primer email; base de la secuencia de follow-up. null si no se contactó aún. */
        firstContactDate: string | null;
        /** Fecha del último email enviado. */
        lastEmailDate: string | null;
        /** Índice del último email de la secuencia enviado. -1 = ningún email enviado. */
        followUpStep: number;
        notes: NoteEntry[];
        createdAt: number;
        updatedAt: number;
      };
      ```
- [ ] **Step 3:** Reemplazar el array `STATUSES` (líneas 85-91) por:
      ```ts
      export const STATUSES: Status[] = [
        "Por Contactar",
        "Contactado",
        "En Espera de Respuesta",
        "En Negociación",
        "Aprobado",
        "Rechazado",
        "No Acepta Nuevos",
        "Referido",
      ];

      export const CONTACT_METHODS: ContactMethod[] = ["Email", "Llamada", "Web"];
      ```
- [ ] **Step 4:** Verificar: `npm run build` — va a fallar en `components/ProviderForm.tsx`
      porque `ProviderFormValues` todavía no tiene los campos nuevos. Eso se corrige en la
      Task 4; por ahora confirmá que el error es justamente ese (faltan props), no algo
      inesperado.
- [ ] **Step 5:** Commit:
      ```bash
      git add lib/types.ts
      git commit -m "feat: extend Provider with phone, address, contactMethod, score; expand Status to 8 values"
      ```

---

## Task 2: Gatear el Follow-up Track por `contactMethod`

**Files:**
- Modify: `lib/followup.ts:19-26`
- Test: `lib/__tests__/followup.test.ts`

**Interfaces:**
- Consumes: `Provider.contactMethod` (Task 1).
- Produces: `nextFollowUpDate(p)` devuelve `null` si `p.contactMethod !== "Email"`, sin cambiar
  su firma. `followUpStatus` y `advanceFollowUp` no cambian (siguen dependiendo de
  `nextFollowUpDate`, así que el gateo se propaga solo).

- [ ] **Step 1:** Agregar el test que falla en `lib/__tests__/followup.test.ts`, dentro del
      `describe("nextFollowUpDate", ...)` existente:
      ```ts
      test("contactMethod distinto de Email → null aunque haya firstContactDate", () => {
        expect(
          nextFollowUpDate({ ...base, contactMethod: "Web" } as Provider),
        ).toBeNull();
      });
      test("contactMethod Email → calcula normalmente", () => {
        expect(
          nextFollowUpDate({ ...base, contactMethod: "Email" } as Provider)
            ?.toISOString()
            .slice(0, 10),
        ).toBe("2026-06-05");
      });
      ```
- [ ] **Step 2:** Run: `npm test -- followup` — el primer test nuevo debe fallar (hoy
      `nextFollowUpDate` no mira `contactMethod`, así que devuelve una fecha en vez de `null`).
- [ ] **Step 3:** En `lib/followup.ts`, modificar `nextFollowUpDate`:
      ```ts
      export function nextFollowUpDate(p: Provider): Date | null {
        if (p.contactMethod !== "Email") return null;
        if (!p.firstContactDate) return null;
        const days = FOLLOWUP_DAYS[p.followUpStep + 1];
        if (days === undefined) return null;
        const d = new Date(`${p.firstContactDate}T00:00:00.000Z`);
        d.setUTCDate(d.getUTCDate() + days);
        return d;
      }
      ```
- [ ] **Step 4:** Run: `npm test -- followup` — todos los tests (viejos y nuevos) deben pasar.
- [ ] **Step 5:** Commit:
      ```bash
      git add lib/followup.ts lib/__tests__/followup.test.ts
      git commit -m "feat: gate follow-up tracking to providers contacted by Email"
      ```

---

## Task 3: `lib/categoryInference.ts` — inferir categoría de las notas

**Files:**
- Create: `lib/categoryInference.ts`
- Test: `lib/__tests__/categoryInference.test.ts`

**Interfaces:**
- Produces: `inferCategory(notes: string): Category` — función pura, sin dependencias de
  Firebase/React. La usa `scripts/import-providers.ts` (Task 7).

- [ ] **Step 1:** Crear el test que falla, `lib/__tests__/categoryInference.test.ts`:
      ```ts
      import { describe, expect, test } from "vitest";
      import { inferCategory } from "../categoryInference";

      describe("inferCategory", () => {
        test("menciona beauty/personal care → Fragancias & Beauty", () => {
          expect(inferCategory("Beauty and Personal Care")).toBe("Fragancias & Beauty");
        });
        test("menciona perfume → Fragancias & Beauty", () => {
          expect(inferCategory("Tienda de perfume, catalogo amplio")).toBe(
            "Fragancias & Beauty",
          );
        });
        test("menciona mascotas → Pet Products", () => {
          expect(
            inferCategory("Productos de mascotas en general, tiene orden minimas de $6.000"),
          ).toBe("Pet Products");
        });
        test("menciona pescados → Pet Products", () => {
          expect(inferCategory("Productos para pescados")).toBe("Pet Products");
        });
        test("menciona toys → Entertainment & Toys", () => {
          expect(inferCategory("Toys & Games")).toBe("Entertainment & Toys");
        });
        test("menciona hogar → Home Products", () => {
          expect(inferCategory("Articulos Generales, cocina, hogar, etc")).toBe(
            "Home Products",
          );
        });
        test("sin pista clara → General Merchandise", () => {
          expect(inferCategory("Mercaderia en General")).toBe("General Merchandise");
        });
        test("notas vacías → General Merchandise", () => {
          expect(inferCategory("")).toBe("General Merchandise");
        });
      });
      ```
- [ ] **Step 2:** Run: `npm test -- categoryInference` — debe fallar (el módulo no existe
      todavía).
- [ ] **Step 3:** Crear `lib/categoryInference.ts`:
      ```ts
      import type { Category } from "./types";

      const RULES: { keywords: string[]; category: Category }[] = [
        {
          keywords: ["beauty", "perfume", "cosmetic", "fragance", "fragrance", "makeup"],
          category: "Fragancias & Beauty",
        },
        {
          keywords: ["mascota", "pet", "pescado"],
          category: "Pet Products",
        },
        {
          keywords: ["toy", "juguete", "entertainment", "games"],
          category: "Entertainment & Toys",
        },
        {
          keywords: ["hogar", "home improvement", "tools", "cocina"],
          category: "Home Products",
        },
        {
          keywords: ["personal care", "health"],
          category: "Health & Personal Care",
        },
      ];

      /**
       * Infiere la categoría de un proveedor a partir del texto libre de notas — mejor
       * esfuerzo para el import histórico (spec §5). Sin coincidencia clara: General
       * Merchandise. Revisar y corregir manualmente las que queden mal categorizadas.
       */
      export function inferCategory(notes: string): Category {
        const text = notes.toLowerCase();
        for (const rule of RULES) {
          if (rule.keywords.some((kw) => text.includes(kw))) return rule.category;
        }
        return "General Merchandise";
      }
      ```
- [ ] **Step 4:** Run: `npm test -- categoryInference` — todos los tests deben pasar.
- [ ] **Step 5:** Commit:
      ```bash
      git add lib/categoryInference.ts lib/__tests__/categoryInference.test.ts
      git commit -m "feat: add inferCategory for historical provider import"
      ```

---

## Task 4: `ProviderForm` — campos nuevos

**Files:**
- Modify: `components/ProviderForm.tsx`

**Interfaces:**
- Consumes: `CONTACT_METHODS`, `ContactMethod` (Task 1).
- Produces: `ProviderFormValues` con `phone`, `address`, `contactMethod`, `score` — usado por
  `app/admin/(crm)/proveedores/page.tsx` (sin cambios ahí, ver spec).

- [ ] **Step 1:** Actualizar el import de tipos (línea 5-12):
      ```tsx
      import {
        CATEGORIES,
        CONTACT_METHODS,
        STATUSES,
        type BlacklistEntry,
        type Category,
        type ContactMethod,
        type Provider,
        type Status,
      } from "@/lib/types";
      ```
- [ ] **Step 2:** Extender `ProviderFormValues` (línea 15-23):
      ```tsx
      export type ProviderFormValues = {
        company: string;
        contact: string;
        email: string;
        phone: string;
        address: string;
        category: Category;
        status: Status;
        contactMethod: ContactMethod;
        score: number;
        website: string;
        blacklisted: boolean;
      };
      ```
- [ ] **Step 3:** Extender `emptyValues()` (línea 32-42):
      ```tsx
      function emptyValues(): ProviderFormValues {
        return {
          company: "",
          contact: "",
          email: "",
          phone: "",
          address: "",
          category: CATEGORIES[0],
          status: STATUSES[0],
          contactMethod: CONTACT_METHODS[0],
          score: 0,
          website: "",
          blacklisted: false,
        };
      }
      ```
- [ ] **Step 4:** Extender el `setValues` del `useEffect` de sincronización (línea 65-77),
      agregando los campos nuevos al objeto que se construye desde `initial`:
      ```tsx
      setValues(
        initial
          ? {
              company: initial.company,
              contact: initial.contact,
              email: initial.email,
              phone: initial.phone,
              address: initial.address,
              category: initial.category,
              status: initial.status,
              contactMethod: initial.contactMethod,
              score: initial.score,
              website: initial.website,
              blacklisted: initial.blacklisted,
            }
          : emptyValues(),
      );
      ```
- [ ] **Step 5:** En `handleSubmit` (línea 98-104), recortar también `phone` y `address`:
      ```tsx
      await onSave({
        ...values,
        company: values.company.trim(),
        contact: values.contact.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        address: values.address.trim(),
        website: values.website.trim(),
      });
      ```
- [ ] **Step 6:** Agregar los campos al JSX. Justo después del bloque de "Contacto"/"Email"
      (después de la línea con el `</div>` que cierra esa grilla, antes del grid de
      Categoría/Estado), insertar una nueva grilla:
      ```tsx
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="phone">
            Teléfono
          </label>
          <input
            id="phone"
            className={`${inputCls} font-mono`}
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="address">
            Dirección
          </label>
          <input
            id="address"
            className={inputCls}
            value={values.address}
            onChange={(e) => set("address", e.target.value)}
          />
        </div>
      </div>
      ```
      Y, después de la grilla de Categoría/Estado existente, agregar otra para Método de
      Contacto y Score:
      ```tsx
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="contactMethod">
            Método de Contacto
          </label>
          <select
            id="contactMethod"
            className={inputCls}
            value={values.contactMethod}
            onChange={(e) => set("contactMethod", e.target.value as ContactMethod)}
          >
            {CONTACT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="score">
            Score
          </label>
          <select
            id="score"
            className={inputCls}
            value={values.score}
            onChange={(e) => set("score", Number(e.target.value))}
          >
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
      ```
- [ ] **Step 7:** Verificar: `npm run build` pasa (ya no debería quedar el error de la Task 1).
      `npm run dev`, abrir Proveedores → Nuevo proveedor, confirmar que los 4 campos nuevos
      aparecen, se completan y se guardan (revisar en Firestore o reabriendo el detalle).
- [ ] **Step 8:** Commit:
      ```bash
      git add components/ProviderForm.tsx
      git commit -m "feat: add phone, address, contactMethod and score fields to ProviderForm"
      ```

---

## Task 5: `ProviderTable` — columna Score

**Files:**
- Modify: `components/ProviderTable.tsx:54,71-79`

**Interfaces:**
- Consumes: `Provider.score` (Task 1). No cambia la firma del componente.

- [ ] **Step 1:** Agregar "Score" al array de headers (línea 54):
      ```tsx
      {["Empresa", "Contacto", "Categoría", "Estado", "Score", "Próximo"].map((h) => (
      ```
- [ ] **Step 2:** Agregar la celda correspondiente en el `<tbody>`, entre la celda de Estado y
      la de Próximo:
      ```tsx
      <td className="px-4 py-3">
        <StatusBadge status={p.status} />
      </td>
      <td className="px-4 py-3 font-mono text-xs text-ink-soft">{p.score}/5</td>
      <td className="px-4 py-3">
        <NextCell provider={p} today={today} />
      </td>
      ```
- [ ] **Step 3:** Verificar: `npm run build` pasa. `npm run dev`, abrir Proveedores, confirmar
      que la columna Score se ve con el valor de cada proveedor.
- [ ] **Step 4:** Commit:
      ```bash
      git add components/ProviderTable.tsx
      git commit -m "feat: add Score column to ProviderTable"
      ```

---

## Task 6: `ProviderDetail` — campos nuevos + Follow-up Track condicional

**Files:**
- Modify: `components/ProviderDetail.tsx:72-110`

**Interfaces:**
- Consumes: `Provider.phone`, `Provider.address`, `Provider.contactMethod`, `Provider.score`
  (Task 1); `nextFollowUpDate` ya gateado (Task 2).

- [ ] **Step 1:** Extender la grilla de "Datos de contacto" (líneas 72-96) agregando teléfono,
      método de contacto y score junto a los campos existentes:
      ```tsx
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className={labelCls}>Contacto</p>
          <p className="text-sm text-ink">{provider.contact || "—"}</p>
        </div>
        <div>
          <p className={labelCls}>Email</p>
          <p className="break-all font-mono text-sm text-ink">{provider.email}</p>
        </div>
        <div>
          <p className={labelCls}>Teléfono</p>
          <p className="font-mono text-sm text-ink">{provider.phone || "—"}</p>
        </div>
        <div>
          <p className={labelCls}>Método de Contacto</p>
          <p className="text-sm text-ink">{provider.contactMethod}</p>
        </div>
        <div>
          <p className={labelCls}>Score</p>
          <p className="font-mono text-sm text-ink">{provider.score}/5</p>
        </div>
        <div className="sm:col-span-2">
          <p className={labelCls}>Dirección</p>
          <p className="text-sm text-ink">{provider.address || "—"}</p>
        </div>
        <div className="sm:col-span-2">
          <p className={labelCls}>Website</p>
          {provider.website ? (
            <a
              href={provider.website}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all font-mono text-sm text-olive hover:underline"
            >
              {provider.website}
            </a>
          ) : (
            <p className="font-mono text-sm text-ink-soft">—</p>
          )}
        </div>
      </div>
      ```
- [ ] **Step 2:** Condicionar el bloque del Follow-up Track (líneas 98-110) a
      `contactMethod === "Email"`:
      ```tsx
      {provider.contactMethod === "Email" && (
        <div className="rounded-card border border-line bg-stone/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className={labelCls}>Secuencia de follow-up</p>
            <p className="font-mono text-xs text-ink-soft">{nextLabel(provider, today)}</p>
          </div>
          <FollowUpTrack
            followUpStep={provider.followUpStep}
            status={status}
            firstContactDate={provider.firstContactDate}
            showDates
          />
        </div>
      )}
      ```
- [ ] **Step 3:** Verificar: `npm run build` pasa. `npm run dev`, abrir un proveedor con
      `contactMethod: "Email"` (los 9 originales) y confirmar que el Follow-up Track sigue
      apareciendo; después de correr el import (Task 7), abrir uno con `contactMethod: "Web"` o
      `"Llamada"` y confirmar que el bloque del tracker no aparece.
- [ ] **Step 4:** Commit:
      ```bash
      git add components/ProviderDetail.tsx
      git commit -m "feat: show phone/address/contactMethod/score in ProviderDetail, hide follow-up track for non-email contacts"
      ```

---

## Task 7: Script de importación histórica

**Files:**
- Modify: `package.json` (agregar `csv-parse` y el script `import-providers`)
- Create: `scripts/import-providers.ts`

**Interfaces:**
- Consumes: `inferCategory` (Task 3), `Provider`, `Status`, `ContactMethod` (Task 1).
- Produces: comando `npm run import-providers [-- --dry-run]`.

- [ ] **Step 1:** Instalar el parser de CSV:
      ```bash
      npm install csv-parse
      ```
- [ ] **Step 2:** Agregar el script a `package.json`, junto a `import-expo`:
      ```json
      "import-providers": "tsx scripts/import-providers.ts"
      ```
- [ ] **Step 3:** Crear `scripts/import-providers.ts`:
      ```ts
      /**
       * Import histórico de proveedores desde el CSV de la planilla de Nico a la colección
       * `providers`, más backfill de los proveedores ya seedeados con los campos nuevos
       * (contactMethod/phone/address/score) que no tenían. Ver spec
       * docs/superpowers/specs/2026-06-29-crm-provider-model-v2-design.md.
       *
       * - Filas con Status "Estafa" → van a `blacklist`, no a `providers`.
       * - Filas que ya existen como proveedores activos de la Fase 1 (mismo nombre
       *   normalizado) → se saltan, no se sobreescriben (ver SKIP_SLUGS).
       * - "Miami Trading Zone" se trata como estafa: no se importa a providers (sigue en
       *   blacklist, como ya está desde la Fase 1).
       *
       * Uso:
       *   npm run import-providers -- --dry-run   (solo parsea y reporta, no escribe)
       *   npm run import-providers                (escribe; necesita SEED_USER_PASSWORD)
       */
      import { readFileSync } from "node:fs";
      import "./env";
      import { parse } from "csv-parse/sync";
      import { signInWithEmailAndPassword } from "firebase/auth";
      import {
        collection,
        doc,
        getCountFromServer,
        getDocs,
        updateDoc,
        writeBatch,
      } from "firebase/firestore";
      import { auth, db } from "../lib/firebase";
      import { inferCategory } from "../lib/categoryInference";
      import type { ContactMethod, Provider, Status } from "../lib/types";

      const CSV_PATH =
        "C:/Nico-Archivos/ClaudeCode/Ranic-Group/Base de Datos PROVEEDORES - BASE DE DATOS.csv";

      // Ya existen como proveedores activos de la Fase 1 — no se pisan (ver Global Constraints
      // del plan). "miami-trading-zone" se trata como estafa: sigue solo en blacklist.
      const SKIP_SLUGS = new Set([
        "fragrancex",
        "ee-distribution",
        "tps-wholesale",
        "bd-distributors",
        "miami-trading-zone",
      ]);

      const STATUS_MAP: Record<string, Status> = {
        Aprobado: "Aprobado",
        "En Espera de Respuesta": "En Espera de Respuesta",
        Rechazado: "Rechazado",
        "No Acepta Nuevos": "No Acepta Nuevos",
        "Por Contactar": "Por Contactar",
        Referido: "Referido",
      };

      const METHOD_MAP: Record<string, ContactMethod> = {
        Email: "Email",
        Llamada: "Llamada",
        Web: "Web",
      };

      type Row = Record<string, string>;

      function slug(name: string): string {
        return name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
      }

      function clean(value: string | undefined): string {
        const v = (value ?? "").trim();
        if (!v || v === "Desconocido" || /^-+$/.test(v)) return "";
        return v;
      }

      /** "15/1/26" → "2026-01-15". null si no matchea el formato esperado. */
      function parseSpanishDate(value: string): string | null {
        const m = clean(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
        if (!m) return null;
        const [, d, mo, y] = m;
        return `20${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }

      type ParsedProvider = Omit<Provider, "id" | "createdAt" | "updatedAt">;

      function parseRows(): {
        providers: Map<string, ParsedProvider>;
        blacklist: string[];
        skipped: string[];
      } {
        const csv = readFileSync(CSV_PATH, "utf8");
        const rows: Row[] = parse(csv, { columns: true, skip_empty_lines: true });

        const providers = new Map<string, ParsedProvider>();
        const blacklist: string[] = [];
        const skipped: string[] = [];

        for (const row of rows) {
          const company = clean(row["Nombre de Proveedor"]);
          if (!company) continue; // filas vacías de relleno del CSV

          const key = slug(company);
          const statusRaw = clean(row["Status"]);

          if (statusRaw === "Estafa") {
            blacklist.push(company);
            continue;
          }
          if (SKIP_SLUGS.has(key)) {
            skipped.push(company);
            continue;
          }

          const contactDate = parseSpanishDate(row["Fecha de Contacto"]);
          const notes = clean(row["Notas"]);
          const method = METHOD_MAP[clean(row["Método de Contacto"])] ?? "Web";
          const status = STATUS_MAP[statusRaw] ?? "Por Contactar";
          const scoreNum = Number(clean(row["Score"]));

          providers.set(key, {
            company,
            contact: clean(row["Persona de Contacto"]),
            email: clean(row["Email"]),
            category: inferCategory(notes),
            status,
            website: clean(row["Web"]),
            blacklisted: false,
            phone: clean(row["Teléfono"]),
            address: clean(row["Dirección"]),
            contactMethod: method,
            score: Number.isFinite(scoreNum) ? scoreNum : 0,
            firstContactDate: contactDate,
            lastEmailDate: contactDate,
            followUpStep: -1,
            notes: notes && contactDate ? [{ date: contactDate, text: notes }] : [],
          });
        }

        return { providers, blacklist, skipped };
      }

      /** Patchea los proveedores existentes que todavía no tienen los campos nuevos. */
      async function backfillExisting(): Promise<number> {
        const snap = await getDocs(collection(db, "providers"));
        let patched = 0;
        for (const d of snap.docs) {
          const data = d.data();
          if (data.contactMethod !== undefined) continue; // ya migrado, no tocar
          await updateDoc(doc(db, "providers", d.id), {
            contactMethod: "Email",
            phone: "",
            address: "",
            score: 0,
            updatedAt: Date.now(),
          });
          patched++;
        }
        return patched;
      }

      async function main() {
        const dryRun = process.argv.includes("--dry-run");
        const { providers, blacklist, skipped } = parseRows();

        console.log(`\nProveedores a importar: ${providers.size}`);
        console.log(`Saltados por ya existir: ${skipped.length} (${skipped.join(", ")})`);
        console.log(`Nuevas entradas de blacklist (Estafa): ${blacklist.length}`);

        if (dryRun) {
          console.log("\n(--dry-run) No se escribió nada en Firestore.");
          process.exit(0);
        }

        const password = process.env.SEED_USER_PASSWORD;
        if (!password) {
          console.error(
            "\n✗ Falta SEED_USER_PASSWORD en .env.local (o usá --dry-run para solo contar).\n",
          );
          process.exit(1);
        }
        const email = process.env.SEED_USER_EMAIL ?? "nicolas.conti@ranicgroup.com";
        await signInWithEmailAndPassword(auth, email, password);

        const patched = await backfillExisting();
        console.log(`\n✓ Backfill: ${patched} proveedores existentes actualizados.`);

        const now = Date.now();
        const CHUNK = 50;
        const entries = [...providers];
        for (let i = 0; i < entries.length; i += CHUNK) {
          const batch = writeBatch(db);
          for (const [key, p] of entries.slice(i, i + CHUNK)) {
            batch.set(doc(db, "providers", key), {
              ...p,
              createdAt: now,
              updatedAt: now,
            });
          }
          await batch.commit();
        }

        if (blacklist.length > 0) {
          const bBatch = writeBatch(db);
          for (const name of blacklist) {
            bBatch.set(doc(db, "blacklist", slug(name)), { name });
          }
          await bBatch.commit();
        }

        const providersCount = (
          await getCountFromServer(collection(db, "providers"))
        ).data().count;
        const blacklistCount = (
          await getCountFromServer(collection(db, "blacklist"))
        ).data().count;

        console.log(`\n✓ Import completo.`);
        console.log(`  providers:  ${providersCount}`);
        console.log(`  blacklist:  ${blacklistCount}`);
        process.exit(0);
      }

      main().catch((err) => {
        console.error("✗ Error en el import:", err?.code ?? err);
        process.exit(1);
      });
      ```
- [ ] **Step 4:** Verificar con dry-run: `npm run import-providers -- --dry-run`. Esperado en la
      consola: "Proveedores a importar" cercano a 71 (77 filas del CSV, menos 1 Estafa, menos 5
      saltadas: las 4 duplicadas + Miami Trading Zone), "Nuevas entradas de blacklist (Estafa):
      1". Si el número de proveedores a importar no rondara ese valor, revisar el CSV antes de
      seguir — no asumir que está bien.
- [ ] **Step 5:** Correr el import real: `npm run import-providers`. Esperado: "Backfill: 9
      proveedores existentes actualizados" (la primera vez) y los contadores finales de
      `providers`/`blacklist` reflejando lo importado.
- [ ] **Step 6:** Verificar en el CRM (`npm run dev`, `/admin/proveedores`): los proveedores
      nuevos aparecen, con categoría/score/método de contacto cargados; los 9 originales siguen
      con sus datos de Fase 1 intactos (no se pisaron); abrir "AJ-Globals" en
      `/admin/blacklist` y confirmar que está ahí, no en proveedores.
- [ ] **Step 7:** Commit:
      ```bash
      git add package.json package-lock.json scripts/import-providers.ts
      git commit -m "feat: add historical provider import script with backfill"
      ```

---

## Task 8: Verificación final y PR

- [ ] **Step 1:** `npm run build` y `npm test` — ambos pasan sin errores.
- [ ] **Step 2:** `npm run dev`, revisar manualmente:
      - Dashboard: las métricas y alertas de follow-up no incluyen proveedores con
        `contactMethod` distinto de `Email`.
      - Proveedores: tabla con columna Score; abrir/crear/editar un proveedor con los 4 campos
        nuevos; el aviso de blacklist sigue funcionando al escribir un nombre que matchea.
      - Follow-ups: la lista solo muestra proveedores con `contactMethod === "Email"`.
      - Abrir el detalle de un proveedor importado por Web/Llamada: no aparece el bloque de
        Follow-up Track.
  - [ ] **Step 3:** Push del branch y PR a `main`:
        ```bash
        git push -u origin crm-proveedores-v2
        gh pr create --title "CRM: modelo de proveedores v2 + import histórico" --body "Ver docs/superpowers/specs/2026-06-29-crm-provider-model-v2-design.md y el plan correspondiente."
        ```
- [ ] **Step 4:** Esperar a que el preview de Vercel pase el build, avisar para revisión — no
      mergear sin aprobación explícita.

---

## Self-Review (cobertura del spec)

- Campos nuevos (`phone`, `address`, `contactMethod`, `score`) → Task 1, 4, 5, 6. ✅
- 8 estados, `Estafa` resuelto vía blacklist sin cambios → Task 1. ✅
- Follow-up Track condicionado a `contactMethod === "Email"` → Task 2, 6, 8. ✅
- Import del CSV con todas las reglas de mapeo (fechas, placeholders, categoría inferida,
  Método de Contacto vacío → Web, Estafa → blacklist) → Task 3, 7. ✅
- Los 4 duplicados y "Miami Trading Zone" no se importan/pisan (decisión tomada en la
  conversación de brainstorming del 2026-06-29, no estaba en la primera versión del spec) →
  Task 7 (`SKIP_SLUGS`), Global Constraints. ✅
- Backfill de los 9 proveedores existentes, sin pisar ediciones manuales futuras (chequea
  `contactMethod !== undefined` antes de patchear) → Task 7. ✅
- Cambios de UI (`ProviderForm`, `ProviderTable`, `ProviderDetail`) → Tasks 4, 5, 6. ✅
- No se toca el sitio público ni se expande `BlacklistEntry` → Global Constraints, ningún task
  los modifica. ✅
