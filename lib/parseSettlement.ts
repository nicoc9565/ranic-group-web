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

    const agg = bySku.get(sku) ?? {
      sku,
      unitsSold: 0,
      ventas: 0,
      gastosAmazon: 0,
      neto: 0,
    };

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
