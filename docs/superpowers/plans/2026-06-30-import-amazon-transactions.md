# Import Transacciones Amazon Seller — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Script de import único que lee `Transacciones-Amazon-Seller.csv`, agrupa por mes y carga 1-2 `Transaction` por mes (Venta + Comisión Amazon) a Firestore.

**Architecture:** Script Node standalone (mismo patrón que `scripts/import-transactions.ts`), sin tocar la app web.

**Tech Stack:** Node + tsx, `csv-parse/sync`, Firebase Web SDK.

## Global Constraints

- Usar Firebase **Web SDK** (no Admin SDK) + `SEED_USER_PASSWORD` de `.env.local` — política de la org bloquea service account keys.
- Flag `--dry-run` obligatorio: parsea y reporta sin escribir.
- No modificar `lib/types.ts` ni ninguna página/componente de Finanzas — usa el modelo `Transaction` tal cual existe.
- No commitear el CSV de origen (ya está fuera del repo, en `C:\Nico-Archivos\ClaudeCode\Ranic-Group\`).

---

### Task 1: scripts/import-amazon-transactions.ts

**Files:**
- Create: `scripts/import-amazon-transactions.ts`
- Modify: `package.json` (agregar script npm)

**Interfaces:**
- Consumes: `auth`, `db` de `lib/firebase.ts`; tipo `Transaction`/`TransactionType` de `lib/types.ts`
- Produces: documentos en la colección Firestore `transactions`, mismo shape que usa `lib/transactions.ts`

- [ ] **Step 1: Crear scripts/import-amazon-transactions.ts**

```ts
/**
 * Import histórico de ventas de Amazon Seller a la colección `transactions`. Ver spec
 * docs/superpowers/specs/2026-06-30-import-amazon-transactions-design.md.
 *
 * Agrupa por mes calendario y genera hasta 2 movimientos por mes:
 *   - Ingreso "Venta" = suma de "Cargos por producto (total)" del mes
 *   - Egreso "Comisión Amazon" = Venta del mes − suma de "Total (USD)" del mes
 * Si la Venta de un mes es 0, no se genera el Ingreso. Si además la Comisión también
 * es 0, el mes se omite por completo.
 *
 * Uso:
 *   npm run import-amazon-transactions -- --dry-run   (solo parsea y reporta)
 *   npm run import-amazon-transactions                (escribe; necesita SEED_USER_PASSWORD)
 */
import { readFileSync } from "node:fs";
import "./env";
import { parse } from "csv-parse/sync";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, doc, writeBatch } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import type { Transaction } from "../lib/types";

const CSV_PATH =
  "C:/Nico-Archivos/ClaudeCode/Ranic-Group/Transacciones-Amazon-Seller.csv";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

type ParsedTransaction = Omit<Transaction, "id" | "createdAt" | "updatedAt">;

/** "29/6/2026" → { year: 2026, month: 6 } (month 1-indexado). */
function parseFecha(value: string): { year: number; month: number } | null {
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, , mo, y] = m;
  return { year: Number(y), month: Number(mo) };
}

/** Último día calendario de year-month (month 1-indexado), como yyyy-mm-dd. */
function lastDayOfMonth(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

function num(value: string | undefined): number {
  const n = Number((value ?? "0").trim());
  return Number.isFinite(n) ? n : 0;
}

function parseRows(): ParsedTransaction[] {
  const csv = readFileSync(CSV_PATH, "utf8");
  const rows: string[][] = parse(csv, { skip_empty_lines: true, bom: true });

  const byMonth = new Map<string, { year: number; month: number; venta: number; total: number }>();

  for (const row of rows.slice(1)) {
    const [fecha, , , cargos, , , , totalUsd] = row;
    const parsed = parseFecha(fecha ?? "");
    if (!parsed) continue;

    const key = `${parsed.year}-${String(parsed.month).padStart(2, "0")}`;
    const entry = byMonth.get(key) ?? { ...parsed, venta: 0, total: 0 };
    entry.venta += num(cargos);
    entry.total += num(totalUsd);
    byMonth.set(key, entry);
  }

  const out: ParsedTransaction[] = [];
  for (const [, { year, month, venta, total }] of [...byMonth].sort()) {
    const ventaRound = Math.round(venta * 100) / 100;
    const comisionRound = Math.round((venta - total) * 100) / 100;
    if (ventaRound === 0 && comisionRound === 0) continue;

    const date = lastDayOfMonth(year, month);
    const label = `${MESES[month - 1]} ${year}`;

    if (ventaRound !== 0) {
      out.push({
        date,
        type: "Ingreso",
        description: `Ventas Amazon — ${label}`,
        amount: ventaRound,
        payer: "Amazon",
        method: "Amazon Seller",
        incomeSource: "Venta",
        expenseCategory: null,
      });
    }
    if (comisionRound !== 0) {
      out.push({
        date,
        type: "Egreso",
        description: `Comisión Amazon — ${label}`,
        amount: comisionRound,
        payer: "Amazon",
        method: "Amazon Seller",
        incomeSource: null,
        expenseCategory: "Otros",
      });
    }
  }
  return out;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const transactions = parseRows();

  console.log(`\nMovimientos a importar: ${transactions.length}`);
  for (const t of transactions) {
    console.log(`  ${t.date}  ${t.type.padEnd(8)} $${t.amount.toFixed(2).padStart(9)}  ${t.description}`);
  }
  const ingresos = transactions.filter((t) => t.type === "Ingreso").reduce((s, t) => s + t.amount, 0);
  const egresos = transactions.filter((t) => t.type === "Egreso").reduce((s, t) => s + t.amount, 0);
  console.log(`\n  Total Ingresos: $${ingresos.toFixed(2)}`);
  console.log(`  Total Egresos:  $${egresos.toFixed(2)}`);
  console.log(`  Ganancia neta:  $${(ingresos - egresos).toFixed(2)}`);

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

  const now = Date.now();
  const batch = writeBatch(db);
  for (const t of transactions) {
    batch.set(doc(collection(db, "transactions")), {
      ...t,
      createdAt: now,
      updatedAt: now,
    });
  }
  await batch.commit();

  console.log(`\n✓ Import completo. ${transactions.length} movimientos cargados.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Error en el import:", err?.code ?? err);
  process.exit(1);
});
```

- [ ] **Step 2: Agregar el script a package.json**

En `package.json`, junto a los scripts `import-providers` e `import-transactions`:

```json
    "import-amazon-transactions": "tsx scripts/import-amazon-transactions.ts",
```

- [ ] **Step 3: Correr en modo dry-run y verificar el resumen**

```bash
npm run import-amazon-transactions -- --dry-run
```

Expected: 9 movimientos listados (2026-02 solo Egreso, 2026-03 a 2026-06 Ingreso+Egreso cada uno), con:
- Total Ingresos: $2309.12
- Total Egresos: $1277.65 (aprox, redondeo por mes puede variar el último decimal)
- Ganancia neta: $1031.47 (aprox)

Si los números no coinciden con esto, revisar el parseo antes de continuar (puede ser un problema de encoding BOM o de columnas corridas).

- [ ] **Step 4: Correr el import real**

```bash
npm run import-amazon-transactions
```

Expected: `✓ Import completo. 9 movimientos cargados.`

- [ ] **Step 5: Verificar en el navegador**

Abrir `/admin/finanzas` y confirmar que aparecen los movimientos "Ventas Amazon — <mes>" y "Comisión Amazon — <mes>" en la tabla, y que los totales de Ingresos/Egresos/Balance se actualizaron sumando estos montos a los que ya había de la planilla.

- [ ] **Step 6: Commit**

```bash
git add scripts/import-amazon-transactions.ts package.json
git commit -m "feat: import historical Amazon Seller transactions to Finanzas"
```

No hace falta PR para este script (es un import de datos, no una feature de la app) — confirmá con Nico si prefiere que igual abra uno para que quede registrado, o si alcanza con el commit directo a main.
