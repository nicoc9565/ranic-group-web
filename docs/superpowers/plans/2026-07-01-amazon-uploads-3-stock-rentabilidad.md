# Amazon Uploads — Plan 3: Stock upload + rentabilidad por producto

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subir el CSV de inventario FBA desde la página de Stock (reutilizando el `ImportDialog`), y agregar una vista de rentabilidad por producto que cruza las ventas por SKU (`amazonSkuSales`) con filtro por liquidación.

**Architecture:** La agregación por SKU es una función pura testeable (`lib/profitability.ts`) sobre los documentos `amazonSkuSales` que ya escribe el Plan 2. La escritura de inventario se suma a `lib/importWrite.ts` con el mismo patrón de dedup+batch. La UI reutiliza `ImportDialog` (Plan 2) y `subscribeAmazonSkuSales` para leer en tiempo real.

**Tech Stack:** Next.js (App Router, client component), TypeScript, Tailwind CSS v4, Firebase Firestore Web SDK, Vitest.

**Depende de:** Plan 1 y Plan 2 mergeados. Usa `ImportDialog`, `parseInventoryCsv`/`ParsedStockItem`, la colección `amazonSkuSales`, el tipo `AmazonSkuSale`, y los campos `importSource`/`importPeriod` de `StockItem`.

**Spec:** `docs/superpowers/specs/2026-07-01-amazon-report-uploads-design.md` (§4.4, §7 Stock, §11).

## Global Constraints

- Idioma UI: español.
- Firebase Web SDK únicamente. Firestore rechaza `undefined`: no escribir campos opcionales vacíos.
- Los `stockItems` importados llevan `importSource: "amazon-inventory"`, `importPeriod: <snapshotDate>`.
- Reemplazar un snapshot borra TODOS los `stockItems` con esa `snapshotDate` (el inventario es un
  corte completo; no hay stock cargado a mano) y escribe los nuevos.
- La rentabilidad se calcula solo desde `amazonSkuSales`; nunca modifica esos datos.
- Reusar `ImportDialog`, `MetricCard`, tokens `olive`/`status-*`, `rounded-card`, `formatDate`/`formatShort`.
- Commit al final de cada tarea.

---

### Task 1: `lib/amazonSkuSales.ts` — suscripción a las ventas por SKU

**Files:**
- Create: `lib/amazonSkuSales.ts`

**Interfaces:**
- Consumes: `AmazonSkuSale` de `lib/types.ts`; `db` de `lib/firebase.ts`.
- Produces: `subscribeAmazonSkuSales(cb: (sales: AmazonSkuSale[]) => void): () => void`.

> Sin test unitario (toca Firestore); mismo patrón exacto que `lib/stock.ts`. Se verifica con `tsc`.

- [ ] **Step 1: Implementar `lib/amazonSkuSales.ts`**

```ts
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import type { AmazonSkuSale } from "./types";

const COL = "amazonSkuSales";

/** Suscripción en tiempo real a las ventas de Amazon por SKU. Devuelve el unsubscribe. */
export function subscribeAmazonSkuSales(
  cb: (sales: AmazonSkuSale[]) => void,
): () => void {
  return onSnapshot(collection(db, COL), (snap) => {
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<AmazonSkuSale, "id">),
      })),
    );
  });
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add lib/amazonSkuSales.ts
git commit -m "feat: add amazonSkuSales subscription"
```

---

### Task 2: `lib/profitability.ts` — agregación por SKU (pura)

**Files:**
- Create: `lib/profitability.ts`
- Create: `lib/__tests__/profitability.test.ts`

**Interfaces:**
- Consumes: `AmazonSkuSale` de `lib/types.ts`.
- Produces:
  ```ts
  export type ProfitRow = {
    sku: string; productName: string; unitsSold: number;
    ventas: number; gastosAmazon: number; neto: number;
  };
  export type SettlementPeriod = {
    settlementId: string; periodStart: string; periodEnd: string;
  };
  export function settlementPeriods(sales: AmazonSkuSale[]): SettlementPeriod[];
  export function aggregateBySku(sales: AmazonSkuSale[], filter: string): ProfitRow[];
  ```

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/__tests__/profitability.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { aggregateBySku, settlementPeriods } from "../profitability";
import type { AmazonSkuSale } from "../types";

function sale(p: Partial<AmazonSkuSale>): AmazonSkuSale {
  return {
    id: Math.random().toString(),
    settlementId: "S1",
    periodStart: "2026-06-10",
    periodEnd: "2026-06-24",
    depositDate: "2026-06-26",
    sku: "SKU-A",
    productName: "Producto A",
    unitsSold: 1,
    ventas: 10,
    gastosAmazon: 4,
    neto: 6,
    importSource: "amazon-settlement",
    createdAt: 0,
    ...p,
  };
}

const sales: AmazonSkuSale[] = [
  sale({ settlementId: "S1", periodStart: "2026-05-26", periodEnd: "2026-06-09", sku: "SKU-A", unitsSold: 2, ventas: 20, gastosAmazon: 8, neto: 12 }),
  sale({ settlementId: "S2", periodStart: "2026-06-10", periodEnd: "2026-06-24", sku: "SKU-A", unitsSold: 3, ventas: 30, gastosAmazon: 12, neto: 18 }),
  sale({ settlementId: "S2", periodStart: "2026-06-10", periodEnd: "2026-06-24", sku: "SKU-B", productName: "", unitsSold: 1, ventas: 5, gastosAmazon: 2, neto: 3 }),
];

describe("settlementPeriods", () => {
  test("devuelve períodos únicos ordenados por inicio descendente", () => {
    const periods = settlementPeriods(sales);
    expect(periods).toHaveLength(2);
    expect(periods[0].settlementId).toBe("S2"); // 2026-06-10 más reciente primero
    expect(periods[1].settlementId).toBe("S1");
  });
});

describe("aggregateBySku", () => {
  test("'all' suma todas las liquidaciones por SKU y ordena por neto desc", () => {
    const rows = aggregateBySku(sales, "all");
    expect(rows).toHaveLength(2);
    expect(rows[0].sku).toBe("SKU-A"); // neto 12+18=30, mayor
    expect(rows[0].unitsSold).toBe(5);
    expect(rows[0].ventas).toBe(50);
    expect(rows[0].gastosAmazon).toBe(20);
    expect(rows[0].neto).toBe(30);
    expect(rows[1].sku).toBe("SKU-B");
  });

  test("filtra por settlementId", () => {
    const rows = aggregateBySku(sales, "S1");
    expect(rows).toHaveLength(1);
    expect(rows[0].sku).toBe("SKU-A");
    expect(rows[0].neto).toBe(12);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -- profitability`
Expected: FAIL — `Cannot find module '../profitability'`.

- [ ] **Step 3: Implementar `lib/profitability.ts`**

```ts
import type { AmazonSkuSale } from "./types";

export type ProfitRow = {
  sku: string;
  productName: string;
  unitsSold: number;
  ventas: number;
  gastosAmazon: number;
  neto: number;
};

export type SettlementPeriod = {
  settlementId: string;
  periodStart: string;
  periodEnd: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Períodos de liquidación únicos, ordenados por inicio descendente (más reciente primero). */
export function settlementPeriods(sales: AmazonSkuSale[]): SettlementPeriod[] {
  const map = new Map<string, SettlementPeriod>();
  for (const s of sales) {
    if (!map.has(s.settlementId)) {
      map.set(s.settlementId, {
        settlementId: s.settlementId,
        periodStart: s.periodStart,
        periodEnd: s.periodEnd,
      });
    }
  }
  return [...map.values()].sort((a, b) => (a.periodStart < b.periodStart ? 1 : -1));
}

/**
 * Agrega ventas por SKU. `filter` = un settlementId específico, o "all" para todo el histórico.
 * Ordena por neto descendente.
 */
export function aggregateBySku(
  sales: AmazonSkuSale[],
  filter: string,
): ProfitRow[] {
  const rows = new Map<string, ProfitRow>();
  for (const s of sales) {
    if (filter !== "all" && s.settlementId !== filter) continue;
    const r =
      rows.get(s.sku) ??
      {
        sku: s.sku,
        productName: s.productName,
        unitsSold: 0,
        ventas: 0,
        gastosAmazon: 0,
        neto: 0,
      };
    if (!r.productName && s.productName) r.productName = s.productName;
    r.unitsSold += s.unitsSold;
    r.ventas = round2(r.ventas + s.ventas);
    r.gastosAmazon = round2(r.gastosAmazon + s.gastosAmazon);
    r.neto = round2(r.neto + s.neto);
    rows.set(s.sku, r);
  }
  return [...rows.values()].sort((a, b) => b.neto - a.neto);
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npm test -- profitability`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/profitability.ts lib/__tests__/profitability.test.ts
git commit -m "feat: add per-SKU profitability aggregation"
```

---

### Task 3: Escritura de inventario en `lib/importWrite.ts`

**Files:**
- Modify: `lib/importWrite.ts`

**Interfaces:**
- Consumes: `ParsedStockItem` de `lib/parseInventoryCsv.ts`.
- Produces:
  ```ts
  export function inventorySnapshotExists(snapshotDate: string): Promise<boolean>;
  export function importInventory(items: ParsedStockItem[], replace: boolean): Promise<void>;
  ```

- [ ] **Step 1: Agregar el import del tipo `ParsedStockItem`**

En `lib/importWrite.ts`, junto a los imports existentes, agregar:

```ts
import type { ParsedStockItem } from "./parseInventoryCsv";
```

- [ ] **Step 2: Agregar las funciones al final de `lib/importWrite.ts`**

```ts
/** ¿Ya existe un snapshot de inventario con esta fecha? */
export async function inventorySnapshotExists(
  snapshotDate: string,
): Promise<boolean> {
  const snap = await getDocs(
    query(collection(db, STOCK), where("snapshotDate", "==", snapshotDate)),
  );
  return !snap.empty;
}

/**
 * Escribe (o reemplaza) un snapshot de inventario. Si `replace`, borra primero TODOS los
 * stockItems con esa snapshotDate (el inventario es un corte completo, no hay filas a mano).
 */
export async function importInventory(
  items: ParsedStockItem[],
  replace: boolean,
): Promise<void> {
  const snapshotDate = items[0]?.snapshotDate ?? "";

  const toDelete: Parameters<ReturnType<typeof writeBatch>["delete"]>[0][] = [];
  if (replace) {
    const snap = await getDocs(
      query(collection(db, STOCK), where("snapshotDate", "==", snapshotDate)),
    );
    snap.forEach((d) => toDelete.push(d.ref));
  }

  const now = Date.now();
  const batch = writeBatch(db);
  for (const ref of toDelete) batch.delete(ref);
  for (const it of items) {
    batch.set(doc(collection(db, STOCK)), {
      ...it,
      importSource: "amazon-inventory",
      importPeriod: snapshotDate,
      createdAt: now,
    });
  }
  await batch.commit();
}
```

> `STOCK`, `db`, `getDocs`, `query`, `where`, `writeBatch`, `doc`, `collection` ya están
> importados/definidos en `importWrite.ts` desde el Plan 2. No re-declarar la constante `STOCK`.

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add lib/importWrite.ts
git commit -m "feat: add inventory snapshot write/replace"
```

---

### Task 4: Página de Stock — upload + rentabilidad por producto

Reemplazo completo de `app/admin/(crm)/stock/page.tsx` (agrega el botón de upload, la sección de
rentabilidad con filtro, y actualiza el texto del estado vacío). La lógica de inventario existente
(métricas, tabla de productos, `HealthBadge`) se conserva igual.

**Files:**
- Modify: `app/admin/(crm)/stock/page.tsx`

**Interfaces:**
- Consumes: `ImportDialog`, `subscribeAmazonSkuSales`, `parseInventoryCsv`/`ParsedStockItem`,
  `importInventory`/`inventorySnapshotExists`, `aggregateBySku`/`settlementPeriods`,
  `formatShort`, `AmazonSkuSale`.

- [ ] **Step 1: Reemplazar el contenido completo de `app/admin/(crm)/stock/page.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { ImportDialog } from "@/components/ImportDialog";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { subscribeAmazonSkuSales } from "@/lib/amazonSkuSales";
import { formatDate, formatShort } from "@/lib/format";
import { importInventory, inventorySnapshotExists } from "@/lib/importWrite";
import { parseInventoryCsv, type ParsedStockItem } from "@/lib/parseInventoryCsv";
import { aggregateBySku, settlementPeriods } from "@/lib/profitability";
import { subscribeStock } from "@/lib/stock";
import type { AmazonSkuSale, StockItem } from "@/lib/types";

const HEALTH_BADGE: Record<string, string> = {
  Healthy: "bg-status-ontrack/10 text-status-ontrack",
  "Low stock": "bg-status-overdue/10 text-status-overdue",
  Excess: "bg-status-today/10 text-status-today",
};

function HealthBadge({ status }: { status: string }) {
  if (!status) return <span className="text-ink-soft">—</span>;
  const cls = HEALTH_BADGE[status] ?? "bg-ink-soft/10 text-ink-soft";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function InventoryPreview({ items }: { items: ParsedStockItem[] }) {
  const snapshotDate = items[0]?.snapshotDate ?? "";
  const units = items.reduce((s, it) => s + it.available, 0);
  const value = items.reduce((s, it) => s + it.available * it.price, 0);
  return (
    <div className="space-y-1">
      <p className="font-medium text-ink">
        Snapshot {snapshotDate ? formatDate(snapshotDate) : "—"}
      </p>
      <p className="text-ink-soft">
        {items.length} productos · {units} unidades · valor ${value.toFixed(2)}
      </p>
    </div>
  );
}

export default function StockPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sales, setSales] = useState<AmazonSkuSale[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [filter, setFilter] = useState("all");

  useEffect(
    () =>
      subscribeStock((list) => {
        setItems(list);
        setLoaded(true);
      }),
    [],
  );

  useEffect(() => subscribeAmazonSkuSales(setSales), []);

  const latestDate = useMemo(() => {
    return items.reduce<string | null>(
      (max, it) => (!max || it.snapshotDate > max ? it.snapshotDate : max),
      null,
    );
  }, [items]);

  const latest = useMemo(
    () => items.filter((it) => it.snapshotDate === latestDate),
    [items, latestDate],
  );

  const metrics = useMemo(() => {
    return latest.reduce(
      (acc, it) => ({
        available: acc.available + it.available,
        value: acc.value + it.available * it.price,
        shipped30: acc.shipped30 + it.unitsShipped30,
        shipped90: acc.shipped90 + it.unitsShipped90,
      }),
      { available: 0, value: 0, shipped30: 0, shipped90: 0 },
    );
  }, [latest]);

  const periods = useMemo(() => settlementPeriods(sales), [sales]);
  const profitRows = useMemo(() => aggregateBySku(sales, filter), [sales, filter]);

  return (
    <>
      <PageHeader
        eyebrow={latestDate ? `Snapshot: ${formatDate(latestDate)}` : "Stock"}
        title="Stock"
        actions={
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="rounded-control border border-olive px-3 py-2 text-sm font-medium text-olive transition-colors hover:bg-olive hover:text-stone"
          >
            Subir informe
          </button>
        }
      />

      {!loaded ? (
        <p className="font-mono text-sm text-ink-soft">Cargando…</p>
      ) : (
        <>
          {items.length === 0 ? (
            <div className="rounded-card border border-dashed border-line bg-surface px-4 py-10 text-center">
              <p className="text-sm text-ink">Todavía no hay datos de stock.</p>
              <p className="mt-1 text-xs text-ink-soft">
                Subí el CSV de inventario de Amazon con el botón “Subir informe”.
              </p>
            </div>
          ) : (
            <>
              <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <MetricCard label="Unidades disponibles" value={metrics.available} />
                <MetricCard
                  label="Valor de inventario"
                  value={`$${metrics.value.toFixed(2)}`}
                  accent
                />
                <MetricCard label="Vendido (30 días)" value={metrics.shipped30} />
                <MetricCard label="Vendido (90 días)" value={metrics.shipped90} />
              </section>

              <section className="mt-8">
                <h2 className="mb-3 font-eyebrow text-[11px] uppercase tracking-[0.2em] text-ink-soft">
                  Productos
                </h2>
                <div className="overflow-hidden rounded-card border border-line bg-surface">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-line">
                        {[
                          "SKU",
                          "Producto",
                          "Disponible",
                          "Vendido 30d",
                          "Días de stock",
                          "Precio",
                          "Estado",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-2.5 font-eyebrow text-[10px] uppercase tracking-[0.15em] text-ink-soft"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {latest.map((it) => (
                        <tr key={it.id} className="border-b border-line last:border-0">
                          <td className="px-4 py-3 font-mono text-xs text-ink-soft">
                            {it.sku}
                          </td>
                          <td className="px-4 py-3 text-ink">{it.productName}</td>
                          <td className="px-4 py-3 text-right font-mono text-ink">
                            {it.available}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-ink-soft">
                            {it.unitsShipped30}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-ink-soft">
                            {it.daysOfSupply ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-ink">
                            ${it.price.toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            <HealthBadge status={it.healthStatus} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {sales.length > 0 && (
            <section className="mt-8">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-eyebrow text-[11px] uppercase tracking-[0.2em] text-ink-soft">
                  Rentabilidad por producto
                </h2>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  aria-label="Filtrar por liquidación"
                  className="rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-olive"
                >
                  <option value="all">Todo el histórico</option>
                  {periods.map((p) => (
                    <option key={p.settlementId} value={p.settlementId}>
                      {formatShort(p.periodStart)}–{formatDate(p.periodEnd)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="overflow-hidden rounded-card border border-line bg-surface">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line">
                      {["Producto", "Vendido", "Ingreso", "Gastos Amazon", "Neto"].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-4 py-2.5 font-eyebrow text-[10px] uppercase tracking-[0.15em] text-ink-soft"
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {profitRows.map((r) => (
                      <tr key={r.sku} className="border-b border-line last:border-0">
                        <td className="px-4 py-3 text-ink">{r.productName || r.sku}</td>
                        <td className="px-4 py-3 text-right font-mono text-ink">
                          {r.unitsSold}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-status-ontrack">
                          ${r.ventas.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-status-overdue">
                          −${r.gastosAmazon.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-ink">
                          ${r.neto.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      <ImportDialog<ParsedStockItem[]>
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Subir inventario FBA (Amazon)"
        accept=".csv"
        parse={parseInventoryCsv}
        renderPreview={(list) => <InventoryPreview items={list} />}
        canConfirm={(list) => list.length > 0 && !!list[0].snapshotDate}
        checkDuplicate={(list) => inventorySnapshotExists(list[0]?.snapshotDate ?? "")}
        onConfirm={(list, replace) => importInventory(list, replace)}
      />
    </>
  );
}
```

- [ ] **Step 2: Verificar tipos y build**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npm run build`
Expected: build verde.

- [ ] **Step 3: Commit**

```bash
git add "app/admin/(crm)/stock/page.tsx"
git commit -m "feat: add inventory upload and per-product profitability to Stock"
```

---

### Task 5: Verificación en preview (sin escribir en producción)

**Files:** ninguno (verificación).

- [ ] **Step 1: Levantar dev y abrir Stock**

Run: `npm run dev` → `http://localhost:3000/admin/stock` (con login).

- [ ] **Step 2: Verificar el upload de inventario (solo preview)**

Click en "Subir informe" → seleccionar
`C:\Nico-Archivos\ClaudeCode\Ranic-Group\Inventario de Logística de Amazon.csv`.

Verificar:
- [ ] Preview: "Snapshot 30/06/2026", "18 productos · 491 unidades · valor $4234.93".
- [ ] Si ese snapshot ya está cargado, aparece el checkbox "Ya está importado. Reemplazar…".
- [ ] Cerrar con "Cancelar" — no se escribe nada.

- [ ] **Step 3: Verificar la sección de rentabilidad**

Si ya hay `amazonSkuSales` en Firestore (de una liquidación importada por Nico), verificar:
- [ ] Aparece "Rentabilidad por producto" con el selector "Todo el histórico".
- [ ] La tabla lista productos con Vendido / Ingreso / Gastos Amazon / Neto, ordenada por Neto desc.
- [ ] Elegir una liquidación en el selector filtra los números a ese período.
- [ ] Si `amazonSkuSales` está vacío, la sección simplemente no aparece (no rompe).

- [ ] **Step 4: Commit (si hubo ajustes de UI)**

```bash
git add -A
git commit -m "fix: stock profitability UI polish"
```

---

## Self-Review

**Spec coverage (Plan 3 cubre §4.4, §7 Stock, §11):**
- §4.4 `stockItems` con etiquetas + escritura de snapshot → Task 3 ✓
- §7 upload de Stock (botón + preview reutilizando `ImportDialog`) → Task 4 ✓
- §11 `subscribeAmazonSkuSales`, selector de período, tabla por SKU con "Todo el histórico" +
  filtro por liquidación → Task 1/2/4 ✓
- Dedup de inventario por `snapshotDate` → Task 3 (`inventorySnapshotExists`) ✓

**Placeholder scan:** sin TBD/TODO; código completo, incluida la página entera de Stock.

**Type consistency:** `ProfitRow`/`SettlementPeriod` definidos en Task 2 y usados en Task 4;
`ParsedStockItem` (Plan 1) usado en Task 3 y como `T` del `ImportDialog<ParsedStockItem[]>` en
Task 4; `subscribeAmazonSkuSales` (Task 1) consumido en Task 4; `AmazonSkuSale` (Plan 1) es la
fuente de `aggregateBySku`. `importInventory`/`inventorySnapshotExists` firmados en Task 3 y
llamados con esa firma en Task 4.

**Nota:** `importWrite.ts` gana funciones de inventario (Task 3) — el archivo pasa a manejar
escritura de settlement Y de stock; sigue siendo cohesivo (toda la escritura de imports en un
lugar) y chico. OK según el spec §12.
