// Revisa los threads de proveedores en "Contactado" con gmailThreadId y clasifica lo que llegó:
// respuesta real, rebote duro o rebote blando. Nico decide a mano el siguiente status. Usa Admin
// SDK (Task 8). Rotación por replyCheckedAt (Task 12): revisa los BATCH_SIZE más viejos por
// corrida, nunca todos, para no pasarse del timeout serverless a medida que crece el volumen.
//
// Por qué clasifica y no solo cuenta mensajes: Gmail entrega el aviso de rebote de mailer-daemon
// DENTRO del hilo original, así que "el hilo tiene más de un mensaje" marcaría como interés del
// proveedor una dirección que no existe (Task 14).
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../lib/firebaseAdmin";
import { inspectThread } from "../../../../lib/gmail";
import { recordBounceAdmin } from "../../../../lib/outreachConfigAdmin";
import type { NoteEntry, Provider } from "../../../../lib/types";

const REPLY_NOTE_TEXT = "Respuesta detectada — revisar Gmail.";
const HARD_BOUNCE_NOTE = "Rebote duro — la dirección no existe.";
const SOFT_BOUNCE_NOTE = "Rebote transitorio — puede reintentarse.";
const BATCH_SIZE = 50;

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Solo entran los que tienen replyCheckedAt: el envío automático lo escribe en 0, así que son
  // exactamente los que mandamos por acá. Los "Contactado" cargados a mano no tienen thread de
  // Gmail que revisar y quedan fuera por construcción.
  const snap = await adminDb()
    .collection("providers")
    .where("status", "==", "Contactado")
    .orderBy("replyCheckedAt", "asc")
    .limit(BATCH_SIZE)
    .get();

  let flagged = 0;
  let hardBounces = 0;
  let softBounces = 0;

  for (const d of snap.docs) {
    const p = { id: d.id, ...(d.data() as Omit<Provider, "id">) };
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    const patch: Record<string, unknown> = { replyCheckedAt: now };

    if (!p.gmailThreadId) {
      await adminDb().collection("providers").doc(p.id).update(patch);
      continue;
    }

    const notes = p.notes ?? [];
    const alreadyNoted = (text: string) => notes.some((n) => n.text === text);
    const note = (text: string): NoteEntry => ({ date: today, text });

    const { state, reason } = await inspectThread(p.gmailThreadId);

    if (state === "respuesta" && !alreadyNoted(REPLY_NOTE_TEXT)) {
      patch.notes = FieldValue.arrayUnion(note(REPLY_NOTE_TEXT));
      patch.updatedAt = now;
      flagged++;
    } else if (state === "rebote-duro" && !alreadyNoted(HARD_BOUNCE_NOTE)) {
      // La dirección no existe: fuera del envío automático y fuera del Follow-up Track, que si no
      // le pediría a Nico insistir los días 4, 7 y 12 contra una casilla muerta.
      patch.notes = FieldValue.arrayUnion(note(HARD_BOUNCE_NOTE));
      patch.sendError = reason ?? "Rebote duro";
      patch.outreachEligible = false;
      patch.followUpStopped = true;
      patch.updatedAt = now;
      await recordBounceAdmin();
      hardBounces++;
    } else if (state === "rebote-blando" && !alreadyNoted(SOFT_BOUNCE_NOTE)) {
      // Transitorio (buzón lleno, servidor caído): se anota y nada más. No dice nada de la
      // calidad de la lista, así que tampoco suma a la tasa de rebote.
      patch.notes = FieldValue.arrayUnion(note(SOFT_BOUNCE_NOTE));
      patch.updatedAt = now;
      softBounces++;
    }

    await adminDb().collection("providers").doc(p.id).update(patch);
  }

  return NextResponse.json({
    flagged,
    hardBounces,
    softBounces,
    checked: snap.docs.length,
  });
}
