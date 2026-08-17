// Manda hasta un lote chico de emails de primer contacto por corrida (llamado seguido por el
// cron de Task 11), respetando el límite diario de OutreachConfig. Server-only, usa Admin SDK
// (ver Task 8) porque no hay sesión de usuario en un cron.
import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebaseAdmin";
import { generateOutreachEmail } from "../../../../lib/outreachEmail";
import { advanceFollowUp } from "../../../../lib/followup";
import { sendOutreachEmail } from "../../../../lib/gmail";
import {
  getOutreachConfigAdmin,
  incrementSentTodayAdmin,
} from "../../../../lib/outreachConfigAdmin";
import type { Provider } from "../../../../lib/types";

const BATCH_SIZE = 3; // por corrida de cron; el ritmo diario lo marca dailyLimit + frecuencia del cron

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const config = await getOutreachConfigAdmin();
  if (!config.enabled) {
    return NextResponse.json({ sent: 0, reason: "outreach pausado" });
  }
  if (config.sentToday >= config.dailyLimit) {
    return NextResponse.json({ sent: 0, reason: "límite diario alcanzado" });
  }

  const remaining = config.dailyLimit - config.sentToday;
  const take = Math.min(BATCH_SIZE, remaining);

  // Scoped a source === "expo-outreach-import" a propósito: los proveedores manuales
  // pre-existentes no tienen optedOut seteado, y aunque lo tuvieran, el envío automático no debe
  // tocar relaciones que Nico ya gestiona a mano desde el CRM.
  const snap = await adminDb()
    .collection("providers")
    .where("status", "==", "Por Contactar")
    .where("contactMethod", "==", "Email")
    .where("source", "==", "expo-outreach-import")
    .where("outreachEligible", "==", true)
    .where("optedOut", "==", false)
    .where("sendAttemptedAt", "==", null)
    .limit(take)
    .get();

  let sent = 0;
  const errors: string[] = [];
  for (const d of snap.docs) {
    const p = { id: d.id, ...(d.data() as Omit<Provider, "id">) };
    const now = Date.now();
    try {
      const body = generateOutreachEmail(p);
      const subject = `Wholesale inquiry — ${p.company}`;
      const { threadId } = await sendOutreachEmail(p.email, subject, body);
      const today = new Date().toISOString().slice(0, 10);
      await adminDb()
        .collection("providers")
        .doc(p.id)
        .update({
          status: "Contactado",
          gmailThreadId: threadId,
          sendAttemptedAt: now,
          sendError: null,
          // Nunca chequeado. El campo tiene que existir sí o sí: el cron de reply-detection
          // ordena por él, y Firestore excluye del orderBy a los docs que no lo tienen.
          replyCheckedAt: 0,
          updatedAt: now,
          ...advanceFollowUp(p, today),
        });
      await incrementSentTodayAdmin();
      sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${p.company}: ${message}`);
      await adminDb().collection("providers").doc(p.id).update({
        sendAttemptedAt: now,
        sendError: message,
        updatedAt: now,
      });
    }
  }

  return NextResponse.json({ sent, candidates: snap.size, errors });
}
