import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { parseSettlement } from "../parseSettlement";

const sample = readFileSync(
  new URL("./fixtures/settlement-sample.txt", import.meta.url),
  "utf8",
);

describe("parseSettlement", () => {
  const r = parseSettlement(sample);

  test("extrae el resumen de la liquidación", () => {
    expect(r.settlementId).toBe("26688578961");
    expect(r.periodStart).toBe("2026-06-10");
    expect(r.periodEnd).toBe("2026-06-24");
    expect(r.depositDate).toBe("2026-06-26");
    expect(r.totalAmount).toBe(216.18);
  });

  test("ventas − gastos reconcilia con el total del depósito", () => {
    expect(Math.round((r.ventas - r.gastos) * 100) / 100).toBe(216.18);
    expect(r.reconciles).toBe(true);
    expect(r.ventas).toBeGreaterThan(0);
    expect(r.gastos).toBeGreaterThan(0);
  });

  test("la suscripción sin SKU entra en gastos", () => {
    // El archivo trae una Subscription Fee de -39.99 sin sku.
    expect(r.gastos).toBeGreaterThanOrEqual(39.99);
  });

  test("agrega ventas por SKU con unidades vendidas", () => {
    const celery = r.skuSales.find((s) => s.sku === "FRONTIER-CELERY-30");
    expect(celery).toBeDefined();
    expect(celery!.unitsSold).toBeGreaterThan(0);
    expect(celery!.ventas).toBeGreaterThan(0);
    expect(Math.round((celery!.ventas - celery!.gastosAmazon) * 100) / 100).toBe(
      celery!.neto,
    );
  });

  test("no incluye filas sin SKU en skuSales", () => {
    expect(r.skuSales.every((s) => s.sku !== "")).toBe(true);
  });

  test("rechaza un archivo sin fila de resumen", () => {
    const bad = "settlement-id\tsettlement-start-date\ttotal-amount\n\t\t\n";
    expect(() => parseSettlement(bad)).toThrow();
  });
});
