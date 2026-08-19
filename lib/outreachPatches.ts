import { advanceFollowUp } from "./followup";
import type { Provider } from "./types";

/**
 * Los patches que escriben los caminos que afectan al outreach y a la escalera de contacto, como
 * funciones PURAS.
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

/**
 * Marcar o desmarcar un proveedor como blacklisteado.
 *
 * Marcar es CUATRO campos, no uno. `blacklisted` solo no alcanza: no está entre los filtros de
 * send-batch (ver lib/sendCandidate.ts), así que un proveedor con `blacklisted: true` y nada más
 * queda invisible en la pantalla —el bucket lo manda a "descartado"— y al mismo tiempo vivo para
 * el cron, que le seguiría mandando mails. El peor de los dos mundos, y nadie lo vería.
 *
 * Desmarcar NO restaura `outreachEligible` a propósito: pudo haberse apagado por otra razón
 * (dominio sin MX, rebote duro), y resucitarlo acá volvería a meter en la campaña a una dirección
 * que ya sabemos que no recibe.
 */
export function blacklistPatch(
  blacklisted: boolean,
): Partial<Provider> & { blacklisted: boolean } {
  if (!blacklisted) {
    return { blacklisted: false, optedOut: false, followUpStopped: false };
  }
  return {
    blacklisted: true,
    optedOut: true,
    outreachEligible: false,
    followUpStopped: true,
  };
}
