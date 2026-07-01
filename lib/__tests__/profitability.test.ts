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
