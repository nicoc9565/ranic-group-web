// Cliente Gmail API server-side. Usa domain-wide delegation (ver Task 6 del plan de outreach):
// la service account "impersona" a nicolas.conti@ranicgroup.com vía JWT, autorizado a nivel de
// todo el Workspace en admin.google.com — sin OAuth de usuario, sin token que caduque. Nunca
// importar este archivo desde código que corre en el browser — usa env vars sin NEXT_PUBLIC_.
import { google } from "googleapis";

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

/** true si el thread tiene más de 1 mensaje (o sea, hubo respuesta además del envío inicial). */
export async function hasNewReply(threadId: string): Promise<boolean> {
  const gmail = client();
  const res = await gmail.users.threads.get({ userId: "me", id: threadId, format: "minimal" });
  return (res.data.messages?.length ?? 0) > 1;
}
