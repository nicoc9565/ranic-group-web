import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import type { AmazonSkuSale } from "./types";

const COL = "amazonSkuSales";

/** Suscripción en tiempo real a las ventas de Amazon por SKU. Devuelve el unsubscribe. */
export function subscribeAmazonSkuSales(
  cb: (sales: AmazonSkuSale[]) => void,
): () => void {
  return onSnapshot(collection(db, COL), (snap) => {
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<AmazonSkuSale, "id">),
      })),
    );
  });
}
