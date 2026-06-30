import type { Provider } from "./types";

// Secuencia de follow-up: días desde firstContactDate.
//   día 1  = email inicial
//   día 4  = follow-up corto
//   día 7  = follow-up urgente
//   día 12 = último intento
export const FOLLOWUP_DAYS = [1, 4, 7, 12] as const;

/** yyyy-mm-dd de un Date, en UTC (consistente con cómo construimos las fechas). */
function toDayStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Fecha del próximo follow-up = firstContactDate + FOLLOWUP_DAYS[followUpStep + 1].
 * Devuelve null si no hay firstContactDate o si la secuencia se agotó (followUpStep >= 3).
 */
export function nextFollowUpDate(p: Provider): Date | null {
  // Seguimiento detenido manualmente: no hay próximo follow-up (sale de Follow-ups/Dashboard).
  if (p.followUpStopped) return null;
  // El Follow-up Track asume una secuencia de emails que Nico controla. Si el contacto fue
  // por Web o Llamada, no hay secuencia corriendo → no se calcula follow-up (spec §4),
  // salvo que Nico fuerce el tracking manualmente (followUpForced).
  if (p.contactMethod !== "Email" && !p.followUpForced) return null;
  if (!p.firstContactDate) return null;
  const days = FOLLOWUP_DAYS[p.followUpStep + 1];
  if (days === undefined) return null;
  const d = new Date(`${p.firstContactDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Estado del follow-up comparando (solo el día) hoy contra el próximo follow-up:
 *   después → overdue, igual → today, antes → ontrack, sin fecha → none.
 */
export function followUpStatus(
  p: Provider,
  today: Date,
): "overdue" | "today" | "ontrack" | "none" {
  const next = nextFollowUpDate(p);
  if (!next) return "none";
  const a = toDayStr(today);
  const b = toDayStr(next);
  if (a > b) return "overdue";
  if (a === b) return "today";
  return "ontrack";
}

/**
 * Campos a actualizar al marcar un email como enviado:
 *  - avanza followUpStep (de -1 a 0 en el primer contacto, luego 0→1→2→3),
 *  - setea lastEmailDate,
 *  - fija firstContactDate solo si era null (no se sobreescribe el pasado).
 */
export function advanceFollowUp(p: Provider, sentDate: string): Partial<Provider> {
  const patch: Partial<Provider> = {
    followUpStep: p.followUpStep + 1,
    lastEmailDate: sentDate,
  };
  if (!p.firstContactDate) patch.firstContactDate = sentDate;
  return patch;
}
