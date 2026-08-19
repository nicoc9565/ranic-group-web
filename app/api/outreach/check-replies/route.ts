// Revisa los threads de proveedores en "Contactado" con gmailThreadId y clasifica lo que llegó:
// respuesta real, rebote duro o rebote blando. Nico decide a mano el siguiente status. Usa Admin
// SDK (Task 8). Rotación por replyCheckedAt (Task 12): revisa los BATCH_SIZE más viejos por
// corrida, nunca todos, para no pasarse del timeout serverless a medida que crece el volumen.
//
// Por qué clasifica y no solo cuenta mensajes: "el hilo tiene más de un mensaje" no distingue
// interés del proveedor de una dirección que no existe (Task 14).
//
// Corrección de una premisa falsa que este archivo afirmaba hasta hoy: Gmail NO entrega el DSN
// dentro del hilo original. La prueba real con un rebote auténtico lo dejó en un hilo aparte
// (1a011835f8a4084b vs 1a0118359093412c del envío), así que la primera versión de esta lógica era
// inerte con todos los tests en verde. Por eso los rebotes se recuperan del buzón con
// listRecentBounces y se correlacionan por dirección, no por thread.
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { withBucket } from "../../../../lib/contactStage";
import { adminDb } from "../../../../lib/firebaseAdmin";
import { inspectThread, listRecentBounces } from "../../../../lib/gmail";
import { recordBounceAdmin } from "../../../../lib/outreachConfigAdmin";
import {
  hardBouncePatch,
  replyDetectedPatch,
  softBouncePatch,
} from "../../../../lib/outreachPatches";
import type { NoteEntry, Provider } from "../../../../lib/types";

const REPLY_NOTE_TEXT = "Respuesta detectada — revisar Gmail.";
const HARD_BOUNCE_NOTE = "Rebote duro — la dirección no existe.";
const SOFT_BOUNCE_NOTE = "Rebote transitorio — puede reintentarse.";
const BATCH_SIZE = 50;
// Los rebotes duros llegan en segundos, pero los blandos llegan cuando el MTA remoto se rinde
// después de reintentar: típicamente 3 a 5 días. Con una ventana de 2 se perdían casi todos.
const BOUNCE_WINDOW_DAYS = 4;

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
      // Solo toca replyCheckedAt, que no participa de la escalera: no hace falta recalcular.
      await adminDb().collection("providers").doc(p.id).update(patch);
      continue;
    }

    const notes = p.notes ?? [];
    const alreadyNoted = (text: string) => notes.some((n) => n.text === text);
    const note = (text: string): NoteEntry => ({ date: today, text });

    const { state } = await inspectThread(p.gmailThreadId);

    if (state === "respuesta") {
      if (!alreadyNoted(REPLY_NOTE_TEXT)) {
        patch.notes = FieldValue.arrayUnion(note(REPLY_NOTE_TEXT));
        patch.updatedAt = now;
        flagged++;
      }
      // Guard propio, no colgado del de la nota: un proveedor detectado antes del backfill tiene
      // la nota vieja sin el campo, y este es el que se lo escribe.
      Object.assign(patch, replyDetectedPatch(p, now));
    }

    await adminDb()
      .collection("providers")
      .doc(p.id)
      .update(withBucket(p, patch));
  }

  // ── Segunda mitad: rebotes ────────────────────────────────────────────────
  // Independiente de la rotación de arriba. Los DSN no llegan al hilo del envío, así que se
  // recuperan del buzón y se correlacionan por la dirección que falló.
  const bounces = await listRecentBounces(BOUNCE_WINDOW_DAYS);
  const today = new Date().toISOString().slice(0, 10);

  for (const bounce of bounces) {
    const matches = await adminDb()
      .collection("providers")
      .where("email", "==", bounce.recipient)
      .where("status", "==", "Contactado")
      .where("source", "==", "expo-outreach-import")
      .get();

    let countedThisBounce = false;

    for (const d of matches.docs) {
      const p = { id: d.id, ...(d.data() as Omit<Provider, "id">) };

      // Guarda temporal: sin esto, un rebote de un mail que Nico mandó a mano hace días mataría
      // retroactivamente a un proveedor al que le escribimos hoy y que tal vez recibió bien.
      if (p.sendAttemptedAt == null || bounce.receivedAt <= p.sendAttemptedAt) continue;

      const noteText = bounce.state === "rebote-duro" ? HARD_BOUNCE_NOTE : SOFT_BOUNCE_NOTE;
      if ((p.notes ?? []).some((n) => n.text === noteText)) continue;

      const now = Date.now();
      const patch: Record<string, unknown> = {
        notes: FieldValue.arrayUnion({ date: today, text: noteText } as NoteEntry),
        updatedAt: now,
      };

      if (bounce.state === "rebote-duro") {
        Object.assign(patch, hardBouncePatch({ now, reason: bounce.reason }));
        hardBounces++;
        // El contador sube una vez por DSN, no por proveedor: si un DSN matchea dos, la tasa se
        // distorsionaría hacia arriba justo cuando el cortacircuito la está mirando.
        if (!countedThisBounce) {
          await recordBounceAdmin();
          countedThisBounce = true;
        }
      } else {
        Object.assign(patch, softBouncePatch(p, { now }));
        softBounces++;
      }

      await adminDb()
        .collection("providers")
        .doc(p.id)
        .update(withBucket(p, patch));
    }
  }

  return NextResponse.json({
    flagged,
    hardBounces,
    softBounces,
    checked: snap.docs.length,
    bouncesInWindow: bounces.length,
  });
}
