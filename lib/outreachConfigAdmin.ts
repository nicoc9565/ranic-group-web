// Solo para endpoints de cron (Tasks 10 y 12) — usa Admin SDK, ignora firestore.rules.
import { adminDb } from "./firebaseAdmin";
import type { OutreachConfig } from "./types";

function ref() {
  return adminDb().collection("outreachConfig").doc("config");
}

/** yyyy-mm-dd en America/New_York (la ventana de envío se piensa en esa zona). */
function todayNY(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

const DEFAULT_CONFIG: OutreachConfig = {
  dailyLimit: 20,
  enabled: false,
  sentToday: 0,
  lastResetDate: todayNY(),
  sentTotal: 0,
  bouncedTotal: 0,
  pausedReason: null,
};

export async function getOutreachConfigAdmin(): Promise<OutreachConfig> {
  const snap = await ref().get();
  if (!snap.exists) {
    await ref().set(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }
  const config = snap.data() as OutreachConfig;
  // El contador es de "hoy": si el doc quedó de un día anterior, para el caller ya vale 0 aunque
  // todavía no se haya persistido el reset (lo persiste incrementSentTodayAdmin al primer envío).
  return config.lastResetDate === todayNY()
    ? config
    : { ...config, sentToday: 0, lastResetDate: todayNY() };
}

/**
 * Resetea sentToday si cambió el día (America/New_York), y suma 1. Devuelve el config resultante
 * para que el caller sepa si ya llegó al límite.
 */
export async function incrementSentTodayAdmin(): Promise<OutreachConfig> {
  const today = todayNY();
  const next = await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref());
    const current = snap.exists ? (snap.data() as OutreachConfig) : DEFAULT_CONFIG;
    const base = { ...current, sentTotal: (current.sentTotal ?? 0) + 1 };
    const updated: OutreachConfig =
      current.lastResetDate === today
        ? { ...base, sentToday: current.sentToday + 1 }
        : { ...base, sentToday: 1, lastResetDate: today };
    tx.set(ref(), updated);
    return updated;
  });
  return next;
}

/** Suma 1 a bouncedTotal. Solo se llama con rebotes DUROS (ver Task 14 del plan). */
export async function recordBounceAdmin(): Promise<OutreachConfig> {
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref());
    const current = snap.exists ? (snap.data() as OutreachConfig) : DEFAULT_CONFIG;
    const updated: OutreachConfig = { ...current, bouncedTotal: (current.bouncedTotal ?? 0) + 1 };
    tx.set(ref(), updated);
    return updated;
  });
}

/** Pausa el envío dejando constancia del motivo. El motivo no se borra al volver a encender. */
export async function pauseWithReasonAdmin(reason: string): Promise<void> {
  await ref().update({ enabled: false, pausedReason: reason });
}
