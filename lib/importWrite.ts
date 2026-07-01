import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import type { ParsedStockItem } from "./parseInventoryCsv";
import type { SettlementParseResult } from "./parseSettlement";
import { buildSettlementDocs } from "./settlementDocs";
import type { StockItem } from "./types";

const TX = "transactions";
const SKU = "amazonSkuSales";
const STOCK = "stockItems";

/** ¿Ya existe una liquidación importada con este settlement-id? */
export async function settlementExists(settlementId: string): Promise<boolean> {
  const snap = await getDocs(
    query(collection(db, TX), where("importPeriod", "==", settlementId)),
  );
  return !snap.empty;
}

/** Nombre de producto por SKU, tomado del snapshot de stock más reciente. */
async function productNameBySku(): Promise<Map<string, string>> {
  const snap = await getDocs(collection(db, STOCK));
  const latest = new Map<string, { date: string; name: string }>();
  snap.forEach((d) => {
    const it = d.data() as StockItem;
    const prev = latest.get(it.sku);
    if (!prev || it.snapshotDate > prev.date) {
      latest.set(it.sku, { date: it.snapshotDate, name: it.productName });
    }
  });
  const map = new Map<string, string>();
  for (const [sku, v] of latest) map.set(sku, v.name);
  return map;
}

/**
 * Escribe (o reemplaza) una liquidación: 2 movimientos + N ventas por SKU, en un solo batch.
 * Si `replace`, borra primero los documentos existentes de esa liquidación.
 */
export async function importSettlement(
  result: SettlementParseResult,
  replace: boolean,
): Promise<void> {
  const names = await productNameBySku();

  const toDelete: Parameters<ReturnType<typeof writeBatch>["delete"]>[0][] = [];
  if (replace) {
    const txSnap = await getDocs(
      query(collection(db, TX), where("importPeriod", "==", result.settlementId)),
    );
    const skuSnap = await getDocs(
      query(collection(db, SKU), where("settlementId", "==", result.settlementId)),
    );
    txSnap.forEach((d) => toDelete.push(d.ref));
    skuSnap.forEach((d) => toDelete.push(d.ref));
  }

  const now = Date.now();
  const { transactions, skuSales } = buildSettlementDocs(result, names, now);

  const batch = writeBatch(db);
  for (const ref of toDelete) batch.delete(ref);
  for (const t of transactions) batch.set(doc(collection(db, TX)), t);
  for (const s of skuSales) batch.set(doc(collection(db, SKU)), s);
  await batch.commit();
}

/** ¿Ya existe un snapshot de inventario con esta fecha? */
export async function inventorySnapshotExists(
  snapshotDate: string,
): Promise<boolean> {
  const snap = await getDocs(
    query(collection(db, STOCK), where("snapshotDate", "==", snapshotDate)),
  );
  return !snap.empty;
}

/**
 * Escribe (o reemplaza) un snapshot de inventario. Si `replace`, borra primero TODOS los
 * stockItems con esa snapshotDate (el inventario es un corte completo, no hay filas a mano).
 */
export async function importInventory(
  items: ParsedStockItem[],
  replace: boolean,
): Promise<void> {
  const snapshotDate = items[0]?.snapshotDate ?? "";

  const toDelete: Parameters<ReturnType<typeof writeBatch>["delete"]>[0][] = [];
  if (replace) {
    const snap = await getDocs(
      query(collection(db, STOCK), where("snapshotDate", "==", snapshotDate)),
    );
    snap.forEach((d) => toDelete.push(d.ref));
  }

  const now = Date.now();
  const batch = writeBatch(db);
  for (const ref of toDelete) batch.delete(ref);
  for (const it of items) {
    batch.set(doc(collection(db, STOCK)), {
      ...it,
      importSource: "amazon-inventory",
      importPeriod: snapshotDate,
      createdAt: now,
    });
  }
  await batch.commit();
}
