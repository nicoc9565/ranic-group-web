# Amazon Uploads — Plan 1: Fundamentos + migración

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la lógica pura que parsea los dos archivos de Amazon (inventario y liquidación V2), agregar los tipos nuevos, y migrar (borrar) los movimientos mensuales de Amazon del import viejo para no contar doble.

**Architecture:** Toda la extracción vive en `lib/` como funciones puras (sin React ni Firebase), testeadas con Vitest sobre un fixture real. La migración es un script one-shot con `--dry-run`, siguiendo el patrón de los otros scripts del repo. Este plan NO toca UI ni escribe imports desde la web (eso es Plan 2 y 3).

**Tech Stack:** TypeScript, Vitest, `csv-parse/sync`, Firebase Web SDK (solo en el script de migración).

**Spec:** `docs/superpowers/specs/2026-07-01-amazon-report-uploads-design.md`

## Global Constraints

- Idioma UI/labels: español. Nada de contenido de emails acá.
- Firebase Web SDK únicamente (nunca Admin SDK).
- Firestore rechaza `undefined`: nunca escribir campos opcionales con valor `undefined`.
- Los documentos cargados a mano **no tienen** `importSource`; la migración y los reemplazos
  jamás deben tocarlos.
- Importes siempre positivos en `Transaction.amount`; el signo lo da `type`.
- Todos los montos redondeados a 2 decimales (`Math.round(n * 100) / 100`).
- Scripts que escriben en Firestore: leer password de `process.env.SEED_USER_PASSWORD`,
  email de `SEED_USER_EMAIL` (default `nicolas.conti@ranicgroup.com`), soportar `--dry-run`.
- Commit al final de cada tarea, mensajes estilo `feat:` / `chore:`.

---

### Task 1: Tipos nuevos en `lib/types.ts`

**Files:**
- Modify: `lib/types.ts`

**Interfaces:**
- Produces:
  - `Transaction` gana `importSource?: "amazon-settlement"` e `importPeriod?: string`.
  - `StockItem` gana `importSource?: "amazon-inventory"` e `importPeriod?: string`.
  - `EXPENSE_CATEGORIES` y el tipo `ExpenseCategory` incluyen `"Comisión Amazon"`.
  - Tipo nuevo `AmazonSkuSale`.

- [ ] **Step 1: Agregar `"Comisión Amazon"` al tipo `ExpenseCategory`**

En `lib/types.ts`, cambiar:

```ts
export type ExpenseCategory =
  | "Compra a Proveedor"
  | "Suscripciones y Software"
  | "Gastos Operativos"
  | "Educación"
  | "Otros";
```

por:

```ts
export type ExpenseCategory =
  | "Compra a Proveedor"
  | "Suscripciones y Software"
  | "Gastos Operativos"
  | "Educación"
  | "Comisión Amazon"
  | "Otros";
```

- [ ] **Step 2: Agregar `"Comisión Amazon"` a la constante `EXPENSE_CATEGORIES`**

Cambiar:

```ts
export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Compra a Proveedor",
  "Suscripciones y Software",
  "Gastos Operativos",
  "Educación",
  "Otros",
];
```

por:

```ts
export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Compra a Proveedor",
  "Suscripciones y Software",
  "Gastos Operativos",
  "Educación",
  "Comisión Amazon",
  "Otros",
];
```

- [ ] **Step 3: Agregar campos de import a `Transaction`**

En el tipo `Transaction`, después de `expenseCategory: ExpenseCategory | null;` y antes de `createdAt: number;`, agregar:

```ts
  /** Origen del import automático. Ausente en movimientos cargados a mano. */
  importSource?: "amazon-settlement";
  /** Corte al que pertenece el movimiento importado (settlement-id). */
  importPeriod?: string;
```

- [ ] **Step 4: Agregar campos de import a `StockItem`**

En el tipo `StockItem`, después de `alert: string;` y antes de `createdAt: number;`, agregar:

```ts
  /** Origen del import automático. Ausente en filas cargadas a mano. */
  importSource?: "amazon-inventory";
  /** Corte al que pertenece el item importado (snapshotDate). */
  importPeriod?: string;
```

- [ ] **Step 5: Agregar el tipo `AmazonSkuSale` al final de `lib/types.ts`**

```ts
// ── Rentabilidad por producto (ventas de Amazon por SKU y liquidación) ─────

export type AmazonSkuSale = {
  id: string;
  settlementId: string; // = importPeriod
  periodStart: string; // yyyy-mm-dd
  periodEnd: string; // yyyy-mm-dd
  depositDate: string; // yyyy-mm-dd
  sku: string;
  productName: string; // se resuelve desde stockItems al escribir; "" si no hay match
  unitsSold: number; // Order − Refund
  ventas: number; // money in del SKU
  gastosAmazon: number; // money out del SKU (positivo)
  neto: number; // ventas − gastosAmazon
  importSource: "amazon-settlement";
  createdAt: number;
};
```

- [ ] **Step 6: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add import tags, Comisión Amazon category, and AmazonSkuSale type"
```

---

### Task 2: `lib/parseInventoryCsv.ts` (extraer del script)

Extrae la lógica de parseo del CSV de inventario (hoy embebida en `scripts/import-stock.ts`) a una función pura reutilizable por el upload web.

**Files:**
- Create: `lib/parseInventoryCsv.ts`
- Create: `lib/__tests__/parseInventoryCsv.test.ts`

**Interfaces:**
- Consumes: `StockItem` de `lib/types.ts`.
- Produces: `parseInventoryCsv(text: string): ParsedStockItem[]` donde
  `ParsedStockItem = Omit<StockItem, "id" | "createdAt" | "importSource" | "importPeriod">`.

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/__tests__/parseInventoryCsv.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { parseInventoryCsv } from "../parseInventoryCsv";

const CSV = `snapshot-date,sku,asin,product-name,available,units-shipped-t30,units-shipped-t90,days-of-supply,your-price,fba-inventory-level-health-status,alert
2026-06-30,FRONTIER-CELERY-30,B01ABC,Frontier Celery Seed,42,10,30,,8.44,Healthy,
2026-06-30,SO-ONION-3,B02XYZ,Simply Organic Onion,0,0,0,,7.60,Low stock,Low traffic`;

describe("parseInventoryCsv", () => {
  test("mapea columnas del CSV a ParsedStockItem", () => {
    const rows = parseInventoryCsv(CSV);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      snapshotDate: "2026-06-30",
      sku: "FRONTIER-CELERY-30",
      asin: "B01ABC",
      productName: "Frontier Celery Seed",
      available: 42,
      unitsShipped30: 10,
      unitsShipped90: 30,
      daysOfSupply: null,
      price: 8.44,
      healthStatus: "Healthy",
      alert: "",
    });
  });

  test("days-of-supply vacío → null; numéricos vacíos → 0", () => {
    const rows = parseInventoryCsv(CSV);
    expect(rows[1].daysOfSupply).toBeNull();
    expect(rows[1].available).toBe(0);
    expect(rows[1].alert).toBe("Low traffic");
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npm test -- parseInventoryCsv`
Expected: FAIL — `Cannot find module '../parseInventoryCsv'`.

- [ ] **Step 3: Implementar `lib/parseInventoryCsv.ts`**

```ts
import { parse } from "csv-parse/sync";
import type { StockItem } from "./types";

export type ParsedStockItem = Omit<
  StockItem,
  "id" | "createdAt" | "importSource" | "importPeriod"
>;

type CsvRow = Record<string, string>;

function num(value: string | undefined): number {
  const n = Number((value ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(value: string | undefined): number | null {
  const trimmed = (value ?? "").trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** Parsea el CSV de "Inventario de Logística de Amazon" a filas de stock. */
export function parseInventoryCsv(text: string): ParsedStockItem[] {
  const rows: CsvRow[] = parse(text, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });

  return rows.map((row) => ({
    snapshotDate: (row["snapshot-date"] ?? "").trim(),
    sku: (row["sku"] ?? "").trim(),
    asin: (row["asin"] ?? "").trim(),
    productName: (row["product-name"] ?? "").trim(),
    available: num(row["available"]),
    unitsShipped30: num(row["units-shipped-t30"]),
    unitsShipped90: num(row["units-shipped-t90"]),
    daysOfSupply: numOrNull(row["days-of-supply"]),
    price: num(row["your-price"]),
    healthStatus: (row["fba-inventory-level-health-status"] ?? "").trim(),
    alert: (row["alert"] ?? "").trim(),
  }));
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npm test -- parseInventoryCsv`
Expected: PASS (2 tests).

- [ ] **Step 5: Apuntar el script viejo a la función extraída (DRY)**

En `scripts/import-stock.ts`, reemplazar la función local `parseRows` y sus helpers `num`/`numOrNull` por el uso de la función nueva. Cambiar el cuerpo de `parseRows` por:

```ts
import { parseInventoryCsv } from "../lib/parseInventoryCsv";
// ...
function parseRows(): ParsedStockItem[] {
  const csv = readFileSync(CSV_PATH, "utf8");
  return parseInventoryCsv(csv);
}
```

Y cambiar el alias de tipo local `type ParsedStockItem = Omit<StockItem, "id" | "createdAt">;`
por importar el tipo: `import type { ParsedStockItem } from "../lib/parseInventoryCsv";`.
Borrar las funciones `num` y `numOrNull` que quedaron sin uso en el script.

- [ ] **Step 6: Verificar tipos y el dry-run del script**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npm run import-stock -- --dry-run`
Expected: imprime "Productos a importar: 18" y los totales, sin escribir nada.

- [ ] **Step 7: Commit**

```bash
git add lib/parseInventoryCsv.ts lib/__tests__/parseInventoryCsv.test.ts scripts/import-stock.ts
git commit -m "feat: extract inventory CSV parsing to lib/parseInventoryCsv"
```

---

### Task 3: `lib/parseSettlement.ts` (parser del informe de liquidación V2)

El corazón del feature. Parsea el `.txt` tab-separado de Amazon, calcula ventas/gastos que
reconcilian con el depósito, y agrega ventas por SKU.

**Files:**
- Create: `lib/parseSettlement.ts`
- Create: `lib/__tests__/parseSettlement.test.ts`
- Create (fixture): `lib/__tests__/fixtures/settlement-sample.txt`

**Interfaces:**
- Consumes: nada del proyecto (solo `csv-parse/sync`).
- Produces:
  ```ts
  export type SkuSaleAgg = {
    sku: string;
    unitsSold: number;
    ventas: number;
    gastosAmazon: number;
    neto: number;
  };
  export type SettlementParseResult = {
    settlementId: string;
    periodStart: string;   // yyyy-mm-dd
    periodEnd: string;     // yyyy-mm-dd
    depositDate: string;   // yyyy-mm-dd
    totalAmount: number;
    ventas: number;
    gastos: number;
    skuSales: SkuSaleAgg[];
    reconciles: boolean;
  };
  export function parseSettlement(text: string): SettlementParseResult;
  ```

- [ ] **Step 1: Copiar el archivo real como fixture de test**

Copiar `C:/Nico-Archivos/ClaudeCode/Ranic-Group/50038020628.txt` a
`lib/__tests__/fixtures/settlement-sample.txt` (crear la carpeta `fixtures` si no existe).

En bash:

```bash
mkdir -p lib/__tests__/fixtures
cp "/c/Nico-Archivos/ClaudeCode/Ranic-Group/50038020628.txt" lib/__tests__/fixtures/settlement-sample.txt
```

- [ ] **Step 2: Escribir el test que falla**

Crear `lib/__tests__/parseSettlement.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { parseSettlement } from "../parseSettlement";

const sample = readFileSync(
  new URL("./fixtures/settlement-sample.txt", import.meta.url),
  "utf8",
);

describe("parseSettlement", () => {
  const r = parseSettlement(sample);

  test("extrae el resumen de la liquidación", () => {
    expect(r.settlementId).toBe("26688578961");
    expect(r.periodStart).toBe("2026-06-10");
    expect(r.periodEnd).toBe("2026-06-24");
    expect(r.depositDate).toBe("2026-06-26");
    expect(r.totalAmount).toBe(216.18);
  });

  test("ventas − gastos reconcilia con el total del depósito", () => {
    expect(Math.round((r.ventas - r.gastos) * 100) / 100).toBe(216.18);
    expect(r.reconciles).toBe(true);
    expect(r.ventas).toBeGreaterThan(0);
    expect(r.gastos).toBeGreaterThan(0);
  });

  test("la suscripción sin SKU entra en gastos", () => {
    // El archivo trae una Subscription Fee de -39.99 sin sku.
    expect(r.gastos).toBeGreaterThanOrEqual(39.99);
  });

  test("agrega ventas por SKU con unidades vendidas", () => {
    const celery = r.skuSales.find((s) => s.sku === "FRONTIER-CELERY-30");
    expect(celery).toBeDefined();
    expect(celery!.unitsSold).toBeGreaterThan(0);
    expect(celery!.ventas).toBeGreaterThan(0);
    expect(Math.round((celery!.ventas - celery!.gastosAmazon) * 100) / 100).toBe(
      celery!.neto,
    );
  });

  test("no incluye filas sin SKU en skuSales", () => {
    expect(r.skuSales.every((s) => s.sku !== "")).toBe(true);
  });

  test("rechaza un archivo sin fila de resumen", () => {
    const bad = "settlement-id\tsettlement-start-date\ttotal-amount\n\t\t\n";
    expect(() => parseSettlement(bad)).toThrow();
  });
});
```

- [ ] **Step 3: Correr el test para verificar que falla**

Run: `npm test -- parseSettlement`
Expected: FAIL — `Cannot find module '../parseSettlement'`.

- [ ] **Step 4: Implementar `lib/parseSettlement.ts`**

```ts
import { parse } from "csv-parse/sync";

export type SkuSaleAgg = {
  sku: string;
  unitsSold: number;
  ventas: number;
  gastosAmazon: number;
  neto: number;
};

export type SettlementParseResult = {
  settlementId: string;
  periodStart: string;
  periodEnd: string;
  depositDate: string;
  totalAmount: number;
  ventas: number;
  gastos: number;
  skuSales: SkuSaleAgg[];
  reconciles: boolean;
};

// Todas las columnas de importe del informe V2. Cada una lleva su propio signo.
const AMOUNT_COLUMNS = [
  "shipment-fee-amount",
  "order-fee-amount",
  "price-amount",
  "item-related-fee-amount",
  "misc-fee-amount",
  "other-fee-amount",
  "promotion-amount",
  "direct-payment-amount",
  "other-amount",
];

function num(value: string | undefined): number {
  const n = Number((value ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

function isoDate(value: string | undefined): string {
  return (value ?? "").trim().slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Parsea el informe de liquidación V2 (.txt tab-separado) de Amazon. */
export function parseSettlement(text: string): SettlementParseResult {
  const rows: Record<string, string>[] = parse(text, {
    delimiter: "\t",
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
  });

  if (rows.length === 0) {
    throw new Error("El archivo no tiene filas de datos.");
  }

  // La fila de resumen es la única con total-amount cargado.
  const summary = rows.find((r) => (r["total-amount"] ?? "").trim() !== "");
  if (!summary) {
    throw new Error(
      "No se encontró la fila de resumen (total-amount) de la liquidación.",
    );
  }

  const settlementId = (summary["settlement-id"] ?? "").trim();
  if (!settlementId) {
    throw new Error("Falta settlement-id en el archivo.");
  }

  const periodStart = isoDate(summary["settlement-start-date"]);
  const periodEnd = isoDate(summary["settlement-end-date"]);
  const depositDate = isoDate(summary["deposit-date"]);
  const totalAmount = round2(num(summary["total-amount"]));

  let ventas = 0;
  let gastos = 0;
  const bySku = new Map<string, SkuSaleAgg>();

  for (const row of rows) {
    // Suma de todos los importes de detalle de la fila, con su signo.
    // La fila de resumen tiene estas columnas vacías → aporta 0.
    let rowAmount = 0;
    for (const col of AMOUNT_COLUMNS) rowAmount += num(row[col]);

    if (rowAmount > 0) ventas += rowAmount;
    else if (rowAmount < 0) gastos += -rowAmount;

    const sku = (row["sku"] ?? "").trim();
    if (!sku) continue;

    const type = (row["transaction-type"] ?? "").trim();
    const qty = num(row["quantity-purchased"]);

    const agg =
      bySku.get(sku) ??
      { sku, unitsSold: 0, ventas: 0, gastosAmazon: 0, neto: 0 };

    if (type === "Order") agg.unitsSold += qty;
    else if (type === "Refund") agg.unitsSold -= qty;

    if (rowAmount > 0) agg.ventas += rowAmount;
    else if (rowAmount < 0) agg.gastosAmazon += -rowAmount;

    bySku.set(sku, agg);
  }

  ventas = round2(ventas);
  gastos = round2(gastos);

  const skuSales: SkuSaleAgg[] = [...bySku.values()].map((a) => ({
    sku: a.sku,
    unitsSold: a.unitsSold,
    ventas: round2(a.ventas),
    gastosAmazon: round2(a.gastosAmazon),
    neto: round2(a.ventas - a.gastosAmazon),
  }));

  const reconciles = Math.abs(ventas - gastos - totalAmount) <= 0.01;

  return {
    settlementId,
    periodStart,
    periodEnd,
    depositDate,
    totalAmount,
    ventas,
    gastos,
    skuSales,
    reconciles,
  };
}
```

- [ ] **Step 5: Correr el test para verificar que pasa**

Run: `npm test -- parseSettlement`
Expected: PASS (6 tests). En particular `reconciles === true` y `totalAmount === 216.18`.

> Si `reconciles` diera `false`, NO ajustar la tolerancia: revisar que el fixture se haya
> copiado tal cual (tabs intactos, sin conversión de encoding) y que `AMOUNT_COLUMNS` cubra
> todas las columnas de importe del header. El invariante de Amazon es exacto.

- [ ] **Step 6: Correr toda la suite**

Run: `npm test`
Expected: toda la suite verde (incluye followup, emails, categoryInference, financeCategory,
parseInventoryCsv, parseSettlement).

- [ ] **Step 7: Commit**

```bash
git add lib/parseSettlement.ts lib/__tests__/parseSettlement.test.ts lib/__tests__/fixtures/settlement-sample.txt
git commit -m "feat: add Amazon settlement V2 report parser with reconciliation"
```

---

### Task 4: Script de migración — borrar movimientos mensuales viejos de Amazon

Elimina los ~9 movimientos que cargó `import-amazon-transactions.ts` (agregados por mes), para
que no se cuenten doble cuando se importen las liquidaciones. Solo borra movimientos SIN
`importSource` cuya descripción sea del formato viejo.

**Files:**
- Create: `scripts/migrate-remove-monthly-amazon.ts`
- Modify: `package.json` (script npm)

**Interfaces:**
- Consumes: `Transaction` de `lib/types.ts`; `auth`/`db` de `lib/firebase.ts`.

- [ ] **Step 1: Crear `scripts/migrate-remove-monthly-amazon.ts`**

```ts
/**
 * Migración one-shot: borra los movimientos mensuales de Amazon cargados por el import viejo
 * (scripts/import-amazon-transactions.ts), para no contar doble al pasar al modelo por
 * liquidación. Solo borra movimientos cuya descripción empieza con "Ventas Amazon — " o
 * "Comisión Amazon — " Y que NO tengan importSource (los cargados a mano no se tocan).
 *
 * Uso:
 *   npm run migrate-remove-monthly-amazon -- --dry-run   (solo lista, no borra)
 *   npm run migrate-remove-monthly-amazon                (borra; necesita SEED_USER_PASSWORD)
 */
import "./env";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import type { Transaction } from "../lib/types";

const MONTHLY_RE = /^(Ventas Amazon|Comisión Amazon) — /;

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const password = process.env.SEED_USER_PASSWORD;
  if (!password) {
    console.error(
      "\n✗ Falta SEED_USER_PASSWORD en .env.local (leer Firestore requiere login).\n",
    );
    process.exit(1);
  }
  const email = process.env.SEED_USER_EMAIL ?? "nicolas.conti@ranicgroup.com";
  await signInWithEmailAndPassword(auth, email, password);

  const snap = await getDocs(collection(db, "transactions"));
  const targets = snap.docs.filter((d) => {
    const t = d.data() as Transaction;
    return MONTHLY_RE.test(t.description ?? "") && t.importSource === undefined;
  });

  console.log(`\nMovimientos mensuales viejos de Amazon a borrar: ${targets.length}`);
  for (const d of targets) {
    const t = d.data() as Transaction;
    console.log(
      `  ${t.date}  ${t.type.padEnd(8)} $${Number(t.amount).toFixed(2).padStart(9)}  ${t.description}`,
    );
  }

  if (dryRun) {
    console.log("\n(--dry-run) No se borró nada en Firestore.");
    process.exit(0);
  }

  for (const d of targets) {
    await deleteDoc(doc(db, "transactions", d.id));
  }

  console.log(`\n✓ Migración completa. ${targets.length} movimientos borrados.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Error en la migración:", err?.code ?? err);
  process.exit(1);
});
```

- [ ] **Step 2: Agregar el script a `package.json`**

En `"scripts"`, después de `"import-stock": "tsx scripts/import-stock.ts",` agregar:

```json
    "migrate-remove-monthly-amazon": "tsx scripts/migrate-remove-monthly-amazon.ts",
```

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Dry-run de la migración (no borra nada)**

Run: `npm run migrate-remove-monthly-amazon -- --dry-run`
Expected: lista los movimientos mensuales viejos (esperado ~9: los "Ventas Amazon — <Mes>" y
"Comisión Amazon — <Mes>" del import de PR #10) y termina con "(--dry-run) No se borró nada."

> Revisar la lista con Nico antes de correr sin `--dry-run`. El conteo esperado es 9; si sale
> muy distinto, frenar y avisar.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate-remove-monthly-amazon.ts package.json
git commit -m "chore: add migration script to remove legacy monthly Amazon movements"
```

> El borrado real (sin `--dry-run`) NO se corre como parte del plan: lo dispara Nico cuando
> vaya a empezar a subir las liquidaciones (Plan 2), para no dejar Finanzas sin datos de Amazon
> en el medio.

---

## Self-Review

**Spec coverage (Plan 1 cubre §4, §5, §9 del spec):**
- §4.1/§4.2/§4.4 etiquetas de origen + "Comisión Amazon" → Task 1 ✓
- §4.3 tipo `AmazonSkuSale` → Task 1 ✓
- §5 `parseInventoryCsv` → Task 2 ✓
- §5 `parseSettlement` + casos (suscripción sin SKU, refund, reconciliación, fechas ISO) → Task 3 ✓
- §9 migración de datos existentes → Task 4 ✓
- §6, §7, §8, §10, §11 (UI de upload, preview, dedup/escritura, reconciliación end-to-end,
  rentabilidad) → **fuera de este plan**, van en Plan 2 y Plan 3.

**Placeholder scan:** sin TBD/TODO; todo el código está completo.

**Type consistency:** `SkuSaleAgg` y `SettlementParseResult` idénticos entre interfaces y
código de Task 3; `ParsedStockItem` idéntico entre Task 2 y su uso en el script;
`AmazonSkuSale` de Task 1 es superconjunto de `SkuSaleAgg` (los campos extra se agregan al
escribir, en Plan 2).
