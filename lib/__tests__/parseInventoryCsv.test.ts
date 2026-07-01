import { describe, expect, test } from "vitest";
import { parseInventoryCsv } from "../parseInventoryCsv";

const CSV = `snapshot-date,sku,asin,product-name,available,units-shipped-t30,units-shipped-t90,days-of-supply,your-price,fba-inventory-level-health-status,alert
2026-06-30,FRONTIER-CELERY-30,B01ABC,Frontier Celery Seed,42,10,30,,8.44,Healthy,
2026-06-30,SO-ONION-3,B02XYZ,Simply Organic Onion,0,0,0,,7.60,Low stock,Low traffic`;

describe("parseInventoryCsv", () => {
  test("mapea columnas del CSV a ParsedStockItem", () => {
    const rows = parseInventoryCsv(CSV);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      snapshotDate: "2026-06-30",
      sku: "FRONTIER-CELERY-30",
      asin: "B01ABC",
      productName: "Frontier Celery Seed",
      available: 42,
      unitsShipped30: 10,
      unitsShipped90: 30,
      daysOfSupply: null,
      price: 8.44,
      healthStatus: "Healthy",
      alert: "",
    });
  });

  test("days-of-supply vacío → null; numéricos vacíos → 0", () => {
    const rows = parseInventoryCsv(CSV);
    expect(rows[1].daysOfSupply).toBeNull();
    expect(rows[1].available).toBe(0);
    expect(rows[1].alert).toBe("Low traffic");
  });
});
