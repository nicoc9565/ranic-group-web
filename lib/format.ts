// Utilidades de formato de fecha para la UI (las fechas se guardan como ISO yyyy-mm-dd).

/** ISO yyyy-mm-dd → dd/mm/yyyy. Devuelve "—" si es null. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** ISO yyyy-mm-dd → dd/mm (corto, para etiquetas chicas). */
export function formatShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** Suma días a una fecha ISO (UTC), devuelve ISO yyyy-mm-dd. */
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
