import { advanceFollowUp } from "./followup";
import type { Provider } from "./types";

/**
 * Los patches que escriben los crons de outreach, como funciones PURAS.
 *
 * Están acá y no inline en las rutas para que se puedan testear: lo que importa verificar no es
 * que el write ocurra, sino que el `bucket` resultante refleje el campo nuevo. Con el patch
 * inline, un test solo podría repetir su forma a mano y quedaría desacoplado del cron real —
 * seguiría en verde el día que alguien cambie el patch y se olvide del bucket.
 *
 * Las notas quedan afuera a propósito: usan FieldValue.arrayUnion, que es del Admin SDK y no
 * participa de la escalera de computeBucket.
 */

/** Envío automático exitoso: pasa a Contactado y arranca la secuencia de follow-up. */
export function sendSuccessPatch(
  p: Provider,
  opts: { threadId: string | null; now: number; sentDate: string },
): Partial<Provider> {
  return {
    status: "Contactado",
    gmailThreadId: opts.threadId,
    sendAttemptedAt: opts.now,
    sendError: null,
    // Nunca chequeado. El campo tiene que existir sí o sí: el cron de reply-detection ordena por
    // él, y Firestore excluye del orderBy a los docs que no lo tienen.
    replyCheckedAt: 0,
    updatedAt: opts.now,
    ...advanceFollowUp(p, opts.sentDate),
  };
}

/**
 * Envío automático fallido.
 *
 * NO escribe firstContactDate: advanceFollowUp solo corre en el camino de éxito. Por eso
 * computeBucket mira firstContactDate y no sendAttemptedAt — este proveedor tiene que quedar en
 * "sin-contactar", no en un "contactado" sin fecha que la pantalla no vería.
 */
export function sendFailurePatch(opts: {
  now: number;
  message: string;
}): Partial<Provider> {
  return { sendAttemptedAt: opts.now, sendError: opts.message, updatedAt: opts.now };
}

/**
 * Respuesta detectada. Vacío si ya estaba registrada: el timestamp queda en la PRIMERA respuesta
 * y no se corre en cada corrida del cron.
 */
export function replyDetectedPatch(p: Provider, now: number): Partial<Provider> {
  if (p.replyDetectedAt != null) return {};
  return { replyDetectedAt: now, updatedAt: now };
}

/**
 * Rebote duro: la dirección no existe. Fuera del envío automático y fuera del Follow-up Track,
 * que si no le pediría a Nico insistir los días 4, 7 y 12 contra una casilla muerta.
 */
export function hardBouncePatch(opts: {
  now: number;
  reason: string;
}): Partial<Provider> {
  return {
    sendError: opts.reason,
    bounceType: "hard",
    outreachEligible: false,
    followUpStopped: true,
    updatedAt: opts.now,
  };
}

/**
 * Rebote transitorio (buzón lleno, servidor caído). Se anota y nada más: no dice nada de la
 * calidad de la lista. Un "hard" ya escrito no se degrada — la dirección no existe, y que un
 * reintento posterior devuelva un error transitorio no la resucita.
 */
export function softBouncePatch(p: Provider, opts: { now: number }): Partial<Provider> {
  if (p.bounceType === "hard") return { updatedAt: opts.now };
  return { bounceType: "soft", updatedAt: opts.now };
}
