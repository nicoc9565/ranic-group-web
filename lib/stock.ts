import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import type { StockItem } from "./types";

const COL = "stockItems";

export function subscribeStock(cb: (items: StockItem[]) => void): () => void {
  return onSnapshot(collection(db, COL), (snap) => {
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<StockItem, "id">),
      })),
    );
  });
}
