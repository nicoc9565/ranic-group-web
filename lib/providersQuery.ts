import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentSnapshot,
  type QueryConstraint,
} from "firebase/firestore";
import { NO_REPLY_DAYS, type ContactStage } from "./contactStage";
import { db } from "./firebase";
import type { Category, Provider } from "./types";

/**
 * Consultas server-side de la pantalla de Proveedores.
 *
 * Antes bajaba los 2502 documentos en cada visita y filtraba en memoria. Con el tope diario de
 * 50.000 lecturas del plan Spark eso es insostenible: una visita se comía el 5% del día.
 *
 * El filtro por etapa se apoya en `Provider.bucket`, la etapa ya resuelta. La única distinción
 * que NO está en el campo es contactado/sin-respuesta, porque depende del paso del tiempo: se
 * resuelve acá comparando firstContactDate contra el corte.
 */

const COL = "providers";
const providersCol = () => collection(db, COL);

export const PAGE_SIZE = 100;

/**
 * Fecha de corte entre "contactado" y "sin respuesta", en yyyy-mm-dd.
 * firstContactDate es un string con ese formato, así que la comparación lexicográfica de Firestore
 * ordena igual que la cronológica.
 */
export function noReplyCutoff(today: Date): string {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() - NO_REPLY_DAYS);
  return d.toISOString().slice(0, 10);
}

/**
 * Filtros de Firestore equivalentes a una etapa.
 *
 * El borde entre contactado y sin-respuesta replica EXACTAMENTE el de contactStage:
 * `daysSince > NO_REPLY_DAYS` es sin-respuesta, o sea que el día 14 clavado todavía es contactado.
 * Traducido a fechas: firstContactDate >= corte es contactado, < corte es sin-respuesta. Si esto
 * se corriera un día, un proveedor aparecería en una etapa en la tabla y en otra en su ficha.
 *
 * El orden es ASCENDENTE (más viejo primero) y no es una preferencia estética: Firestore NO reusa
 * un índice ascendente para un orderBy descendente cuando hay igualdades adelante, así que un
 * `desc` acá pediría dos índices más, con la sola diferencia de la dirección. Y ascendente es
 * además el orden útil en las dos etapas: en sin-respuesta son los más rancios, y en contactado
 * los que están por cruzar el corte.
 */
function stageConstraints(
  stage: ContactStage,
  cutoff: string,
  category: Category | "",
): QueryConstraint[] {
  // Firestore indexa por CAMPO, no por valor: `category` es un filtro de igualdad, así que un
  // solo índice (bucket, category, …) cubre las ocho categorías.
  const cat = category ? [where("category", "==", category)] : [];
  if (stage === "contactado") {
    return [
      where("bucket", "==", "contactado"),
      ...cat,
      where("firstContactDate", ">=", cutoff),
      orderBy("firstContactDate", "asc"),
    ];
  }
  if (stage === "sin-respuesta") {
    return [
      where("bucket", "==", "contactado"),
      ...cat,
      where("firstContactDate", "<", cutoff),
      orderBy("firstContactDate", "asc"),
    ];
  }
  return [where("bucket", "==", stage), ...cat, orderBy("companyLower", "asc")];
}

/**
 * Búsqueda por prefijo sobre companyLower: un rango [q, q+U+F8FF].
 * U+F8FF es el último caracter del Área de Uso Privado de Unicode, así que ordena después de
 * cualquier caracter que pueda aparecer en un nombre real. Es el truco estándar de Firestore para
 * "empieza con", que no tiene operador propio.
 */
function searchConstraints(term: string): QueryConstraint[] {
  const q = term.trim().toLowerCase();
  if (!q) return [];
  return [
    where("companyLower", ">=", q),
    where("companyLower", "<=", `${q}\uf8ff`),
  ];
}

export const ALL_STAGES: ContactStage[] = [
  "sin-contactar",
  "contactado",
  "sin-respuesta",
  "respondio",
  "cuenta",
  "rebotado",
  "descartado",
];

/**
 * Los 7 contadores por etapa más el total, respetando el filtro de categoría.
 *
 * count() se factura 1 lectura cada 1000 entradas de índice, así que los ocho juntos cuestan del
 * orden de 20 lecturas contra las 2502 de bajar la colección.
 *
 * Los contadores usan EXACTAMENTE los mismos filtros que la tabla. Si mostraran el total sin
 * categoría mientras la tabla filtra, el número de arriba contradiría a las filas de abajo.
 */
export async function countByStage(
  today: Date,
  category: Category | "" = "",
): Promise<{ total: number; byStage: Record<ContactStage, number> }> {
  const cutoff = noReplyCutoff(today);
  const totalQuery = category
    ? query(providersCol(), where("category", "==", category))
    : query(providersCol());
  const [total, ...counts] = await Promise.all([
    getCountFromServer(totalQuery).then((s) => s.data().count),
    ...ALL_STAGES.map((stage) =>
      getCountFromServer(
        query(providersCol(), ...stageConstraints(stage, cutoff, category)),
      ).then((s) => s.data().count),
    ),
  ]);
  const byStage = Object.fromEntries(
    ALL_STAGES.map((s, i) => [s, counts[i]]),
  ) as Record<ContactStage, number>;
  return { total, byStage };
}

export type ProviderPage = {
  rows: Provider[];
  /** Último documento de la página, para pedir la siguiente. null = no hay más. */
  cursor: DocumentSnapshot | null;
};

/**
 * Una página de proveedores de una etapa.
 *
 * La búsqueda por prefijo y el corte temporal usan campos distintos, así que no se pueden combinar
 * en la misma query. Cuando hay búsqueda dentro de contactado o sin-respuesta se consulta el
 * bucket completo y el corte se aplica sobre la página traída: son como mucho PAGE_SIZE filas y el
 * resultado es el mismo. La categoría sí va siempre server-side — es igualdad y entra en el índice.
 */
export async function fetchProviderPage(opts: {
  stage: ContactStage;
  search: string;
  category: Category | "";
  today: Date;
  cursor?: DocumentSnapshot | null;
}): Promise<ProviderPage> {
  const { stage, search, category, today, cursor } = opts;
  const cutoff = noReplyCutoff(today);
  const searching = search.trim() !== "";
  const temporal = stage === "contactado" || stage === "sin-respuesta";
  const cat = category ? [where("category", "==", category)] : [];

  const constraints: QueryConstraint[] = searching
    ? [
        where("bucket", "==", temporal ? "contactado" : stage),
        ...cat,
        ...searchConstraints(search),
        orderBy("companyLower", "asc"),
      ]
    : stageConstraints(stage, cutoff, category);

  const snap = await getDocs(
    query(
      providersCol(),
      ...constraints,
      ...(cursor ? [startAfter(cursor)] : []),
      limit(PAGE_SIZE),
    ),
  );

  let rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Provider, "id">) }));
  if (searching && temporal) {
    rows = rows.filter((p) =>
      stage === "contactado"
        ? (p.firstContactDate ?? "") >= cutoff
        : (p.firstContactDate ?? "") < cutoff,
    );
  }

  return {
    rows,
    cursor: snap.docs.length === PAGE_SIZE ? snap.docs[snap.docs.length - 1] : null,
  };
}

/** Un proveedor puntual, para abrir el detalle desde ?id=… sin bajar la colección. */
export async function fetchProviderById(id: string): Promise<Provider | null> {
  const snap = await getDocs(query(providersCol(), where("__name__", "==", id)));
  const d = snap.docs[0];
  return d ? { id: d.id, ...(d.data() as Omit<Provider, "id">) } : null;
}
