// Clasificación de la respuesta de un hilo de outreach. Función pura, sin red: recibe lo que
// devolvió la Gmail API ya normalizado, para poder testearla sin mockear googleapis.
//
// Por qué existe: Gmail entrega el aviso de rebote de mailer-daemon DENTRO del hilo original, así
// que "el hilo tiene más de un mensaje" no distingue interés del proveedor de una dirección muerta.

export type ThreadState = "sin-respuesta" | "respuesta" | "rebote-duro" | "rebote-blando";

/** Lo mínimo que hace falta del mensaje más nuevo del hilo para clasificarlo. */
export type ThreadMessage = {
  /** Cabeceras, en minúscula: { from, "content-type", "x-failed-recipients", ... }. */
  headers: Record<string, string>;
  /** Cuerpo en texto plano. Solo se pide si las cabeceras ya dijeron que es un rebote. */
  body?: string;
};

const DAEMON_RE = /(mailer-daemon|postmaster)@/i;

/**
 * true si el mensaje es una notificación de entrega fallida. Tres señales, de más a menos
 * confiable. Deliberadamente NO se mira el asunto: "Delivery Status Notification (Failure)"
 * depende del idioma de la cuenta y se rompe si alguien cambia la configuración.
 */
export function isBounce(msg: ThreadMessage): boolean {
  const contentType = msg.headers["content-type"] ?? "";
  if (/report-type=delivery-status/i.test(contentType)) return true;
  if (DAEMON_RE.test(msg.headers["from"] ?? "")) return true;
  return "x-failed-recipients" in msg.headers;
}

/**
 * Código de estado DSN del cuerpo del reporte (RFC 3464): 5.x.x permanente, 4.x.x transitorio.
 * null si no hay ninguno legible.
 */
export function dsnStatus(body: string | undefined): string | null {
  const match = /^\s*Status:\s*([245]\.\d{1,3}\.\d{1,3})/im.exec(body ?? "");
  return match ? match[1] : null;
}

/**
 * Estado del hilo a partir del mensaje más nuevo posterior al que mandamos nosotros.
 * `null` = el hilo no tiene mensajes nuevos.
 *
 * Un rebote sin línea Status: legible se trata como blando, no como duro: es preferible
 * reintentarle a una dirección viva que condenar una por un formato que no supimos parsear.
 */
export function classifyThread(newest: ThreadMessage | null): ThreadState {
  if (!newest) return "sin-respuesta";
  if (!isBounce(newest)) return "respuesta";
  const status = dsnStatus(newest.body);
  return status?.startsWith("5.") ? "rebote-duro" : "rebote-blando";
}

/** Texto para sendError: el código DSN más la línea de diagnóstico, si la hay. */
export function bounceReason(msg: ThreadMessage): string {
  const status = dsnStatus(msg.body) ?? "sin código";
  const diagnostic = /^\s*Diagnostic-Code:\s*(.+)$/im.exec(msg.body ?? "")?.[1]?.trim();
  const failed = msg.headers["x-failed-recipients"];
  const detail = diagnostic ?? failed ?? "";
  return `Rebote duro: ${status}${detail ? ` ${detail}` : ""}`.slice(0, 300);
}
