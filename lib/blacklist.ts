import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { BlacklistEntry } from "./types";

// El match vive aparte porque es lógica pura y este módulo inicializa Firebase.
export { isBlacklisted, MIN_INCLUSION_LENGTH } from "./blacklistMatch";

const COL = "blacklist";

/**
 * Suscripción en tiempo real a la blacklist. Devuelve la función de unsubscribe.
 *
 * Baja la colección entera. Con decenas de entradas es lo correcto y no hay nada que optimizar.
 * Si algún día pasa de unos cientos, hay que acotarla igual que Proveedores (query paginada con
 * cursor); el proyecto está en el plan Spark, con 50.000 lecturas por día para toda la app.
 */
export function subscribeBlacklist(cb: (list: BlacklistEntry[]) => void) {
  return onSnapshot(collection(db, COL), (snap) => {
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<BlacklistEntry, "id">),
      })),
    );
  });
}

export function addBlacklistEntry(name: string) {
  return addDoc(collection(db, COL), { name: name.trim() });
}

export function updateBlacklistEntry(id: string, name: string) {
  return updateDoc(doc(db, COL, id), { name: name.trim() });
}

export function removeBlacklistEntry(id: string) {
  return deleteDoc(doc(db, COL, id));
}
