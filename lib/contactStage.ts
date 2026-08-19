import type { Provider, Status } from "./types";

/**
 * Etapa de contacto: lo que el sistema OBSERVÓ sobre un proveedor, derivado de campos que el
 * cron de outreach ya escribe. No es un campo más en Firestore a propósito — un campo mutable
 * paralelo a `status` se desincroniza a la primera y nadie sabe cuál de los dos miente.
 *
 * `status` sigue siendo el pipeline que Nico maneja a mano; esto es la observación automática.
 * La UI muestra los dos.
 *
 *   sin-contactar → contactado → sin-respuesta
 *                             ↘ respondio → cuenta
 *                             ↘ rebotado
 *                                           descartado (transversal)
 */
export type ContactStage =
  | "sin-contactar"
  | "contactado"
  | "sin-respuesta"
  | "respondio"
  | "cuenta"
  | "rebotado"
  | "descartado";

/**
 * Días desde el primer contacto tras los cuales damos el proveedor por no interesado.
 * La secuencia de follow-up se agota al día 12 (FOLLOWUP_DAYS), más dos días de margen.
 */
export const NO_REPLY_DAYS = 14;

/**
 * La etapa SIN el corte temporal: todo lo que se puede decidir mirando solo los campos del
 * documento. Es lo que se persiste en `Provider.bucket` para poder filtrar por etapa en Firestore.
 *
 * Por qué no incluye "sin-respuesta": esa etapa depende del paso del tiempo — un proveedor cruza
 * a los 14 días sin que nadie escriba nada — así que un campo persistido se quedaría viejo solo,
 * en silencio y sin nada que lo dispare. Esa distinción se resuelve en la query, comparando
 * firstContactDate contra el corte.
 */
export type ContactBucket =
  | "descartado"
  | "cuenta"
  | "rebotado"
  | "respondio"
  | "contactado"
  | "sin-contactar";

const DISCARDED_STATUSES = new Set<Status>(["Rechazado", "No Acepta Nuevos"]);
const ACCOUNT_STATUSES = new Set<Status>(["Aprobado", "En Negociación"]);

const MS_PER_DAY = 86_400_000;

/** Días enteros entre una fecha yyyy-mm-dd y hoy, comparando medianoches UTC (igual que followup.ts). */
function daysSince(dayStr: string, today: Date): number {
  const from = Date.parse(`${dayStr}T00:00:00.000Z`);
  const to = Date.parse(`${today.toISOString().slice(0, 10)}T00:00:00.000Z`);
  return Math.floor((to - from) / MS_PER_DAY);
}

/**
 * Escalera de precedencia ESTRICTA: gana la primera que aplica, y el orden importa. Un proveedor
 * blacklisteado que además respondió es `descartado`, no `respondio`: lo que decidió Nico pesa más
 * que lo que observó el programa. Un rebote duro gana sobre el resto porque explica por qué no
 * hubo respuesta.
 *
 * INVARIANTE que sostiene la pantalla de Proveedores: todo proveedor en `contactado` tiene
 * firstContactDate. La regla mira SOLO firstContactDate y no sendAttemptedAt a propósito. Cuando
 * un envío falla, send-batch escribe sendAttemptedAt pero NO firstContactDate (advanceFollowUp
 * corre únicamente en el camino de éxito). Con la regla vieja ese proveedor caía en `contactado`
 * sin fecha, y la query que separa contactado de sin-respuesta filtra por firstContactDate:
 * Firestore descarta los documentos que no tienen el campo, así que habría desaparecido de la
 * pantalla sin que nada fallara. Es la misma trampa del campo ausente que ya costó dos features
 * inertes con los tests en verde.
 */
export function computeBucket(p: Provider): ContactBucket {
  if (
    p.blacklisted ||
    p.optedOut ||
    p.excludedReason != null ||
    DISCARDED_STATUSES.has(p.status)
  ) {
    return "descartado";
  }
  if (ACCOUNT_STATUSES.has(p.status)) return "cuenta";
  if (p.bounceType === "hard") return "rebotado";
  if (p.replyDetectedAt != null) return "respondio";
  if (!p.firstContactDate) return "sin-contactar";
  return "contactado";
}

/**
 * Etapa de contacto completa: computeBucket más el corte temporal.
 *
 * Se construye ENCIMA de computeBucket, no en paralelo: una sola escalera de precedencia, sin
 * lógica duplicada que pueda divergir.
 */
export function contactStage(p: Provider, today: Date): ContactStage {
  const bucket = computeBucket(p);
  if (bucket !== "contactado") return bucket;
  // La invariante de arriba garantiza que acá firstContactDate existe.
  return daysSince(p.firstContactDate!, today) > NO_REPLY_DAYS
    ? "sin-respuesta"
    : "contactado";
}

/**
 * Devuelve el patch con `bucket` recalculado sobre el documento YA PARCHEADO.
 *
 * TODO write a `providers` que toque un campo de la escalera tiene que pasar por acá. Existe como
 * función y no como línea suelta repetida en cada cron por dos razones: la escalera no se replica
 * en ningún lado (se llama a computeBucket), y hay un solo nombre que grepear para auditar que no
 * quedó un write afuera.
 *
 * Si esto se olvida en algún camino, el proveedor cambia de etapa en los datos pero no en el
 * campo, y desaparece de la pantalla sin ningún error: la query filtra por `bucket`.
 */
export function withBucket<T extends Record<string, unknown>>(
  current: Partial<Provider>,
  patch: T,
): T & { bucket: ContactBucket } {
  return { ...patch, bucket: computeBucket({ ...current, ...patch } as Provider) };
}

export const CONTACT_STAGE_LABELS: Record<ContactStage, string> = {
  "sin-contactar": "Sin contactar",
  contactado: "Contactado",
  "sin-respuesta": "Sin respuesta",
  respondio: "Respondió",
  cuenta: "Cuenta o lista",
  rebotado: "Rebotado",
  descartado: "Descartado",
};
