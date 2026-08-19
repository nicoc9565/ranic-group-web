import type { Provider } from "./types";

/**
 * Los filtros que definen a quién le manda el envío automático, UNA sola vez y como dato.
 *
 * Existen así porque los consumía tres veces por separado: la query de `send-batch`, el contador
 * de "pendientes de envío" del panel, y cualquier test que quiera verificar que un proveedor dejó
 * de ser candidato. Tres copias de una regla es tres oportunidades de que una se quede vieja, y la
 * que se quedaría vieja en silencio es la del test — validando su propia copia mientras el cron
 * hace otra cosa.
 *
 * `blacklisted` NO está acá, y es a propósito: `where("blacklisted", "==", false)` descartaría los
 * documentos que no tienen el campo, y un candidato sin él saldría de la campaña para siempre sin
 * que nada lo dispare. En vez de filtrar, se garantiza en la escritura — ver `blacklistPatch`, que
 * apaga `optedOut` y `outreachEligible`, que sí están en esta lista.
 */
export const SEND_CANDIDATE_FILTERS = [
  ["status", "Por Contactar"],
  ["contactMethod", "Email"],
  ["source", "expo-outreach-import"],
  ["outreachEligible", true],
  ["optedOut", false],
  ["sendAttemptedAt", null],
] as const satisfies readonly (readonly [keyof Provider, unknown])[];

/**
 * Versión en memoria del mismo criterio, para tests.
 *
 * ── QUÉ NO PRUEBA ──────────────────────────────────────────────────────────────────────────
 * Evalúa un objeto en memoria: NO modela cómo Firestore descarta los documentos a los que les
 * FALTA un campo. Dos documentos que esta función clasifica igual pueden diferir en la query
 * real si a uno le falta alguno de los seis campos — Firestore no lo devuelve, y acá el `===`
 * contra `undefined` puede dar cualquiera de las dos cosas según el valor esperado.
 *
 * Sirve para testear la lógica de los filtros: que marcar a un proveedor lo saque del conjunto,
 * que cada filtro discrimine. NO sirve para predecir qué va a devolver la query, ni para
 * afirmar que un documento concreto va a entrar en la próxima tanda. Eso solo lo dice correr
 * la query.
 *
 * El único caso que sí coincide por construcción es `sendAttemptedAt == null`: Firestore matchea
 * los documentos con el campo en null pero no los que no lo tienen, igual que `undefined === null`
 * da false acá. Es una coincidencia útil, no una garantía general.
 */
export function isSendCandidate(p: Partial<Provider>): boolean {
  return SEND_CANDIDATE_FILTERS.every(
    ([field, value]) => (p as Record<string, unknown>)[field] === value,
  );
}
