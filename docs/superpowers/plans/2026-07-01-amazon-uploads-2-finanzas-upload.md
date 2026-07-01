# Amazon Uploads — Plan 2: Upload de Finanzas (liquidaciones)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subir el informe de liquidación V2 desde la página de Finanzas: parseo en el navegador, preview con reconciliación, detección de duplicados por `settlement-id`, y escritura (o reemplazo) de 2 movimientos + N ventas por SKU en Firestore.

**Architecture:** La construcción de documentos es una función pura testeable (`lib/settlementDocs.ts`) que se apoya en `parseSettlement` (Plan 1). Un wrapper de IO (`lib/importWrite.ts`) hace el getDocs/dedup/writeBatch. La UI reutiliza `components/Modal.tsx` a través de un `ImportDialog` genérico (que Plan 3 reusará para Stock).

**Tech Stack:** Next.js (App Router, client component), TypeScript, Tailwind CSS v4, Firebase Firestore Web SDK, Vitest.

**Depende de:** Plan 1 mergeado (PR #14). Usa `parseSettlement`, `SettlementParseResult`, `SkuSaleAgg`, `AmazonSkuSale`, los campos `importSource`/`importPeriod` y la categoría `"Comisión Amazon"`.

**Spec:** `docs/superpowers/specs/2026-07-01-amazon-report-uploads-design.md` (§4, §6, §7, §8).

## Global Constraints

- Idioma UI: español.
- Firebase Web SDK únicamente. Firestore rechaza `undefined`: no escribir campos opcionales vacíos.
- `Transaction.amount` siempre positivo; el signo lo da `type`.
- Los 2 movimientos por liquidación llevan `payer: "Amazon"`, `method: "Amazon Seller"`,
  `importSource: "amazon-settlement"`, `importPeriod: <settlement-id>`, `date: <deposit-date>`.
- El reemplazo borra SOLO documentos con `importPeriod`/`settlementId` igual al de la liquidación;
  nunca toca los cargados a mano (sin `importSource`).
- No se importa nada si `result.reconciles === false`.
- Reusar `components/Modal.tsx`, tokens `olive`/`stone`/`ink`/`line`/`status-*`, `rounded-card`,
  `rounded-control`, `font-eyebrow`. Helpers de fecha en `lib/format.ts` (`formatDate`, `formatShort`).
- Commit al final de cada tarea.

---

### Task 1: `lib/settlementDocs.ts` — builder puro de documentos

**Files:**
- Create: `lib/settlementDocs.ts`
- Create: `lib/__tests__/settlementDocs.test.ts`

**Interfaces:**
- Consumes: `SettlementParseResult` de `lib/parseSettlement.ts`; `Transaction`, `AmazonSkuSale`
  de `lib/types.ts`; `formatShort` de `lib/format.ts`.
- Produces:
  ```ts
  export type TransactionDoc = Omit<Transaction, "id">;
  export type SkuSaleDoc = Omit<AmazonSkuSale, "id">;
  export function buildSettlementDocs(
    result: SettlementParseResult,
    productNameBySku: Map<string, string>,
    now: number,
  ): { transactions: TransactionDoc[]; skuSales: SkuSaleDoc[] };
  ```

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/__tests__/settlementDocs.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import type { SettlementParseResult } from "../parseSettlement";
import { buildSettlementDocs } from "../settlementDocs";

const result: SettlementParseResult = {
  settlementId: "S1",
  periodStart: "2026-06-10",
  periodEnd: "2026-06-24",
  depositDate: "2026-06-26",
  totalAmount: 100,
  ventas: 300,
  gastos: 200,
  skuSales: [
    { sku: "FRONTIER-CELERY-30", unitsSold: 5, ventas: 40, gastosAmazon: 15, neto: 25 },
    { sku: "UNKNOWN-SKU", unitsSold: 2, ventas: 20, gastosAmazon: 8, neto: 12 },
  ],
  reconciles: true,
};

describe("buildSettlementDocs", () => {
  const names = new Map([["FRONTIER-CELERY-30", "Frontier Celery Seed"]]);
  const { transactions, skuSales } = buildSettlementDocs(result, names, 1000);

  test("crea 2 movimientos etiquetados con el settlement-id", () => {
    expect(transactions).toHaveLength(2);
    const ingreso = transactions.find((t) => t.type === "Ingreso")!;
    const egreso = transactions.find((t) => t.type === "Egreso")!;
    expect(ingreso.amount).toBe(300);
    expect(ingreso.incomeSource).toBe("Venta");
    expect(ingreso.date).toBe("2026-06-26");
    expect(ingreso.importPeriod).toBe("S1");
    expect(egreso.amount).toBe(200);
    expect(egreso.expenseCategory).toBe("Comisión Amazon");
    expect(egreso.importSource).toBe("amazon-settlement");
  });

  test("neto de los 2 movimientos = total depositado", () => {
    const ingreso = transactions.find((t) => t.type === "Ingreso")!;
    const egreso = transactions.find((t) => t.type === "Egreso")!;
    expect(ingreso.amount - egreso.amount).toBe(100);
  });

  test("resuelve productName desde stock; '' si no hay match", () => {
    expect(skuSales).toHaveLength(2);
    expect(skuSales[0].productName).toBe("Frontier Celery Seed");
    expect(skuSales[1].productName).toBe("");
    expect(skuSales[0].settlementId).toBe("S1");
    expect(skuSales[0].importSource).toBe("amazon-settlement");
  });

  test("omite un movimiento si su monto es 0", () => {
    const zero = buildSettlementDocs({ ...result, gastos: 0 }, names, 1000);
    expect(zero.transactions).toHaveLength(1);
    expect(zero.transactions[0].type).toBe("Ingreso");
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -- settlementDocs`
Expected: FAIL — `Cannot find module '../settlementDocs'`.

- [ ] **Step 3: Implementar `lib/settlementDocs.ts`**

```ts
import { formatShort } from "./format";
import type { SettlementParseResult } from "./parseSettlement";
import type { AmazonSkuSale, Transaction } from "./types";

export type TransactionDoc = Omit<Transaction, "id">;
export type SkuSaleDoc = Omit<AmazonSkuSale, "id">;

/**
 * Convierte el resultado del parser en los documentos a escribir: 2 movimientos
 * (Ventas / Gastos Amazon) + una fila de venta por SKU. Función pura (sin Firebase).
 */
export function buildSettlementDocs(
  result: SettlementParseResult,
  productNameBySku: Map<string, string>,
  now: number,
): { transactions: TransactionDoc[]; skuSales: SkuSaleDoc[] } {
  const period = `${formatShort(result.periodStart)}–${formatShort(result.periodEnd)}`;

  const transactions: TransactionDoc[] = [];

  if (result.ventas > 0) {
    transactions.push({
      date: result.depositDate,
      type: "Ingreso",
      description: `Ventas Amazon (liq. ${period})`,
      amount: result.ventas,
      payer: "Amazon",
      method: "Amazon Seller",
      incomeSource: "Venta",
      expenseCategory: null,
      importSource: "amazon-settlement",
      importPeriod: result.settlementId,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (result.gastos > 0) {
    transactions.push({
      date: result.depositDate,
      type: "Egreso",
      description: `Gastos Amazon (liq. ${period})`,
      amount: result.gastos,
      payer: "Amazon",
      method: "Amazon Seller",
      incomeSource: null,
      expenseCategory: "Comisión Amazon",
      importSource: "amazon-settlement",
      importPeriod: result.settlementId,
      createdAt: now,
      updatedAt: now,
    });
  }

  const skuSales: SkuSaleDoc[] = result.skuSales.map((s) => ({
    settlementId: result.settlementId,
    periodStart: result.periodStart,
    periodEnd: result.periodEnd,
    depositDate: result.depositDate,
    sku: s.sku,
    productName: productNameBySku.get(s.sku) ?? "",
    unitsSold: s.unitsSold,
    ventas: s.ventas,
    gastosAmazon: s.gastosAmazon,
    neto: s.neto,
    importSource: "amazon-settlement",
    createdAt: now,
  }));

  return { transactions, skuSales };
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npm test -- settlementDocs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/settlementDocs.ts lib/__tests__/settlementDocs.test.ts
git commit -m "feat: add pure builder for settlement transactions and per-SKU docs"
```

---

### Task 2: `lib/importWrite.ts` — escritura y reemplazo en Firestore

**Files:**
- Create: `lib/importWrite.ts`

**Interfaces:**
- Consumes: `buildSettlementDocs` de `lib/settlementDocs.ts`; `SettlementParseResult` de
  `lib/parseSettlement.ts`; `StockItem` de `lib/types.ts`; `db` de `lib/firebase.ts`.
- Produces:
  ```ts
  export function settlementExists(settlementId: string): Promise<boolean>;
  export function importSettlement(result: SettlementParseResult, replace: boolean): Promise<void>;
  ```

> No lleva test unitario (toca Firestore). Se verifica con `tsc` y en el preview de dev (Task 5).
> La lógica testeable ya está aislada en `buildSettlementDocs` (Task 1).

- [ ] **Step 1: Implementar `lib/importWrite.ts`**

```ts
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import type { SettlementParseResult } from "./parseSettlement";
import { buildSettlementDocs } from "./settlementDocs";
import type { StockItem } from "./types";

const TX = "transactions";
const SKU = "amazonSkuSales";
const STOCK = "stockItems";

/** ¿Ya existe una liquidación importada con este settlement-id? */
export async function settlementExists(settlementId: string): Promise<boolean> {
  const snap = await getDocs(
    query(collection(db, TX), where("importPeriod", "==", settlementId)),
  );
  return !snap.empty;
}

/** Nombre de producto por SKU, tomado del snapshot de stock más reciente. */
async function productNameBySku(): Promise<Map<string, string>> {
  const snap = await getDocs(collection(db, STOCK));
  const latest = new Map<string, { date: string; name: string }>();
  snap.forEach((d) => {
    const it = d.data() as StockItem;
    const prev = latest.get(it.sku);
    if (!prev || it.snapshotDate > prev.date) {
      latest.set(it.sku, { date: it.snapshotDate, name: it.productName });
    }
  });
  const map = new Map<string, string>();
  for (const [sku, v] of latest) map.set(sku, v.name);
  return map;
}

/**
 * Escribe (o reemplaza) una liquidación: 2 movimientos + N ventas por SKU, en un solo batch.
 * Si `replace`, borra primero los documentos existentes de esa liquidación.
 */
export async function importSettlement(
  result: SettlementParseResult,
  replace: boolean,
): Promise<void> {
  const names = await productNameBySku();

  const toDelete: Parameters<ReturnType<typeof writeBatch>["delete"]>[0][] = [];
  if (replace) {
    const txSnap = await getDocs(
      query(collection(db, TX), where("importPeriod", "==", result.settlementId)),
    );
    const skuSnap = await getDocs(
      query(collection(db, SKU), where("settlementId", "==", result.settlementId)),
    );
    txSnap.forEach((d) => toDelete.push(d.ref));
    skuSnap.forEach((d) => toDelete.push(d.ref));
  }

  const now = Date.now();
  const { transactions, skuSales } = buildSettlementDocs(result, names, now);

  const batch = writeBatch(db);
  for (const ref of toDelete) batch.delete(ref);
  for (const t of transactions) batch.set(doc(collection(db, TX)), t);
  for (const s of skuSales) batch.set(doc(collection(db, SKU)), s);
  await batch.commit();
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add lib/importWrite.ts
git commit -m "feat: add Firestore write/replace for settlement imports"
```

---

### Task 3: `components/ImportDialog.tsx` — diálogo de import genérico

Diálogo reutilizable (Finanzas ahora, Stock en Plan 3). Recibe el parser y los renderers por
props; no conoce los detalles de cada archivo.

**Files:**
- Create: `components/ImportDialog.tsx`

**Interfaces:**
- Consumes: `Modal` de `./Modal`.
- Produces:
  ```ts
  export function ImportDialog<T>(props: {
    open: boolean;
    onClose: () => void;
    title: string;
    accept: string;
    parse: (text: string) => T;
    renderPreview: (parsed: T) => ReactNode;
    canConfirm: (parsed: T) => boolean;
    checkDuplicate: (parsed: T) => Promise<boolean>;
    onConfirm: (parsed: T, replace: boolean) => Promise<void>;
  }): JSX.Element;
  ```

- [ ] **Step 1: Implementar `components/ImportDialog.tsx`**

```tsx
"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "./Modal";

type Phase = "idle" | "preview" | "writing" | "done";

export function ImportDialog<T>({
  open,
  onClose,
  title,
  accept,
  parse,
  renderPreview,
  canConfirm,
  checkDuplicate,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  accept: string;
  parse: (text: string) => T;
  renderPreview: (parsed: T) => ReactNode;
  canConfirm: (parsed: T) => boolean;
  checkDuplicate: (parsed: T) => Promise<boolean>;
  onConfirm: (parsed: T, replace: boolean) => Promise<void>;
}) {
  const [parsed, setParsed] = useState<T | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [replace, setReplace] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");

  function reset() {
    setParsed(null);
    setDuplicate(false);
    setReplace(false);
    setError(null);
    setPhase("idle");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFile(file: File) {
    setError(null);
    try {
      const text = await file.text();
      const result = parse(text);
      setParsed(result);
      setPhase("preview");
      setDuplicate(await checkDuplicate(result));
    } catch {
      setParsed(null);
      setPhase("idle");
      setError("No se pudo leer el archivo. ¿Es el informe correcto?");
    }
  }

  async function handleConfirm() {
    if (!parsed) return;
    setPhase("writing");
    setError(null);
    try {
      await onConfirm(parsed, replace);
      setPhase("done");
    } catch {
      setPhase("preview");
      setError("No se pudo guardar. Probá de nuevo.");
    }
  }

  const confirmDisabled =
    !parsed || !canConfirm(parsed) || (duplicate && !replace) || phase === "writing";

  return (
    <Modal open={open} onClose={handleClose} title={title}>
      {phase === "done" ? (
        <div className="space-y-4">
          <p className="text-sm text-ink">✓ Importación completa.</p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-control bg-olive px-4 py-2 text-sm font-medium text-stone transition-colors hover:bg-olive-deep"
            >
              Listo
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <input
            type="file"
            accept={accept}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
            className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-control file:border-0 file:bg-olive file:px-3 file:py-2 file:text-sm file:font-medium file:text-stone hover:file:bg-olive-deep"
          />

          {error && <p className="text-sm text-status-overdue">{error}</p>}

          {parsed && (
            <>
              <div className="rounded-card border border-line bg-surface p-4 text-sm">
                {renderPreview(parsed)}
              </div>

              {!canConfirm(parsed) && (
                <p className="text-sm text-status-overdue">
                  Los números no reconcilian con el total del archivo. No se puede importar.
                </p>
              )}

              {duplicate && (
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={replace}
                    onChange={(e) => setReplace(e.target.checked)}
                  />
                  Ya está importado. Reemplazar lo anterior.
                </label>
              )}

              <div className="flex justify-end gap-2 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-control px-4 py-2 text-sm text-ink-soft hover:text-ink"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={confirmDisabled}
                  className="rounded-control bg-olive px-4 py-2 text-sm font-medium text-stone transition-colors hover:bg-olive-deep disabled:opacity-60"
                >
                  {phase === "writing" ? "Importando…" : "Confirmar importación"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/ImportDialog.tsx
git commit -m "feat: add generic ImportDialog with preview and duplicate handling"
```

---

### Task 4: Cablear el upload en la página de Finanzas

**Files:**
- Modify: `app/admin/(crm)/finanzas/page.tsx`

**Interfaces:**
- Consumes: `ImportDialog` de `@/components/ImportDialog`; `parseSettlement`,
  `type SettlementParseResult` de `@/lib/parseSettlement`; `settlementExists`,
  `importSettlement` de `@/lib/importWrite`; `formatDate`, `formatShort` de `@/lib/format`.

- [ ] **Step 1: Agregar imports**

En `app/admin/(crm)/finanzas/page.tsx`, junto a los imports existentes, agregar:

```ts
import { ImportDialog } from "@/components/ImportDialog";
import { formatDate, formatShort } from "@/lib/format";
import {
  parseSettlement,
  type SettlementParseResult,
} from "@/lib/parseSettlement";
import { importSettlement, settlementExists } from "@/lib/importWrite";
```

- [ ] **Step 2: Agregar el renderer de preview (fuera del componente `FinanzasPage`)**

Al final del archivo, después del cierre de `FinanzasPage`, agregar:

```tsx
function SettlementPreview({ r }: { r: SettlementParseResult }) {
  const neto = Math.round((r.ventas - r.gastos) * 100) / 100;
  return (
    <div className="space-y-1">
      <p className="font-medium text-ink">
        Liquidación {formatShort(r.periodStart)}–{formatDate(r.periodEnd)} · depósito{" "}
        {formatDate(r.depositDate)}
      </p>
      <div className="flex justify-between">
        <span className="text-ink-soft">Ventas Amazon</span>
        <span className="font-mono text-status-ontrack">+${r.ventas.toFixed(2)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-ink-soft">Gastos Amazon</span>
        <span className="font-mono text-status-overdue">−${r.gastos.toFixed(2)}</span>
      </div>
      <div className="flex justify-between border-t border-line pt-1 font-medium text-ink">
        <span>Neto</span>
        <span className="font-mono">
          ${neto.toFixed(2)} {r.reconciles ? "✓" : "⚠"}
        </span>
      </div>
      <p className="text-ink-soft">
        {r.skuSales.length} productos · liquidación {r.settlementId}
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Agregar estado del diálogo dentro de `FinanzasPage`**

Después de `const [editId, setEditId] = useState<string | null>(null);` agregar:

```ts
  const [importOpen, setImportOpen] = useState(false);
```

- [ ] **Step 4: Agregar el botón "Subir informe" en el header**

Reemplazar el prop `actions` del `<PageHeader>` (el que hoy tiene solo el botón "Nuevo
movimiento") por:

```tsx
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="rounded-control border border-olive px-3 py-2 text-sm font-medium text-olive transition-colors hover:bg-olive hover:text-stone"
            >
              Subir informe
            </button>
            <button
              type="button"
              onClick={openNew}
              className="rounded-control bg-olive px-3 py-2 text-sm font-medium text-stone transition-colors hover:bg-olive-deep"
            >
              Nuevo movimiento
            </button>
          </div>
        }
```

- [ ] **Step 5: Montar el `ImportDialog`**

Justo antes del cierre `</>` del `return` (después del `<TransactionForm ... />`), agregar:

```tsx
      <ImportDialog<SettlementParseResult>
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Subir informe de liquidación (Amazon)"
        accept=".txt"
        parse={parseSettlement}
        renderPreview={(r) => <SettlementPreview r={r} />}
        canConfirm={(r) => r.reconciles}
        checkDuplicate={(r) => settlementExists(r.settlementId)}
        onConfirm={(r, replace) => importSettlement(r, replace)}
      />
```

- [ ] **Step 6: Verificar tipos y build**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npm run build`
Expected: build verde.

- [ ] **Step 7: Commit**

```bash
git add "app/admin/(crm)/finanzas/page.tsx"
git commit -m "feat: add settlement report upload to Finanzas page"
```

---

### Task 5: Verificación en preview (sin escribir en producción)

Verificar el parseo y el preview end-to-end en dev, **sin** confirmar la importación (para no
escribir en la Firestore compartida antes de que Nico haga el rollout real).

**Files:** ninguno (verificación).

- [ ] **Step 1: Levantar el dev server**

Run: `npm run dev` → abrir `http://localhost:3000/admin/finanzas` (con login).

- [ ] **Step 2: Abrir el diálogo y subir el archivo de ejemplo**

Click en "Subir informe" → seleccionar `C:\Nico-Archivos\ClaudeCode\Ranic-Group\50038020628.txt`.

Verificar en el preview:
- [ ] Muestra "Liquidación 10/06–24/06/2026 · depósito 26/06/2026".
- [ ] Ventas Amazon en verde, Gastos Amazon en rojo.
- [ ] Neto = **$216.18** con el tilde ✓ (reconcilia).
- [ ] "… productos · liquidación 26688578961".
- [ ] El botón "Confirmar importación" está habilitado.

- [ ] **Step 3: Probar el rechazo por archivo equivocado**

Subir cualquier `.csv` que no sea el informe (ej. el de inventario). Verificar que muestra el
error "No se pudo leer el archivo…" y NO habilita confirmar.

- [ ] **Step 4: Cerrar sin confirmar**

Cerrar el diálogo con "Cancelar" — no se escribió nada en Firestore.

- [ ] **Step 5: Commit (si hubo ajustes) o continuar**

Si algún ajuste fino de UI fue necesario, commitear:

```bash
git add -A
git commit -m "fix: settlement upload preview polish"
```

---

## Rollout operativo (lo dispara Nico, después de mergear este plan)

Estos pasos escriben en la Firestore de producción; NO son parte de la implementación
automatizada. Orden:

1. **Migración:** `npm run migrate-remove-monthly-amazon` (sin `--dry-run`) → borra los 9
   movimientos mensuales viejos. Confirmar antes que el dry-run siga listando 9.
2. **Importar liquidaciones:** desde `/admin/finanzas` → "Subir informe", subir cada `.txt` de
   liquidación (una por una). Confirmar cuando el preview muestre ✓.
3. **Reconciliar (spec §10):** la suma de netos de todas las liquidaciones = suma de "Importe del
   pago" de la tabla "Todos los extractos" de Amazon (~$1.017 + lo pendiente). Verificar también
   que "Egresos por categoría" muestre "Comisión Amazon" con el total correcto.

---

## Self-Review

**Spec coverage (Plan 2 cubre §4.2, §4.3-escritura, §6, §7-Finanzas, §8, §9-ejecución, §10):**
- §4.2 dos movimientos por liquidación → Task 1/4 ✓
- §4.3 escritura de `amazonSkuSales` con productName resuelto → Task 1/2 ✓
- §6 UI de upload compartida (`ImportDialog`) → Task 3 ✓
- §7 preview de Finanzas → Task 4 (`SettlementPreview`) ✓
- §8 dedup por `settlement-id`, reemplazo, rechazo por reconciliación/formato → Task 2/3 ✓
- §9 correr la migración → Rollout operativo (Nico) ✓
- §10 reconciliación → Task 5 (preview) + Rollout operativo ✓
- §11 rentabilidad por producto (lectura/tabla) y §7-Stock upload → **Plan 3**.

**Placeholder scan:** sin TBD/TODO; todo el código completo.

**Type consistency:** `SettlementParseResult`/`SkuSaleAgg` (Plan 1) usados igual en Task 1/4;
`TransactionDoc`/`SkuSaleDoc` definidos en Task 1 y consumidos en Task 2; `ImportDialog<T>`
genérico instanciado con `SettlementParseResult` en Task 4. `importPeriod` (transactions) vs
`settlementId` (amazonSkuSales) usados de forma consistente en el dedup de Task 2.
