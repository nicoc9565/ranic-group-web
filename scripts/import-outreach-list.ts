/**
 * Import masivo del Excel de ~2700 proveedores de outreach (exhibitors de la feria) a `providers`.
 * Descarta Booth/Stand, Description y Brands (spec §7). Dedupea contra proveedores existentes y
 * blacklist por nombre normalizado, mismo patrón que scripts/import-providers.ts.
 *
 * Uso:
 *   npm run import-outreach-list -- --file "docs/Lista-de-Empresas-Exhibidoras.xlsx" --dry-run
 *   npm run import-outreach-list -- --file "docs/Lista-de-Empresas-Exhibidoras.xlsx"
 */
import "./env";
import { readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { signInWithEmailAndPassword } from "firebase/auth";
import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import type { ContactMethod, Provider, Status } from "../lib/types";

function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Elegibilidad para el envío automático ─────────────────────────────────
// La lista es del National Hardware Show y trae muchos fabricantes OEM del exterior: el template
// first_short (pide wholesale price list con UPCs y pedidos mensuales) no les aplica, y mandarles
// en frío genera bounces y marcas de spam. Se importan igual, pero marcados como no elegibles.
// Las listas van acá arriba para poder ajustarlas sin tocar la lógica.

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

type IneligibleReason =
  | "sin email"
  | "teléfono internacional"
  | "TLD no-US"
  | "webmail no-US"
  | "teléfono no-NANP";

const ALL_REASONS: IneligibleReason[] = [
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
function isNonNanpPhone(phone: string): boolean {
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
function ineligibleReasons(row: {
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

type ParsedProvider = Omit<Provider, "id" | "createdAt" | "updatedAt">;

/** Motivos de exclusión por slug, para el desglose y el CSV de revisión. */
type ExclusionLog = Map<string, IneligibleReason[]>;

function parseRows(filePath: string): {
  providers: Map<string, ParsedProvider>;
  totalRows: number;
  dupesInFile: number;
  exclusions: ExclusionLog;
} {
  const buf = readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const providers = new Map<string, ParsedProvider>();
  const exclusions: ExclusionLog = new Map();
  let dupesInFile = 0;
  for (const row of rows) {
    const company = clean(row["Company Name"]);
    if (!company) continue;

    const key = slug(company);
    if (providers.has(key)) {
      dupesInFile++;
      continue; // duplicado dentro del mismo excel, se queda con el primero
    }

    const email = clean(row["Email Address"]);
    const phone = clean(row["Phone Number"]);
    const website = clean(row["Website"]);
    const hasEmail = EMAIL_RE.test(email);
    // contactMethod refleja el dato real del proveedor (y activa el Follow-up Track). La
    // exclusión del envío automático va aparte, en outreachEligible.
    const contactMethod: ContactMethod = hasEmail ? "Email" : "Web";
    const status: Status = "Por Contactar";

    const reasons = ineligibleReasons({ email, phone, website });
    if (reasons.length > 0) exclusions.set(key, reasons);

    providers.set(key, {
      company,
      contact: "", // el excel no trae persona de contacto → fallback de saludo (Task 2)
      email: hasEmail ? email : "",
      category: "General Merchandise", // sin descripción/notas confiables para inferCategory
      status,
      website,
      blacklisted: false,
      phone,
      address: "",
      contactMethod,
      score: 0,
      firstContactDate: null,
      lastEmailDate: null,
      followUpStep: -1,
      notes: [],
      gmailThreadId: null,
      sendAttemptedAt: null,
      sendError: null,
      source: "expo-outreach-import",
      optedOut: false,
      outreachEligible: reasons.length === 0,
    });
  }
  return { providers, totalRows: rows.length, dupesInFile, exclusions };
}

/** Escapa un campo para CSV (comillas dobles + duplicado de comillas internas). */
function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Vuelca excluidos a CSV. Además de la columna resumen "Criterios" hay una columna por criterio
 * con "x", para poder filtrar en Excel sin leer texto libre. `only` limita a los que cayeron
 * únicamente por ese criterio (las vistas de revisión que pidió Nico).
 */
function writeExclusionsCsv(
  path: string,
  providers: Map<string, ParsedProvider>,
  exclusions: ExclusionLog,
  only?: IneligibleReason,
): number {
  const header = ["Company", "Email", "Telefono", "Website", "Criterios", "CantCriterios"]
    .concat(ALL_REASONS)
    .map(csvCell)
    .join(",");
  const lines = [header];
  let count = 0;
  for (const [key, reasons] of exclusions) {
    if (only && !(reasons.length === 1 && reasons[0] === only)) continue;
    const p = providers.get(key);
    if (!p) continue;
    const cells = [p.company, p.email, p.phone, p.website, reasons.join(" + "), String(reasons.length)]
      .concat(ALL_REASONS.map((r) => (reasons.includes(r) ? "x" : "")))
      .map(csvCell);
    lines.push(cells.join(","));
    count++;
  }
  writeFileSync(path, `﻿${lines.join("\r\n")}\r\n`, "utf8");
  return count;
}

/**
 * Slugs ya ocupados: el id del doc y, además, el slug del nombre real. Los proveedores cargados
 * desde el formulario del CRM tienen id autogenerado por Firestore, no slug — sin el segundo
 * criterio se colarían duplicados de esos.
 */
async function existingSlugs(): Promise<Set<string>> {
  const [providersSnap, blacklistSnap] = await Promise.all([
    getDocs(collection(db, "providers")),
    getDocs(collection(db, "blacklist")),
  ]);
  const slugs = new Set<string>();
  for (const d of providersSnap.docs) {
    slugs.add(d.id);
    const company = clean(d.data().company);
    if (company) slugs.add(slug(company));
  }
  for (const d of blacklistSnap.docs) {
    slugs.add(d.id);
    const name = clean(d.data().name);
    if (name) slugs.add(slug(name));
  }
  return slugs;
}

async function main() {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf("--file");
  if (fileIdx === -1 || !args[fileIdx + 1]) {
    console.error("Falta --file <ruta al .xlsx>");
    process.exit(1);
  }
  const filePath = args[fileIdx + 1];
  const dryRun = args.includes("--dry-run");

  const { providers, totalRows, dupesInFile, exclusions } = parseRows(filePath);

  const password = process.env.SEED_USER_PASSWORD;
  const email = process.env.SEED_USER_EMAIL ?? "nicolas.conti@ranicgroup.com";
  if (password) await signInWithEmailAndPassword(auth, email, password);
  const existing = await existingSlugs();

  const toImport = [...providers].filter(([key]) => !existing.has(key));
  const withEmail = toImport.filter(([, p]) => p.email !== "");

  console.log(`\nFilas en el Excel: ${totalRows}`);
  console.log(`  sin Company Name: ${totalRows - providers.size - dupesInFile}`);
  console.log(`  duplicadas dentro del Excel: ${dupesInFile}`);
  console.log(`Empresas únicas: ${providers.size}`);
  console.log(`Ya existían (proveedor o blacklist): ${providers.size - toImport.length}`);
  console.log(`Nuevos a importar: ${toImport.length}`);
  console.log(`  con email válido → contactMethod "Email": ${withEmail.length}`);
  console.log(`  sin email → contactMethod "Web": ${toImport.length - withEmail.length}`);

  const eligible = toImport.filter(([, p]) => p.outreachEligible);
  const ineligible = toImport.filter(([, p]) => !p.outreachEligible);

  console.log(`\nElegibles para envío automático: ${eligible.length}`);
  console.log(`No elegibles: ${ineligible.length}`);

  // Primer criterio que lo excluyó (mutuamente excluyente: los conteos suman el total).
  const byFirstReason = new Map<string, number>();
  // Cuántos cumplen cada criterio, contando solapamientos.
  const byAnyReason = new Map<string, number>();
  for (const [key] of ineligible) {
    const reasons = exclusions.get(key) ?? [];
    if (reasons.length === 0) continue;
    byFirstReason.set(reasons[0], (byFirstReason.get(reasons[0]) ?? 0) + 1);
    for (const r of reasons) byAnyReason.set(r, (byAnyReason.get(r) ?? 0) + 1);
  }
  console.log("  por criterio (el primero que aplicó, suman el total):");
  for (const [r, n] of [...byFirstReason].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${r.padEnd(24)} ${n}`);
  }
  console.log("  por criterio (contando solapamientos):");
  for (const [r, n] of [...byAnyReason].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${r.padEnd(24)} ${n}`);
  }

  if (dryRun) {
    const rows = new Map(toImport);
    const excl = new Map([...exclusions].filter(([k]) => !existing.has(k)));
    const csvs: [string, number][] = [
      ["docs/outreach-excluidos.csv", writeExclusionsCsv("docs/outreach-excluidos.csv", rows, excl)],
      [
        "docs/outreach-excluidos-solo-tld.csv",
        writeExclusionsCsv("docs/outreach-excluidos-solo-tld.csv", rows, excl, "TLD no-US"),
      ],
      [
        "docs/outreach-excluidos-solo-nanp.csv",
        writeExclusionsCsv("docs/outreach-excluidos-solo-nanp.csv", rows, excl, "teléfono no-NANP"),
      ],
    ];
    console.log("\nCSVs de revisión:");
    for (const [path, n] of csvs) console.log(`  ${path.padEnd(40)} ${n} filas`);

    console.log("\nPrimeros 5 elegibles:");
    for (const [key, p] of eligible.slice(0, 5)) {
      console.log(`  ${key} | ${p.company} | ${p.email} | ${p.phone || "(sin tel)"}`);
    }
    console.log("\n(--dry-run) No se escribió nada en Firestore.");
    process.exit(0);
  }

  if (!password) {
    console.error("\nFalta SEED_USER_PASSWORD en .env.local para escribir.\n");
    process.exit(1);
  }

  const now = Date.now();
  const CHUNK = 50;
  for (let i = 0; i < toImport.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const [key, p] of toImport.slice(i, i + CHUNK)) {
      batch.set(doc(db, "providers", key), { ...p, createdAt: now, updatedAt: now });
    }
    await batch.commit();
  }

  const count = (await getCountFromServer(collection(db, "providers"))).data().count;
  console.log(`\n✓ Import completo. providers: ${count}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Error en el import:", err?.code ?? err);
  process.exit(1);
});
