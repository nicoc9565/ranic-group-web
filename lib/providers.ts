import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { NoteEntry, Provider } from "./types";

const COL = "providers";

/** Datos de un proveedor sin los campos que el sistema gestiona (id/timestamps). */
export type ProviderInput = Omit<Provider, "id" | "createdAt" | "updatedAt">;

/** Suscripción en tiempo real a la colección providers. Devuelve la función de unsubscribe. */
export function subscribeProviders(cb: (providers: Provider[]) => void) {
  return onSnapshot(collection(db, COL), (snap) => {
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Provider, "id">),
      })),
    );
  });
}

export function addProvider(data: ProviderInput) {
  const now = Date.now();
  return addDoc(collection(db, COL), { ...data, createdAt: now, updatedAt: now });
}

export function updateProvider(id: string, patch: Partial<Provider>) {
  return updateDoc(doc(db, COL, id), { ...patch, updatedAt: Date.now() });
}

export function deleteProvider(id: string) {
  return deleteDoc(doc(db, COL, id));
}

/** Agrega una nota al log solo-append (no edita las existentes). */
export function addNote(id: string, note: NoteEntry) {
  return updateDoc(doc(db, COL, id), {
    notes: arrayUnion(note),
    updatedAt: Date.now(),
  });
}
