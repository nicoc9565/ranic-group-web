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
