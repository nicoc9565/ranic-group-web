// Solo para código de browser (el panel /admin/outreach) — usa el SDK cliente, requiere sesión.
// La variante para los endpoints de cron es lib/outreachConfigAdmin.ts.
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { OutreachConfig } from "./types";

const REF = doc(db, "outreachConfig", "config");

const DEFAULT_CONFIG: OutreachConfig = {
  dailyLimit: 20,
  enabled: false, // arranca pausado; Nico lo activa a mano desde /admin/outreach cuando esté listo
  sentToday: 0,
  lastResetDate: new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }),
};

export async function getOutreachConfig(): Promise<OutreachConfig> {
  const snap = await getDoc(REF);
  if (!snap.exists()) {
    await setDoc(REF, DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }
  return snap.data() as OutreachConfig;
}

export function subscribeOutreachConfig(cb: (c: OutreachConfig) => void) {
  return onSnapshot(REF, (snap) => {
    if (snap.exists()) cb(snap.data() as OutreachConfig);
  });
}

export function updateOutreachConfig(patch: Partial<OutreachConfig>) {
  return updateDoc(REF, patch);
}
