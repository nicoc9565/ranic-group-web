// Revisa los threads de proveedores en "Contactado" con gmailThreadId, y si detecta respuesta
// agrega una nota visible — Nico decide a mano el siguiente status. Usa Admin SDK (Task 8).
// Rotación por replyCheckedAt (ver nota de la Task 12): revisa los BATCH_SIZE más viejos por
// corrida, nunca todos, para no pasarse del timeout serverless a medida que crece el volumen.
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../lib/firebaseAdmin";
import { hasNewReply } from "../../../../lib/gmail";
import type { NoteEntry, Provider } from "../../../../lib/types";

const REPLY_NOTE_TEXT = "Respuesta detectada — revisar Gmail.";
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
  for (const d of snap.docs) {
    const p = { id: d.id, ...(d.data() as Omit<Provider, "id">) };
    const now = Date.now();
    if (!p.gmailThreadId) {
      await adminDb().collection("providers").doc(p.id).update({ replyCheckedAt: now });
      continue;
    }
    const alreadyFlagged = (p.notes ?? []).some((n) => n.text === REPLY_NOTE_TEXT);
    const patch: Record<string, unknown> = { replyCheckedAt: now };
    if (!alreadyFlagged && (await hasNewReply(p.gmailThreadId))) {
      const note: NoteEntry = {
        date: new Date().toISOString().slice(0, 10),
        text: REPLY_NOTE_TEXT,
      };
      patch.notes = FieldValue.arrayUnion(note);
      patch.updatedAt = now;
      flagged++;
    }
    await adminDb().collection("providers").doc(p.id).update(patch);
  }

  return NextResponse.json({ flagged, checked: snap.docs.length });
}
