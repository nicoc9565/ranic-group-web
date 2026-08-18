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
    // source SIEMPRE presente. Es lo que hace queryable "no es outreach frío" en
    // fetchFollowUpCandidates: si un proveedor nuevo se creara sin el campo, no aparecería nunca
    // en el Dashboard y nada se pondría en rojo.
    source: data.source ?? "manual",
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

/**
 * Contactados POR EL PROGRAMA: los que el envío automático intentó mandar.
 *
 * Es distinto de "contactados en total", que incluye a los que Nico contactó a mano hace meses.
 * Estaban bajo la misma etiqueta y daba 13 con la campaña sin haber mandado un solo email: 3
 * documentos de prueba más ~10 manuales. Medía bien, decía otra cosa.
 */
export async function countAutoContacted(): Promise<number> {
  const snap = await getCountFromServer(
    query(providersCol(), where("sendAttemptedAt", ">", 0)),
  );
  return snap.data().count;
}

/** Contactados en total: cualquiera que haya salido de "Por Contactar", a mano o por el programa. */
export async function countEverContacted(): Promise<number> {
  const snap = await getCountFromServer(
    query(providersCol(), where("status", "!=", "Por Contactar")),
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
 * Candidatos a follow-up: los proveedores que pueden tener una secuencia manual corriendo.
 *
 * DOS queries de igualdad, unidas en el cliente:
 *   source == "manual"        → los que carga Nico (addProvider lo escribe siempre).
 *   followUpForced == true    → outreach frío que Nico metió a mano a la secuencia.
 *
 * Ninguna depende de la AUSENCIA de un campo, que es la trampa de Firestore que ya nos costó una
 * feature entera: tanto `not-in` como `orderBy` descartan en silencio los documentos que no
 * tienen el campo, así que un proveedor creado sin `source` habría desaparecido de la pantalla
 * sin que nada fallara. Las dos son de un solo campo: no hacen falta índices compuestos.
 *
 * Esto reemplazó a una ventana de los N más viejos por firstContactDate, que asumía que el
 * outreach frío —siempre más nuevo— quedaba al final. Era falso: hay proveedores manuales con
 * fecha en el futuro (2026-11-03, 2026-11-04) que se habrían caído de la ventana a medida que la
 * campaña acumulaba envíos. Un límite que descarta datos correctos en silencio no es una
 * optimización, es un bug con fecha de activación.
 *
 * El estado real lo calcula followUpStatus sobre estos documentos.
 */
export async function fetchFollowUpCandidates(): Promise<Provider[]> {
  const [manual, forced] = await Promise.all([
    getDocs(query(providersCol(), where("source", "==", "manual"))),
    getDocs(query(providersCol(), where("followUpForced", "==", true))),
  ]);
  const byId = new Map<string, Provider>();
  for (const p of [...toProviders(manual.docs), ...toProviders(forced.docs)]) {
    byId.set(p.id, p);
  }
  return [...byId.values()];
}
