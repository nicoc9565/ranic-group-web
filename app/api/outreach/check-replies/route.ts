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
import { inspectThread, listRecentBounces, listRecentUnsubscribes } from "../../../../lib/gmail";
import { recordBounceAdmin } from "../../../../lib/outreachConfigAdmin";
import {
  hardBouncePatch,
  replyDetectedPatch,
  softBouncePatch,
  unsubscribePatch,
} from "../../../../lib/outreachPatches";
import { shouldOptOut } from "../../../../lib/unsubscribeClassification";
import type { NoteEntry, Provider } from "../../../../lib/types";

const REPLY_NOTE_TEXT = "Respuesta detectada — revisar Gmail.";
const HARD_BOUNCE_NOTE = "Rebote duro — la dirección no existe.";
const SOFT_BOUNCE_NOTE = "Rebote transitorio — puede reintentarse.";
const OPT_OUT_NOTE = "Baja pedida por el proveedor (List-Unsubscribe) — optedOut automático.";
const BATCH_SIZE = 50;
// Los pedidos de baja llegan en el momento, pero la ventana cubre corridas salteadas del cron
// (el schedule de GitHub Actions se atrasa y se saltea). Releer una baja ya aplicada no cuesta:
// el guard de idempotencia la descarta.
const UNSUBSCRIBE_WINDOW_DAYS = 4;
// Los rebotes duros llegan en segundos, pero los blandos llegan cuando el MTA remoto se rinde
// después de reintentar: típicamente 3 a 5 días. Con una ventana de 2 se perdían casi todos.
const BOUNCE_WINDOW_DAYS = 4;

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ?dryRun=1 hace TODO el recorrido —consultas a Gmail y a Firestore incluidas— y no escribe una
  // sola vez. Vale para las tres partes, no solo para las bajas: un "dry run" que igual avanza
  // replyCheckedAt y marca rebotes sería una trampa para el que lo corre.
  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";

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
      if (!dryRun) await adminDb().collection("providers").doc(p.id).update(patch);
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

    if (!dryRun) {
      await adminDb()
        .collection("providers")
        .doc(p.id)
        .update(withBucket(p, patch));
    }
  }

  // ── Segunda parte: rebotes ────────────────────────────────────────────────
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
          if (!dryRun) await recordBounceAdmin();
          countedThisBounce = true;
        }
      } else {
        Object.assign(patch, softBouncePatch(p, { now }));
        softBounces++;
      }

      if (!dryRun) {
        await adminDb()
          .collection("providers")
          .doc(p.id)
          .update(withBucket(p, patch));
      }
    }
  }

  // ── Tercera parte: bajas pedidas con List-Unsubscribe ─────────────────────
  // Un clic en "cancelar suscripción" manda un mail NUEVO con asunto "Unsubscribe", no una
  // respuesta al hilo, así que la primera mitad no lo ve. Se recupera del buzón y se correlaciona
  // por la dirección que lo mandó, igual que los rebotes.
  const unsubscribes = await listRecentUnsubscribes(UNSUBSCRIBE_WINDOW_DAYS);
  let optOuts = 0;
  const optOutIds: string[] = [];

  for (const request of unsubscribes) {
    // Correlación por dirección + campaña. Sin el filtro de source, un "unsubscribe" mandado por
    // alguien con quien Nico habla a mano podría dar de baja una relación que él gestiona.
    const matches = await adminDb()
      .collection("providers")
      .where("email", "==", request.sender)
      .where("source", "==", "expo-outreach-import")
      .get();

    for (const d of matches.docs) {
      const p = { id: d.id, ...(d.data() as Omit<Provider, "id">) };

      // Los cuatro guardas + idempotencia viven en shouldOptOut, no acá: la query de arriba es
      // el filtro grueso y esta es la decisión, testeable sin Gmail ni Firestore.
      if (!shouldOptOut(p, request)) continue;

      optOuts++;
      optOutIds.push(p.id);
      if (dryRun) continue;

      await adminDb()
        .collection("providers")
        .doc(p.id)
        .update(
          withBucket(p, {
            ...unsubscribePatch(Date.now()),
            notes: FieldValue.arrayUnion({ date: today, text: OPT_OUT_NOTE } as NoteEntry),
          }),
        );
    }
  }

  return NextResponse.json({
    dryRun,
    flagged,
    hardBounces,
    softBounces,
    optOuts,
    // Los IDs van en la respuesta a propósito: en un dry-run son la lista de a quién marcaría, y
    // en una corrida real son el registro de a quién marcó, que es una decisión que en la práctica
    // no se revierte. Son pocos por definición.
    optOutIds,
    checked: snap.docs.length,
    bouncesInWindow: bounces.length,
    unsubscribesInWindow: unsubscribes.length,
  });
}
