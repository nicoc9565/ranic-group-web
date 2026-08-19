import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Provider } from "./types";

/**
 * Métricas y tablas del panel de Outreach, por agregación en vez de suscripción.
 *
 * La pantalla bajaba los 2502 documentos de `providers` en cada visita para mostrar cuatro
 * números y una tabla de 20 filas. Con el tope diario de 50.000 lecturas del plan Spark eso son
 * ~19 visitas por día entre Dashboard, Outreach y Proveedores: no hay margen.
 *
 * Un count() se factura 1 lectura cada 1000 entradas de índice, así que las cuatro métricas
 * juntas cuestan del orden de una decena de lecturas.
 */

const COL = "providers";
const providersCol = () => collection(db, COL);

/** El source de la campaña. Los proveedores manuales no son parte del outreach automático. */
const OUTREACH_SOURCE = "expo-outreach-import";

/** Tope de filas de las tablas de diagnóstico. No hace falta ver más para saber qué está pasando. */
const TABLE_LIMIT = 20;

async function count(q: Parameters<typeof getCountFromServer>[0]): Promise<number> {
  return (await getCountFromServer(q)).data().count;
}

export type OutreachStats = {
  eligible: number;
  pending: number;
  contacted: number;
  replies: number;
};

export async function fetchOutreachStats(): Promise<OutreachStats> {
  const [eligible, pending, contacted, replies] = await Promise.all([
    count(
      query(
        providersCol(),
        where("source", "==", OUTREACH_SOURCE),
        where("outreachEligible", "==", true),
      ),
    ),
    // Exactamente los mismos seis filtros que usa send-batch, con count() en vez de limit(): así
    // el número que se muestra es el que el cron va a encontrar, y reusa el índice compuesto que
    // ya existe en vez de pedir uno nuevo.
    count(
      query(
        providersCol(),
        where("status", "==", "Por Contactar"),
        where("contactMethod", "==", "Email"),
        where("source", "==", OUTREACH_SOURCE),
        where("outreachEligible", "==", true),
        where("optedOut", "==", false),
        where("sendAttemptedAt", "==", null),
      ),
    ),
    count(
      query(
        providersCol(),
        where("source", "==", OUTREACH_SOURCE),
        where("sendAttemptedAt", ">", 0),
      ),
    ),
    // Respuestas por campo, no por el texto de una nota (ver Provider.replyDetectedAt).
    count(
      query(
        providersCol(),
        where("source", "==", OUTREACH_SOURCE),
        where("status", "==", "Contactado"),
        where("replyDetectedAt", ">", 0),
      ),
    ),
  ]);
  return { eligible, pending, contacted, replies };
}

function toProviders(docs: { id: string; data: () => unknown }[]): Provider[] {
  return docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Provider, "id">) }));
}

/**
 * Envíos que se INTENTARON y fallaron. El discriminador es el campo `sendError`, no
 * `sendAttemptedAt == null`: ese último funciona hoy por casualidad y se rompe el día que otro
 * código escriba el campo.
 */
export async function fetchFailedSends(): Promise<Provider[]> {
  const snap = await getDocs(
    query(
      providersCol(),
      where("sendError", ">", ""),
      orderBy("sendError"),
      orderBy("sendAttemptedAt", "desc"),
      limit(TABLE_LIMIT),
    ),
  );
  return toProviders(snap.docs);
}

/** Excluidos ANTES de enviar: nunca se intentó mandarles nada (ver Provider.excludedReason). */
export async function fetchExcluded(): Promise<Provider[]> {
  const snap = await getDocs(
    query(
      providersCol(),
      where("excludedReason", ">", ""),
      orderBy("excludedReason"),
      orderBy("updatedAt", "desc"),
      limit(TABLE_LIMIT),
    ),
  );
  return toProviders(snap.docs);
}
