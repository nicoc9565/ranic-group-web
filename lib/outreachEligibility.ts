/**
 * Heurística de elegibilidad para el envío automático de primer contacto.
 *
 * PURA y sin I/O a propósito: se puede testear sin red ni Firestore. El chequeo de MX, que sí
 * hace I/O, vive aparte en lib/mxCheck.ts y corre como paso posterior en la capa de script.
 *
 * La lista de origen es del National Hardware Show y trae muchos fabricantes OEM del exterior: el
 * template first_short (pide wholesale price list con UPCs y pedidos mensuales) no les aplica, y
 * mandarles en frío genera bounces y marcas de spam. Se importan igual, pero no elegibles.
 *
 * El criterio castiga el dato que CONTRADICE, no el dato faltante: un proveedor sin teléfono no
 * se penaliza, uno con teléfono chino sí.
 */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Las listas van arriba para poder ajustarlas sin tocar la lógica.

/** TLDs que damos por no-US para este propósito. */
const NON_US_TLDS = new Set(["cn", "tw", "in", "hk", "kr", "vn", "pk", "tr", "ru"]);

/** Webmails de uso mayoritariamente asiático. */
const NON_US_WEBMAIL = new Set([
  "163.com",
  "126.com",
  "qq.com",
  "foxmail.com",
  "sina.com",
  "aliyun.com",
  "naver.com",
]);

export type IneligibleReason =
  | "sin email"
  | "teléfono internacional"
  | "TLD no-US"
  | "webmail no-US"
  | "teléfono no-NANP";

export const ALL_REASONS: IneligibleReason[] = [
  "sin email",
  "teléfono internacional",
  "TLD no-US",
  "webmail no-US",
  "teléfono no-NANP",
];

/** Formato del North American Numbering Plan: código de área y central arrancan en [2-9]. */
const NANP_RE = /^[2-9]\d{2}[2-9]\d{6}$/;

/** Teclado telefónico: ABC→2, DEF→3, ... WXYZ→9. Para los números vanity (1-800-GO-FEDEX). */
const KEYPAD: Record<string, string> = {};
for (const [digit, letters] of Object.entries({
  "2": "ABC",
  "3": "DEF",
  "4": "GHI",
  "5": "JKL",
  "6": "MNO",
  "7": "PQRS",
  "8": "TUV",
  "9": "WXYZ",
})) {
  for (const letter of letters) KEYPAD[letter] = digit;
}

/**
 * Separadores de "varios números en un mismo campo": barra, coma, "or", "ext"/"extension", una
 * "x" que precede dígitos (extensión), o doble espacio. La "x" se chequea después de "ext" para
 * que "ext 215" no se parta por la x del medio, y solo cuando la siguen dígitos, para no romper
 * palabras vanity que contienen X (IPOXI).
 */
const PHONE_SPLIT_RE = /\s*(?:\/|,|\bor\b|ext(?:ension)?\.?|x(?=\s*\d)|\s{2,})\s*/i;

/**
 * Las dos lecturas posibles de un fragmento: letras mapeadas al teclado (vanity) y letras
 * descartadas. Probar las dos evita que un prefijo de texto ("Tel: 908-...") se convierta en
 * dígitos basura y tumbe un número que en realidad es válido.
 */
function phoneReadings(fragment: string): string[] {
  const upper = fragment.toUpperCase();
  const vanity = upper
    .split("")
    .map((ch) => (/\d/.test(ch) ? ch : (KEYPAD[ch] ?? "")))
    .join("");
  const digitsOnly = upper.replace(/\D/g, "");
  return vanity === digitsOnly ? [digitsOnly] : [vanity, digitsOnly];
}

/**
 * true si el teléfono contradice el formato US/Canadá. Sin teléfono NO penaliza: el criterio
 * castiga el dato que contradice, no el dato faltante. Atrapa a los fabricantes asiáticos que
 * escriben el código de país sin "+" (86-579-..., 886-4-..., 13901574565).
 *
 * El campo se parte en fragmentos y alcanza con que UNO sea NANP válido: en la lista hay vanity
 * numbers ("888-908-BUGS"), extensiones ("877-311-2287 X101") y dos números en el mismo campo
 * ("877 864-2201 or 310 952-9000"). Los fragmentos cortos (una extensión suelta) se descartan en
 * silencio en vez de invalidar al conjunto.
 */
export function isNonNanpPhone(phone: string): boolean {
  if (!/\d/.test(phone)) return false;
  for (const fragment of phone.split(PHONE_SPLIT_RE)) {
    for (const digits of phoneReadings(fragment)) {
      if (!digits) continue;
      const core = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
      if (NANP_RE.test(core)) return false;
    }
  }
  return true;
}

/** Último label del host: "www.acme.com.cn" → "cn". "" si no se puede determinar. */
function tld(host: string): string {
  const clean = host
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0]
    .replace(/\.$/, "");
  const parts = clean.split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

/**
 * Motivos por los que un proveedor NO es candidato al envío automático, en el orden del plan.
 * Vacío = elegible. Se devuelven todos los que aplican (el primero es el que se reporta).
 */
export function ineligibleReasons(row: {
  email: string;
  phone: string;
  website: string;
}): IneligibleReason[] {
  const reasons: IneligibleReason[] = [];
  if (!EMAIL_RE.test(row.email)) reasons.push("sin email");

  // Prefijo internacional distinto de +1 (también en notación 00 + código de país).
  const phone = row.phone.replace(/[\s()-]/g, "");
  if ((/^\+/.test(phone) && !/^\+1/.test(phone)) || (/^00/.test(phone) && !/^001/.test(phone))) {
    reasons.push("teléfono internacional");
  }

  const emailDomain = row.email.toLowerCase().split("@")[1] ?? "";
  if (NON_US_TLDS.has(tld(row.website)) || NON_US_TLDS.has(tld(emailDomain))) {
    reasons.push("TLD no-US");
  }
  if (NON_US_WEBMAIL.has(emailDomain)) reasons.push("webmail no-US");
  if (isNonNanpPhone(row.phone)) reasons.push("teléfono no-NANP");

  return reasons;
}
