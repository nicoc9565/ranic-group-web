import type { BlacklistEntry } from "./types";

/**
 * Match de nombres contra la blacklist. PURO y sin Firebase a propósito: vive aparte de
 * lib/blacklist.ts (que inicializa el SDK) para poder testearse, igual que followup.ts o
 * contactStage.ts.
 */

/**
 * Largo mínimo de una entrada para matchear por inclusión.
 *
 * Por debajo se exige igualdad exacta. Con inclusión a secas, una entrada de tres letras como
 * "Ace" marcaba como blacklisteada a "Grace Foods" y a media lista. Mientras la blacklist era de
 * solo lectura y crecía únicamente por el seed casi no se notaba; con la pantalla escribible,
 * agregar una sigla corta pasa a ser normal y el falso positivo, probable.
 */
export const MIN_INCLUSION_LENGTH = 4;

/**
 * Chequeo flexible (case-insensitive) de si un nombre coincide con alguna entrada de la
 * blacklist. Pensado para avisar al crear/editar un proveedor.
 */
export function isBlacklisted(name: string, list: BlacklistEntry[]): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return false;
  return list.some((b) => {
    const bn = b.name.trim().toLowerCase();
    if (!bn) return false;
    if (bn.length < MIN_INCLUSION_LENGTH) return n === bn;
    return n.includes(bn) || bn.includes(n);
  });
}
