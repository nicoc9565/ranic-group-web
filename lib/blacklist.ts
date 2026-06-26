import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import type { BlacklistEntry } from "./types";

const COL = "blacklist";

/** Suscripción en tiempo real a la blacklist. Devuelve la función de unsubscribe. */
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

/**
 * Chequeo flexible (case-insensitive, por inclusión en ambos sentidos) de si un nombre coincide
 * con alguna entrada de la blacklist. Pensado para avisar al crear/editar un proveedor.
 */
export function isBlacklisted(name: string, list: BlacklistEntry[]): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return false;
  return list.some((b) => {
    const bn = b.name.trim().toLowerCase();
    if (!bn) return false;
    return n.includes(bn) || bn.includes(n);
  });
}
