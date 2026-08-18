import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import type { NoteEntry, Provider, Status } from "./types";

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
  return addDoc(collection(db, COL), {
    ...data,
    companyLower: data.company.toLowerCase(),
    createdAt: now,
    updatedAt: now,
  });
}

export function updateProvider(id: string, patch: Partial<Provider>) {
  // companyLower es derivado: se recalcula acá y no en el formulario, así ningún lugar del CRM
  // puede dejar el índice de búsqueda desincronizado con el nombre real.
  const derived =
    patch.company !== undefined
      ? { companyLower: patch.company.toLowerCase() }
      : {};
  return updateDoc(doc(db, COL, id), { ...patch, ...derived, updatedAt: Date.now() });
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

// ── Consultas acotadas para el Dashboard ──────────────────────────────────
// El Dashboard NO se suscribe a la colección entera: con 2500 proveedores eso son 2500 lecturas
// por visita para mostrar cuatro números y tres listas cortas. Los contadores se resuelven con
// agregaciones (1 lectura cada una) y las listas con queries de un solo campo, que no necesitan
// índices compuestos nuevos.

const providersCol = () => collection(db, COL);

/** Cantidad total de proveedores, sin bajar un solo documento. */
export async function countProviders(): Promise<number> {
  const snap = await getCountFromServer(providersCol());
  return snap.data().count;
}

/** Cantidad de proveedores en alguno de los status dados, sin bajar los documentos. */
export async function countProvidersByStatus(statuses: Status[]): Promise<number> {
  const snap = await getCountFromServer(
    query(providersCol(), where("status", "in", statuses)),
  );
  return snap.data().count;
}

const ATTENTION_LIMIT = 50;

function toProviders(docs: { id: string; data: () => unknown }[]): Provider[] {
  return docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Provider, "id">) }));
}

/**
 * Proveedores con respuesta detectada por el cron. Se filtra por campo, no por el texto de las
 * notas: el match por string se rompía en silencio si alguien retocaba el texto.
 * `> 0` excluye los documentos donde el campo falta o es null, así que es una query de un solo
 * campo y no hace falta índice compuesto.
 */
export async function fetchRepliedProviders(): Promise<Provider[]> {
  const snap = await getDocs(
    query(providersCol(), where("replyDetectedAt", ">", 0), limit(ATTENTION_LIMIT)),
  );
  return toProviders(snap.docs);
}

/** Proveedores con rebote duro registrado. */
export async function fetchHardBouncedProviders(): Promise<Provider[]> {
  const snap = await getDocs(
    query(providersCol(), where("bounceType", "==", "hard"), limit(ATTENTION_LIMIT)),
  );
  return toProviders(snap.docs);
}

/**
 * Candidatos a follow-up: todos los proveedores que fueron contactados alguna vez.
 *
 * `> ""` deja afuera los que tienen firstContactDate en null o ausente (en Firestore null ordena
 * antes que cualquier string). Hoy son 84 documentos contra 2502: el filtro hace el trabajo.
 *
 * SIN limit, a propósito. La versión anterior bajaba los N más viejos por fecha, asumiendo que el
 * outreach frío —siempre más nuevo— quedaba al final y no desplazaba a nadie. Es falso: hay dos
 * proveedores manuales con firstContactDate en el futuro (2026-11-03 y 2026-11-04), así que en
 * cuanto la campaña acumule unos cientos de envíos esos dos se caen de la ventana y sus follow-ups
 * desaparecen de la pantalla sin ningún error. Un límite que descarta datos correctos en silencio
 * no es una optimización, es un bug con fecha de activación.
 *
 * El costo real es que esto crece con la campaña (~900 documentos cuando termine). Si molesta, la
 * solución no es recortar la ventana sino hacer queryable "no es outreach frío": escribir
 * source: "manual" en los ~82 heredados y filtrar con not-in. Requiere migración, así que queda
 * como decisión aparte.
 *
 * El estado real lo calcula followUpStatus sobre estos documentos, que ya descarta el outreach
 * frío (ver el guard en lib/followup.ts).
 */
export async function fetchFollowUpCandidates(): Promise<Provider[]> {
  const snap = await getDocs(
    query(
      providersCol(),
      where("firstContactDate", ">", ""),
      orderBy("firstContactDate", "asc"),
    ),
  );
  return toProviders(snap.docs);
}
