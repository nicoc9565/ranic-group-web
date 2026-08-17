// Cliente Gmail API server-side. Usa domain-wide delegation (ver Task 6 del plan de outreach):
// la service account "impersona" a nicolas.conti@ranicgroup.com vía JWT, autorizado a nivel de
// todo el Workspace en admin.google.com — sin OAuth de usuario, sin token que caduque. Nunca
// importar este archivo desde código que corre en el browser — usa env vars sin NEXT_PUBLIC_.
import { google } from "googleapis";
import {
  bounceReason,
  classifyThread,
  looksLikeBounce,
  type ThreadMessage,
  type ThreadState,
} from "./bounceClassification";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
];

const SENDER = "nicolas.conti@ranicgroup.com";

function client() {
  // Las credenciales están cargadas solo en Production, no en preview: si falta, fallar con un
  // mensaje claro en vez de construir un JWT vacío y morir adentro de googleapis.
  const raw = process.env.GMAIL_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Falta GMAIL_SERVICE_ACCOUNT_JSON");
  const key = JSON.parse(raw);
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: SCOPES,
    subject: SENDER,
  });
  return google.gmail({ version: "v1", auth });
}

// Cabecera de baja de lista, para que el cliente de correo ofrezca el botón nativo de cancelar
// suscripción además de la línea de opt-out del cuerpo. Va SOLO en el outreach automático: los
// templates que Nico copia a mano desde el CRM son mails uno a uno de una conversación en curso,
// donde una cabecera de baja de lista no corresponde.
//
// Deliberadamente NO se declara List-Unsubscribe-Post: la baja de un clic (RFC 8058) exige una
// URL https que procese la baja sin intervención humana, y no tenemos ese endpoint. Declararla
// apuntando a un mailto es peor que no declararla.
const LIST_UNSUBSCRIBE = `<mailto:${SENDER}?subject=Unsubscribe>`;

export function buildRawMessage(to: string, subject: string, body: string): string {
  const msg = [
    `From: ${SENDER}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `List-Unsubscribe: ${LIST_UNSUBSCRIBE}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\n");
  return Buffer.from(msg)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Envía el primer contacto. Devuelve el threadId de Gmail para reply-detection (Task 12). */
export async function sendOutreachEmail(
  to: string,
  subject: string,
  body: string,
): Promise<{ threadId: string }> {
  const gmail = client();
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: buildRawMessage(to, subject, body) },
  });
  if (!res.data.threadId) throw new Error("Gmail no devolvió threadId");
  return { threadId: res.data.threadId };
}

const BOUNCE_HEADERS = ["From", "Content-Type", "X-Failed-Recipients", "Subject"];

/** Cabeceras de la Gmail API a un mapa en minúscula, que es lo que espera la clasificación. */
function headerMap(
  headers: { name?: string | null; value?: string | null }[] | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of headers ?? []) {
    if (h.name) out[h.name.toLowerCase()] = h.value ?? "";
  }
  return out;
}

/** Concatena el texto plano de todas las partes del mensaje (el reporte DSN es una de ellas). */
function plainTextBody(payload: unknown): string {
  const parts: string[] = [];
  const walk = (node: Record<string, unknown> | undefined) => {
    if (!node) return;
    const data = (node.body as { data?: string } | undefined)?.data;
    if (data) parts.push(Buffer.from(data, "base64url").toString("utf8"));
    for (const child of (node.parts as Record<string, unknown>[] | undefined) ?? []) walk(child);
  };
  walk(payload as Record<string, unknown> | undefined);
  return parts.join("\n");
}

/**
 * Clasifica el hilo mirando el mensaje más nuevo posterior al que mandamos nosotros. Devuelve
 * también el motivo cuando es rebote duro, para escribirlo en `sendError`.
 *
 * Costo: primero pide solo cabeceras. El cuerpo completo se busca únicamente si esas cabeceras
 * ya dijeron que es un rebote, así el caso normal (respuesta real o nada) queda liviano.
 */
export async function inspectThread(
  threadId: string,
): Promise<{ state: ThreadState; reason: string | null }> {
  const gmail = client();
  const res = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "metadata",
    metadataHeaders: BOUNCE_HEADERS,
  });

  const messages = res.data.messages ?? [];
  if (messages.length <= 1) return { state: "sin-respuesta", reason: null };

  const newest = messages[messages.length - 1];
  const msg: ThreadMessage = { headers: headerMap(newest.payload?.headers ?? undefined) };
  if (!looksLikeBounce(msg)) return { state: "respuesta", reason: null };

  const full = await gmail.users.messages.get({
    userId: "me",
    id: newest.id ?? "",
    format: "full",
  });
  const withBody: ThreadMessage = { ...msg, body: plainTextBody(full.data.payload) };
  const state = classifyThread(withBody);
  return { state, reason: state === "rebote-duro" ? bounceReason(withBody) : null };
}
