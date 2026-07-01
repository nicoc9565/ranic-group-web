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
