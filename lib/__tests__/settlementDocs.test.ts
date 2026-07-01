import { describe, expect, test } from "vitest";
import type { SettlementParseResult } from "../parseSettlement";
import { buildSettlementDocs } from "../settlementDocs";

const result: SettlementParseResult = {
  settlementId: "S1",
  periodStart: "2026-06-10",
  periodEnd: "2026-06-24",
  depositDate: "2026-06-26",
  totalAmount: 100,
  ventas: 300,
  gastos: 200,
  skuSales: [
    { sku: "FRONTIER-CELERY-30", unitsSold: 5, ventas: 40, gastosAmazon: 15, neto: 25 },
    { sku: "UNKNOWN-SKU", unitsSold: 2, ventas: 20, gastosAmazon: 8, neto: 12 },
  ],
  reconciles: true,
};

describe("buildSettlementDocs", () => {
  const names = new Map([["FRONTIER-CELERY-30", "Frontier Celery Seed"]]);
  const { transactions, skuSales } = buildSettlementDocs(result, names, 1000);

  test("crea 2 movimientos etiquetados con el settlement-id", () => {
    expect(transactions).toHaveLength(2);
    const ingreso = transactions.find((t) => t.type === "Ingreso")!;
    const egreso = transactions.find((t) => t.type === "Egreso")!;
    expect(ingreso.amount).toBe(300);
    expect(ingreso.incomeSource).toBe("Venta");
    expect(ingreso.date).toBe("2026-06-26");
    expect(ingreso.importPeriod).toBe("S1");
    expect(egreso.amount).toBe(200);
    expect(egreso.expenseCategory).toBe("Comisión Amazon");
    expect(egreso.importSource).toBe("amazon-settlement");
  });

  test("neto de los 2 movimientos = total depositado", () => {
    const ingreso = transactions.find((t) => t.type === "Ingreso")!;
    const egreso = transactions.find((t) => t.type === "Egreso")!;
    expect(ingreso.amount - egreso.amount).toBe(100);
  });

  test("resuelve productName desde stock; '' si no hay match", () => {
    expect(skuSales).toHaveLength(2);
    expect(skuSales[0].productName).toBe("Frontier Celery Seed");
    expect(skuSales[1].productName).toBe("");
    expect(skuSales[0].settlementId).toBe("S1");
    expect(skuSales[0].importSource).toBe("amazon-settlement");
  });

  test("omite un movimiento si su monto es 0", () => {
    const zero = buildSettlementDocs({ ...result, gastos: 0 }, names, 1000);
    expect(zero.transactions).toHaveLength(1);
    expect(zero.transactions[0].type).toBe("Ingreso");
  });
});
