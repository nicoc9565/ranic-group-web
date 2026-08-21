// Clasificación de un pedido de baja. Función pura, sin red: recibe lo que devolvió la Gmail API
// ya normalizado, para poder testearla sin mockear googleapis (mismo patrón que
// lib/bounceClassification.ts).
//
// Por qué existe separada de la detección de respuestas: la baja de un clic NO llega al hilo del
// envío. El cliente de correo genera un mensaje NUEVO al `mailto` de la cabecera List-Unsubscribe,
// así que `inspectThread` no la encuentra nunca. Es la misma trampa que ya nos comimos con los
// DSN de rebote, y la solución es la misma: buscar en el buzón y correlacionar por dirección.
import type { Provider } from "./types";

/** Lo mínimo que hace falta del mensaje para clasificarlo. Solo cabeceras: el cuerpo no se mira. */
export type IncomingMessage = {
  /** Cabeceras, en minúscula: { from, subject, ... }. */
  headers: Record<string, string>;
};

/**
 * El asunto EXACTO que genera nuestra propia cabecera, y nada más.
 *
 * ── POR QUÉ TAN ESTRICTO ────────────────────────────────────────────────────────────────────
 * Marcar `optedOut` es, en la práctica, irreversible: ese proveedor no se contacta nunca más y
 * nadie va a revisar la decisión. Así que la marca automática se reserva para el único caso en
 * que la intención es inequívoca porque el texto lo escribimos NOSOTROS: el asunto que va en
 * `mailto:...?subject=Unsubscribe` de lib/gmail.ts.
 *
 * Un humano que escribe "please remove me from your list" NO se marca solo. Genera nota y queda
 * para Nico. Eso es a propósito y no es falta de ambición: un heurístico sobre texto libre se
 * equivoca justo donde el error no se puede deshacer. La asimetría de costos es toda para un lado.
 *
 * Se tolera el prefijo "Re:" porque algunos clientes lo agregan al generar la baja. No se tolera
 * "Fwd:": reenviar es una acción humana deliberada sobre un mail que puede ser de otro.
 */
export const UNSUBSCRIBE_SUBJECT_RE = /^\s*(re:\s*)?unsubscribe\s*$/i;

export function isUnsubscribeRequest(msg: IncomingMessage): boolean {
  return UNSUBSCRIBE_SUBJECT_RE.test(msg.headers["subject"] ?? "");
}

/**
 * Dirección del remitente, normalizada a minúscula para comparar contra `Provider.email`.
 *
 * El From viene como `Nombre Apellido <a@b.com>` o pelado como `a@b.com`. Devuelve null si no hay
 * nada parseable: sin dirección no hay a quién marcar, y adivinar acá sería marcar al azar.
 */
export function senderAddress(from: string | undefined): string | null {
  if (!from) return null;
  const angled = /<([^>]+)>/.exec(from)?.[1] ?? from;
  const trimmed = angled.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

/** Lo que hace falta saber del pedido para decidir si corresponde marcar. */
export type UnsubscribeSignal = {
  /** Remitente ya normalizado por senderAddress. */
  sender: string;
  /** Epoch ms de recepción. */
  receivedAt: number;
};

/** Lo que hace falta saber del proveedor. Deliberadamente parcial: se evalúa lo que hay en el doc. */
export type OptOutCandidate = Pick<Provider, "email" | "source" | "sendAttemptedAt" | "optedOut">;

/**
 * Los cuatro guardas de la baja automática, en un solo lugar.
 *
 * Están acá y no sueltos en el endpoint por el mismo motivo que SEND_CANDIDATE_FILTERS: la query
 * de Firestore es un filtro GRUESO (dirección + campaña) y esta función es la decisión fina. Si
 * vivieran en dos lugares, el test validaría su propia copia mientras el cron hace otra cosa.
 *
 *   1. La dirección coincide exactamente con la del proveedor.
 *   2. El proveedor es de la campaña automática, no una relación que Nico maneja a mano.
 *   3. Le mandamos algo: sin `sendAttemptedAt` no hay envío al que esto pueda ser respuesta.
 *   4. La baja es POSTERIOR a ese envío. Un mail viejo con ese asunto no da de baja a un
 *      proveedor al que recién le escribimos.
 *
 * Y el guard de idempotencia: si ya está dado de baja, no hay nada que escribir.
 */
export function shouldOptOut(p: OptOutCandidate, signal: UnsubscribeSignal): boolean {
  if (p.optedOut) return false;
  if (!p.email || p.email.trim().toLowerCase() !== signal.sender) return false;
  if (p.source !== "expo-outreach-import") return false;
  if (p.sendAttemptedAt == null) return false;
  return signal.receivedAt > p.sendAttemptedAt;
}
