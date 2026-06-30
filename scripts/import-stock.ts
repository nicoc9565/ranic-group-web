/**
 * Import del snapshot de inventario FBA de Amazon a la colección `stockItems`. Ver spec
 * docs/superpowers/specs/2026-06-30-stock-design.md.
 *
 * El CSV usa headers estables (a diferencia del de Finanzas de la planilla), así que se
 * parsea con columns: true.
 *
 * Uso:
 *   npm run import-stock -- --dry-run   (solo parsea y reporta)
 *   npm run import-stock                (escribe; necesita SEED_USER_PASSWORD)
 */
import { readFileSync } from "node:fs";
import "./env";
import { parse } from "csv-parse/sync";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, doc, writeBatch } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import type { StockItem } from "../lib/types";

const CSV_PATH =
  "C:/Nico-Archivos/ClaudeCode/Ranic-Group/Inventario de Logística de Amazon.csv";

type ParsedStockItem = Omit<StockItem, "id" | "createdAt">;

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

function parseRows(): ParsedStockItem[] {
  const csv = readFileSync(CSV_PATH, "utf8");
  const rows: CsvRow[] = parse(csv, {
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

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const items = parseRows();

  console.log(`\nProductos a importar: ${items.length}`);
  for (const it of items) {
    console.log(
      `  ${it.sku.padEnd(24)} disp=${String(it.available).padStart(4)}  ${it.healthStatus || "—"}`,
    );
  }
  const totalAvailable = items.reduce((s, it) => s + it.available, 0);
  const totalValue = items.reduce((s, it) => s + it.available * it.price, 0);
  console.log(`\n  Unidades disponibles: ${totalAvailable}`);
  console.log(`  Valor de inventario:  $${totalValue.toFixed(2)}`);

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
  for (const it of items) {
    batch.set(doc(collection(db, "stockItems")), {
      ...it,
      createdAt: now,
    });
  }
  await batch.commit();

  console.log(`\n✓ Import completo. ${items.length} productos cargados.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Error en el import:", err?.code ?? err);
  process.exit(1);
});
