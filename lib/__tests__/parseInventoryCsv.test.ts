import { describe, expect, test } from "vitest";
import { parseInventoryCsv } from "../parseInventoryCsv";

const CSV = `snapshot-date,sku,asin,product-name,available,units-shipped-t30,units-shipped-t90,days-of-supply,your-price,fba-inventory-level-health-status,alert
2026-06-30,FRONTIER-CELERY-30,B01ABC,Frontier Celery Seed,42,10,30,,8.44,Healthy,
2026-06-30,SO-ONION-3,B02XYZ,Simply Organic Onion,0,0,0,,7.60,Low stock,Low traffic`;

const TSV = `snapshot-date\tsku\tasin\tproduct-name\tavailable\tunits-shipped-t30\tunits-shipped-t90\tdays-of-supply\tyour-price\tfba-inventory-level-health-status\talert
2026-06-30\tFRONTIER-CELERY-30\tB01ABC\tFrontier Celery Seed\t42\t10\t30\t\t8.44\tHealthy\t
2026-06-30\tSO-ONION-3\tB02XYZ\tSimply Organic Onion\t0\t0\t0\t\t7.60\tLow stock\tLow traffic`;

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

  test("TXT tab-separado da el mismo resultado que el CSV", () => {
    expect(parseInventoryCsv(TSV)).toEqual(parseInventoryCsv(CSV));
  });
});
