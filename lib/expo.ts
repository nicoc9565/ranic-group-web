import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import type { ExpoProspect } from "./types";

const COL = "expoProspects";

/** Suscripción en tiempo real a los prospectos de Expo West. Devuelve la función de unsubscribe. */
export function subscribeExpo(cb: (list: ExpoProspect[]) => void) {
  return onSnapshot(collection(db, COL), (snap) => {
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ExpoProspect, "id">),
      })),
    );
  });
}

export function updateProspect(id: string, patch: Partial<ExpoProspect>) {
  return updateDoc(doc(db, COL, id), patch);
}

/** Acción masiva: marcar varios prospectos como contactados (mailSent + dateSent = hoy). */
export function bulkMarkContacted(ids: string[]) {
  const batch = writeBatch(db);
  const today = new Date().toISOString().slice(0, 10);
  for (const id of ids) {
    batch.update(doc(db, COL, id), { mailSent: true, dateSent: today });
  }
  return batch.commit();
}
