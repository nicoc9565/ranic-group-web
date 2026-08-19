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
import { domainOf, resolveDomains } from "../lib/mxCheck";
import {
  ALL_REASONS,
  EMAIL_RE,
  ineligibleReasons,
  type IneligibleReason,
} from "../lib/outreachEligibility";
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

  // ── Paso posterior: chequeo de MX ─────────────────────────────────────────
  // El heurístico de lib/outreachEligibility.ts es puro y no toca la red. Esto sí: un dominio sin
  // registro MX no recibe correo, así que ese envío es un rebote duro garantizado y se gastaría
  // contra el 5% que tolera el cortacircuito. Se corre acá para que cualquier lista futura entre
  // ya filtrada, en vez de descubrirlo cuando empiezan a volver los rebotes.
  //
  // Un fallo transitorio de DNS no marca a nadie (ver lib/mxCheck.ts): se reporta y listo.
  const mxCandidates = toImport.filter(([, p]) => p.outreachEligible && p.email !== "");
  const mxDomains = [
    ...new Set(mxCandidates.map(([, p]) => domainOf(p.email)).filter(Boolean)),
  ];
  let mxMarked = 0;
  if (mxDomains.length > 0) {
    console.log(`
Chequeo de MX sobre ${mxDomains.length} dominios de los elegibles…`);
    const verdicts = await resolveDomains(mxDomains);
    const dead = new Set(
      [...verdicts].filter(([, v]) => v === "sin-mx").map(([d]) => d),
    );
    const transient = [...verdicts.values()].filter((v) => v === "error-transitorio").length;
    for (const [, p] of mxCandidates) {
      if (!dead.has(domainOf(p.email))) continue;
      p.outreachEligible = false;
      p.sendError = "dominio sin registro MX";
      mxMarked++;
    }
    console.log(`  dominios sin MX: ${dead.size} → ${mxMarked} proveedores marcados no elegibles`);
    console.log(`  errores transitorios de DNS: ${transient} (no marcan a nadie)`);
  }

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
