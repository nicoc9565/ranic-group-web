/**
 * Import histórico de proveedores desde el CSV de la planilla de Nico a la colección
 * `providers`, más backfill de los proveedores ya seedeados con los campos nuevos
 * (contactMethod/phone/address/score) que no tenían. Ver spec
 * docs/superpowers/specs/2026-06-29-crm-provider-model-v2-design.md.
 *
 * - Filas con Status "Estafa" → van a `blacklist`, no a `providers`.
 * - Filas que ya existen como proveedores activos de la Fase 1 (mismo nombre
 *   normalizado) → se saltan, no se sobreescriben (ver SKIP_SLUGS).
 * - "Miami Trading Zone" se trata como estafa: no se importa a providers (sigue en
 *   blacklist, como ya está desde la Fase 1).
 *
 * Uso:
 *   npm run import-providers -- --dry-run   (solo parsea y reporta, no escribe)
 *   npm run import-providers                (escribe; necesita SEED_USER_PASSWORD)
 */
import { readFileSync } from "node:fs";
import "./env";
import { parse } from "csv-parse/sync";
import { signInWithEmailAndPassword } from "firebase/auth";
import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { inferCategory } from "../lib/categoryInference";
import type { ContactMethod, Provider, Status } from "../lib/types";

const CSV_PATH =
  "C:/Nico-Archivos/ClaudeCode/Ranic-Group/Base de Datos PROVEEDORES - BASE DE DATOS.csv";

// Ya existen como proveedores activos de la Fase 1 — no se pisan (ver Global Constraints
// del plan). "miami-trading-zone" se trata como estafa: sigue solo en blacklist.
const SKIP_SLUGS = new Set([
  "fragrancex",
  "ee-distribution",
  "tps-wholesale",
  "bd-distributors",
  "miami-trading-zone",
]);

const STATUS_MAP: Record<string, Status> = {
  Aprobado: "Aprobado",
  "En Espera de Respuesta": "En Espera de Respuesta",
  Rechazado: "Rechazado",
  "No Acepta Nuevos": "No Acepta Nuevos",
  "Por Contactar": "Por Contactar",
  Referido: "Referido",
};

const METHOD_MAP: Record<string, ContactMethod> = {
  Email: "Email",
  Llamada: "Llamada",
  Web: "Web",
};

type Row = Record<string, string>;

function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clean(value: string | undefined): string {
  const v = (value ?? "").trim();
  if (!v || v === "Desconocido" || /^-+$/.test(v)) return "";
  return v;
}

/** "15/1/26" → "2026-01-15". null si no matchea el formato esperado. */
function parseSpanishDate(value: string): string | null {
  const m = clean(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `20${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

type ParsedProvider = Omit<Provider, "id" | "createdAt" | "updatedAt">;

function parseRows(): {
  providers: Map<string, ParsedProvider>;
  blacklist: string[];
  skipped: string[];
} {
  const csv = readFileSync(CSV_PATH, "utf8");
  const rows: Row[] = parse(csv, { columns: true, skip_empty_lines: true });

  const providers = new Map<string, ParsedProvider>();
  const blacklist: string[] = [];
  const skipped: string[] = [];

  for (const row of rows) {
    const company = clean(row["Nombre de Proveedor"]);
    if (!company) continue; // filas vacías de relleno del CSV

    const key = slug(company);
    const statusRaw = clean(row["Status"]);

    if (statusRaw === "Estafa") {
      blacklist.push(company);
      continue;
    }
    if (SKIP_SLUGS.has(key)) {
      skipped.push(company);
      continue;
    }

    const contactDate = parseSpanishDate(row["Fecha de Contacto"]);
    const notes = clean(row["Notas"]);
    const method = METHOD_MAP[clean(row["Método de Contacto"])] ?? "Web";
    const status = STATUS_MAP[statusRaw] ?? "Por Contactar";
    const scoreNum = Number(clean(row["Score"]));

    providers.set(key, {
      company,
      contact: clean(row["Persona de Contacto"]),
      email: clean(row["Email"]),
      category: inferCategory(notes),
      status,
      website: clean(row["Web"]),
      blacklisted: false,
      phone: clean(row["Teléfono"]),
      address: clean(row["Dirección"]),
      contactMethod: method,
      score: Number.isFinite(scoreNum) ? scoreNum : 0,
      firstContactDate: contactDate,
      lastEmailDate: contactDate,
      followUpStep: -1,
      notes: notes && contactDate ? [{ date: contactDate, text: notes }] : [],
    });
  }

  return { providers, blacklist, skipped };
}

/** Patchea los proveedores existentes que todavía no tienen los campos nuevos. */
async function backfillExisting(): Promise<number> {
  const snap = await getDocs(collection(db, "providers"));
  let patched = 0;
  for (const d of snap.docs) {
    const data = d.data();
    if (data.contactMethod !== undefined) continue; // ya migrado, no tocar
    await updateDoc(doc(db, "providers", d.id), {
      contactMethod: "Email",
      phone: "",
      address: "",
      score: 0,
      updatedAt: Date.now(),
    });
    patched++;
  }
  return patched;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const { providers, blacklist, skipped } = parseRows();

  console.log(`\nProveedores a importar: ${providers.size}`);
  console.log(`Saltados por ya existir: ${skipped.length} (${skipped.join(", ")})`);
  console.log(`Nuevas entradas de blacklist (Estafa): ${blacklist.length}`);

  if (dryRun) {
    console.log("\n(--dry-run) No se escribió nada en Firestore.");
    process.exit(0);
  }

  const password = process.env.SEED_USER_PASSWORD;
  if (!password) {
    console.error(
      "\n✗ Falta SEED_USER_PASSWORD en .env.local (o usá --dry-run para solo contar).\n",
    );
    process.exit(1);
  }
  const email = process.env.SEED_USER_EMAIL ?? "nicolas.conti@ranicgroup.com";
  await signInWithEmailAndPassword(auth, email, password);

  const patched = await backfillExisting();
  console.log(`\n✓ Backfill: ${patched} proveedores existentes actualizados.`);

  const now = Date.now();
  const CHUNK = 50;
  const entries = [...providers];
  for (let i = 0; i < entries.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const [key, p] of entries.slice(i, i + CHUNK)) {
      batch.set(doc(db, "providers", key), {
        ...p,
        createdAt: now,
        updatedAt: now,
      });
    }
    await batch.commit();
  }

  if (blacklist.length > 0) {
    const bBatch = writeBatch(db);
    for (const name of blacklist) {
      bBatch.set(doc(db, "blacklist", slug(name)), { name });
    }
    await bBatch.commit();
  }

  const providersCount = (
    await getCountFromServer(collection(db, "providers"))
  ).data().count;
  const blacklistCount = (
    await getCountFromServer(collection(db, "blacklist"))
  ).data().count;

  console.log(`\n✓ Import completo.`);
  console.log(`  providers:  ${providersCount}`);
  console.log(`  blacklist:  ${blacklistCount}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Error en el import:", err?.code ?? err);
  process.exit(1);
});
