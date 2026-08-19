// Manda hasta un lote chico de emails de primer contacto por corrida (llamado seguido por el
// cron de Task 11), respetando el límite diario de OutreachConfig. Server-only, usa Admin SDK
// (ver Task 8) porque no hay sesión de usuario en un cron.
import { NextResponse } from "next/server";
import { withBucket } from "../../../../lib/contactStage";
import { adminDb } from "../../../../lib/firebaseAdmin";
import {
  sendFailurePatch,
  sendSuccessPatch,
} from "../../../../lib/outreachPatches";
import { generateOutreachEmail } from "../../../../lib/outreachEmail";
import { sendOutreachEmail } from "../../../../lib/gmail";
import {
  getOutreachConfigAdmin,
  incrementSentTodayAdmin,
  pauseWithReasonAdmin,
} from "../../../../lib/outreachConfigAdmin";
import type { Provider } from "../../../../lib/types";

const BATCH_SIZE = 3; // por corrida de cron; el ritmo diario lo marca dailyLimit + frecuencia del cron

// Cortacircuito por tasa de rebote. Una tasa alta es la forma más rápida de arruinar la reputación
// del dominio, que es lo que todo el diseño gradual intenta proteger: dailyLimit acota el ritmo,
// pero sin esto el sistema seguiría mandando aunque rebotara media lista.
const BOUNCE_RATE_LIMIT = 0.05; // 5%: donde los proveedores de correo empiezan a penalizar
const MIN_SAMPLE = 50; // piso de muestra: con menos, 1 rebote da una tasa que no significa nada

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ?dryRun=1 corre la query y devuelve a quién se le mandaría, sin mandar ni escribir nada.
  // Sirve para verificar que los filtros matchean datos reales sin encender el envío.
  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";

  const config = await getOutreachConfigAdmin();

  // Cortacircuito: la tasa es HISTÓRICA (sentTotal/bouncedTotal son acumulados desde siempre),
  // no una ventana móvil. Por debajo de MIN_SAMPLE no se evalúa: los rebotes se registran igual,
  // pero no cortan.
  const sentTotal = config.sentTotal ?? 0;
  const bouncedTotal = config.bouncedTotal ?? 0;
  const bounceRate = sentTotal > 0 ? bouncedTotal / sentTotal : 0;
  if (sentTotal >= MIN_SAMPLE && bounceRate > BOUNCE_RATE_LIMIT) {
    const reason = `Pausado automáticamente: tasa de rebote ${(bounceRate * 100).toFixed(1)}% (${bouncedTotal} de ${sentTotal})`;
    if (!dryRun && config.enabled) await pauseWithReasonAdmin(reason);
    return NextResponse.json({ sent: 0, candidates: 0, reason });
  }

  if (!config.enabled && !dryRun) {
    return NextResponse.json({ sent: 0, reason: "outreach pausado" });
  }
  if (config.sentToday >= config.dailyLimit && !dryRun) {
    return NextResponse.json({ sent: 0, reason: "límite diario alcanzado" });
  }

  // El dry-run tiene que simular exactamente lo que haría el envío real, incluido cuántos toma:
  // si mostrara más, dejaría de ser una vista previa de la corrida y no serviría para verificar.
  const remaining = config.dailyLimit - config.sentToday;
  const take = Math.max(0, Math.min(BATCH_SIZE, remaining));
  if (take === 0) {
    return NextResponse.json({ dryRun, sent: 0, candidates: 0, reason: "límite diario alcanzado" });
  }

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

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      sent: 0,
      enabled: config.enabled,
      candidates: snap.size,
      sample: snap.docs.map((d) => ({
        id: d.id,
        company: d.get("company"),
        email: d.get("email"),
      })),
    });
  }

  let sent = 0;
  const errors: string[] = [];
  for (const d of snap.docs) {
    const p = { id: d.id, ...(d.data() as Omit<Provider, "id">) };
    const now = Date.now();
    try {
      const body = generateOutreachEmail(p);
      // Guion común, no raya larga: un caracter menos que miran con lupa los filtros de spam.
      const subject = `Wholesale inquiry - ${p.company}`;
      const { threadId } = await sendOutreachEmail(p.email, subject, body);
      const today = new Date().toISOString().slice(0, 10);
      const patch = sendSuccessPatch(p, { threadId, now, sentDate: today });
      await adminDb()
        .collection("providers")
        .doc(p.id)
        .update(withBucket(p, patch));
      await incrementSentTodayAdmin();
      sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${p.company}: ${message}`);
      const patch = sendFailurePatch({ now, message });
      await adminDb()
        .collection("providers")
        .doc(p.id)
        .update(withBucket(p, patch));
    }
  }

  return NextResponse.json({ sent, candidates: snap.size, errors });
}
