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
 * Señal PRIMARIA: el formato estándar de notificación de entrega (RFC 3464). Es la única que
 * vale por sí sola junto con X-Failed-Recipients, porque son estructurales del rebote y ningún
 * mail legítimo las trae.
 *
 * Deliberadamente NO se mira el asunto: "Delivery Status Notification (Failure)" depende del
 * idioma de la cuenta y un humano puede responder citándolo.
 */
function hasBounceStructure(msg: ThreadMessage): boolean {
  const contentType = msg.headers["content-type"] ?? "";
  return (
    /report-type=delivery-status/i.test(contentType) || "x-failed-recipients" in msg.headers
  );
}

/**
 * Señal de CORROBORACIÓN, nunca suficiente sola. Gmail manda desde mailer-daemon@googlemail.com,
 * pero otros MTA usan postmaster@ y muchos DSN vienen con remitente nulo (<>), así que apoyarse
 * en el From haría que esto funcione contra Google y falle contra cualquier otro servidor.
 * Y al revés: un proveedor que escribe de verdad desde postmaster@suempresa.com no es un rebote.
 */
function fromMailDaemon(msg: ThreadMessage): boolean {
  return DAEMON_RE.test(msg.headers["from"] ?? "");
}

/**
 * Prescreen barato sobre las cabeceras: decide si vale la pena bajar el cuerpo completo para
 * buscar el código DSN. Acá sí entra el From, porque equivocarse solo cuesta una llamada de más.
 */
export function looksLikeBounce(msg: ThreadMessage): boolean {
  return hasBounceStructure(msg) || fromMailDaemon(msg);
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
 * Es rebote si trae la estructura de un DSN, o si viene de un daemon Y además tiene un código
 * DSN en el cuerpo. El From solo no alcanza: ver fromMailDaemon.
 *
 * Un rebote sin línea Status: legible se trata como blando, no como duro. La asimetría es
 * deliberada: marcar duro de más apaga el envío y el follow-up de un proveedor que quizás está
 * vivo; marcar blando de más solo deja una nota.
 */
export function classifyThread(newest: ThreadMessage | null): ThreadState {
  if (!newest) return "sin-respuesta";
  const status = dsnStatus(newest.body);
  const isBounce = hasBounceStructure(newest) || (fromMailDaemon(newest) && status !== null);
  if (!isBounce) return "respuesta";
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
