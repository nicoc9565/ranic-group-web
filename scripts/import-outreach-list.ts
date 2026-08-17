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
import { readFileSync } from "node:fs";
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

type ParsedProvider = Omit<Provider, "id" | "createdAt" | "updatedAt">;

function parseRows(filePath: string): {
  providers: Map<string, ParsedProvider>;
  totalRows: number;
  dupesInFile: number;
} {
  const buf = readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const providers = new Map<string, ParsedProvider>();
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
    const hasEmail = EMAIL_RE.test(email);
    const contactMethod: ContactMethod = hasEmail ? "Email" : "Web";
    const status: Status = "Por Contactar";

    providers.set(key, {
      company,
      contact: "", // el excel no trae persona de contacto → fallback de saludo (Task 2)
      email: hasEmail ? email : "",
      category: "General Merchandise", // sin descripción/notas confiables para inferCategory
      status,
      website: clean(row["Website"]),
      blacklisted: false,
      phone: clean(row["Phone Number"]),
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
    });
  }
  return { providers, totalRows: rows.length, dupesInFile };
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

  const { providers, totalRows, dupesInFile } = parseRows(filePath);

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
  console.log(`  con email válido → contactMethod "Email" (candidatos a envío automático): ${withEmail.length}`);
  console.log(`  sin email → contactMethod "Web": ${toImport.length - withEmail.length}`);

  if (dryRun) {
    console.log("\nPrimeros 5 a importar:");
    for (const [key, p] of toImport.slice(0, 5)) {
      console.log(`  ${key} | ${p.company} | ${p.email || "(sin email)"} | ${p.contactMethod}`);
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
