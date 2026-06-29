/**
 * Import histórico de movimientos financieros desde el CSV de la planilla de Nico a la
 * colección `transactions`. Ver spec
 * docs/superpowers/specs/2026-06-29-crm-finanzas-design.md.
 *
 * El CSV tiene, además de las 9 columnas con datos reales (Fecha..Año), una caja de
 * resumen suelta en columnas a la derecha (Ingresos/Egresos/Balance ya calculados de la
 * propia planilla) — se ignora completamente parseando por posición de columna en vez de
 * por nombre de header, así no hay colisión con esas celdas sueltas.
 *
 * Uso:
 *   npm run import-transactions -- --dry-run   (solo parsea y reporta, no escribe)
 *   npm run import-transactions                (escribe; necesita SEED_USER_PASSWORD)
 */
import { readFileSync } from "node:fs";
import "./env";
import { parse } from "csv-parse/sync";
import { signInWithEmailAndPassword } from "firebase/auth";
import {
  collection,
  doc,
  getCountFromServer,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { inferExpenseCategory, inferIncomeSource } from "../lib/financeCategory";
import type { Transaction, TransactionType } from "../lib/types";

const CSV_PATH =
  "C:/Nico-Archivos/ClaudeCode/Ranic-Group/Finanzas_Ranic_Group_LLC.csv";

type ParsedTransaction = Omit<Transaction, "id" | "createdAt" | "updatedAt">;

/** "12/01/26" → "2026-01-12". null si no matchea el formato esperado. */
function parseSpanishDate(value: string): string | null {
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `20${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** "$1,749.00" → 1749. NaN si no se puede parsear (la fila se descarta). */
function parseAmount(value: string): number {
  return Number(value.trim().replace(/[$,]/g, ""));
}

function parseRows(): ParsedTransaction[] {
  const csv = readFileSync(CSV_PATH, "utf8");
  // skip_empty_lines + parseo por posición (sin columns:true) para no chocar con las
  // columnas vacías/duplicadas de la caja de resumen suelta del CSV.
  const rows: string[][] = parse(csv, { skip_empty_lines: true });

  const out: ParsedTransaction[] = [];
  for (const row of rows.slice(1)) {
    const [fecha, tipoRaw, descripcion, montoRaw, payer, method] = row;

    const date = parseSpanishDate(fecha ?? "");
    const amount = parseAmount(montoRaw ?? "");
    const description = (descripcion ?? "").trim();
    const type: TransactionType =
      tipoRaw?.trim() === "Ingreso" ? "Ingreso" : "Egreso";

    if (!date || !description || !Number.isFinite(amount) || amount <= 0) {
      continue; // fila incompleta o de la caja de resumen, se descarta
    }

    out.push({
      date,
      type,
      description,
      amount,
      payer: (payer ?? "").trim(),
      method: (method ?? "").trim(),
      incomeSource: type === "Ingreso" ? inferIncomeSource(description) : null,
      expenseCategory:
        type === "Egreso" ? inferExpenseCategory(description) : null,
    });
  }
  return out;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const transactions = parseRows();

  console.log(`\nMovimientos a importar: ${transactions.length}`);
  const ingresos = transactions
    .filter((t) => t.type === "Ingreso")
    .reduce((s, t) => s + t.amount, 0);
  const egresos = transactions
    .filter((t) => t.type === "Egreso")
    .reduce((s, t) => s + t.amount, 0);
  console.log(`  Ingresos: $${ingresos.toFixed(2)}`);
  console.log(`  Egresos:  $${egresos.toFixed(2)}`);
  console.log(`  Balance:  $${(ingresos - egresos).toFixed(2)}`);

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
  const CHUNK = 50;
  for (let i = 0; i < transactions.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const t of transactions.slice(i, i + CHUNK)) {
      batch.set(doc(collection(db, "transactions")), {
        ...t,
        createdAt: now,
        updatedAt: now,
      });
    }
    await batch.commit();
  }

  const total = (
    await getCountFromServer(collection(db, "transactions"))
  ).data().count;
  console.log(`\n✓ Import completo. transactions en Firestore: ${total}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Error en el import:", err?.code ?? err);
  process.exit(1);
});
