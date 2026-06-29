import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Transaction } from "./types";

const COL = "transactions";

/** Datos de un movimiento sin los campos que el sistema gestiona (id/timestamps). */
export type TransactionInput = Omit<Transaction, "id" | "createdAt" | "updatedAt">;

/** Suscripción en tiempo real a la colección transactions. Devuelve la función de unsubscribe. */
export function subscribeTransactions(cb: (transactions: Transaction[]) => void) {
  return onSnapshot(collection(db, COL), (snap) => {
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Transaction, "id">),
      })),
    );
  });
}

export function addTransaction(data: TransactionInput) {
  const now = Date.now();
  return addDoc(collection(db, COL), {
    ...data,
    createdAt: now,
    updatedAt: now,
  });
}

export function updateTransaction(id: string, patch: Partial<Transaction>) {
  return updateDoc(doc(db, COL, id), { ...patch, updatedAt: Date.now() });
}

export function deleteTransaction(id: string) {
  return deleteDoc(doc(db, COL, id));
}
