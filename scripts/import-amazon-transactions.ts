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
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
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

  const byMonth = new Map<
    string,
    { year: number; month: number; venta: number; total: number }
  >();

  for (const row of rows.slice(1)) {
    // Columnas: 0 Fecha · 4 Cargos por producto (total) · 8 Total (USD).
    const [fecha, , , , cargos, , , , totalUsd] = row;
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
    console.log(
      `  ${t.date}  ${t.type.padEnd(8)} $${t.amount.toFixed(2).padStart(9)}  ${t.description}`,
    );
  }
  const ingresos = transactions
    .filter((t) => t.type === "Ingreso")
    .reduce((s, t) => s + t.amount, 0);
  const egresos = transactions
    .filter((t) => t.type === "Egreso")
    .reduce((s, t) => s + t.amount, 0);
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
