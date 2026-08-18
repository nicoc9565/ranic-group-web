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
 * Etapa de contacto de un proveedor. La precedencia es ESTRICTA: gana la primera que aplica,
 * y el orden importa. Un proveedor blacklisteado que además respondió es `descartado`, no
 * `respondio`: lo que decidió Nico pesa más que lo que observó el programa. Un rebote duro gana
 * sobre `sin-respuesta` porque explica por qué no hubo respuesta.
 */
export function contactStage(p: Provider, today: Date): ContactStage {
  if (p.blacklisted || p.optedOut || DISCARDED_STATUSES.has(p.status)) {
    return "descartado";
  }
  if (ACCOUNT_STATUSES.has(p.status)) return "cuenta";
  if (p.bounceType === "hard") return "rebotado";
  if (p.replyDetectedAt != null) return "respondio";
  // Ni el envío automático lo intentó ni hay un primer contacto manual registrado.
  if (p.sendAttemptedAt == null && !p.firstContactDate) return "sin-contactar";
  if (p.firstContactDate && daysSince(p.firstContactDate, today) > NO_REPLY_DAYS) {
    return "sin-respuesta";
  }
  return "contactado";
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
