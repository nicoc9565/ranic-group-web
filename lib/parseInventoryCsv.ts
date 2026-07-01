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
