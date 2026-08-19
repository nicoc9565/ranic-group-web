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

/**
 * El match vive aparte porque es lógica pura y este módulo inicializa Firebase.
 *
 * ── HUECO CONOCIDO, no es un olvido ────────────────────────────────────────────────────────
 * Esta colección es un filtro de ENTRADA: `isBlacklisted` corre en UN solo lugar, el formulario
 * de crear/editar proveedor (components/ProviderForm.tsx), y solo para avisar.
 *
 * Agregar un nombre acá NO toca a los proveedores ya importados que coincidan. Siguen con
 * `blacklisted: false`, en su bucket, y —lo que importa— siguen siendo candidatos del envío
 * automático: `send-batch` filtra por los campos del documento, nunca consulta esta colección
 * (ver lib/sendCandidate.ts). O sea que bloquear una empresa desde esta pantalla no impide que
 * el cron le siga mandando mails si ya estaba en `providers`.
 *
 * Para sacar a un proveedor concreto de la campaña hay que marcarlo desde su ficha o desde el
 * formulario, que van los dos por `setBlacklisted` (lib/providers.ts).
 *
 * No se propaga a propósito: al escribirse esto, cero de los 2502 proveedores coincidía con
 * alguna de las 26 entradas, y automatizar una propagación por un caso hipotético es un cambio
 * de datos sin nada que arregle. Si algún día Nico agrega una empresa que YA está importada, hay
 * que marcarla a mano — o recién ahí escribir la propagación.
 */
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
