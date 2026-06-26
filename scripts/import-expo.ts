/**
 * Import de prospectos de Expo West 2026 desde los dos Excel a la colección expoProspects.
 *
 * Filtro: SOURCE CATEGORY ∈ {Cosmetics Personal Care, Pet, Home} y COUNTRY = United States.
 * Deduplica por empresa (el archivo Beauty se solapa con Exhibitors). Idempotente (id = slug).
 *
 * Uso:
 *   npm run import-expo -- --dry-run   (solo parsea y reporta el conteo, no escribe)
 *   npm run import-expo                (escribe a Firestore; requiere scripts/serviceAccount.json)
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import type { ExpoProspect } from "../lib/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVICE_ACCOUNT_PATH = resolve(__dirname, "serviceAccount.json");

const FILES = [
  "C:/Nico-Archivos/ClaudeCode/Ranic-Group/Expo West 2026 - Beauty & Personal Care.xlsx",
  "C:/Nico-Archivos/ClaudeCode/Ranic-Group/Expo West 2026_ Exhibitors.xlsx",
];

// Token de SOURCE CATEGORY → grupo normalizado (prioridad en este orden).
const GROUPS: { token: string; label: string }[] = [
  { token: "Cosmetics Personal Care", label: "Cosmetics & Personal Care" },
  { token: "Pet", label: "Pet Products" },
  { token: "Home", label: "Home Products" },
];

type Row = Record<string, unknown>;

function matchedGroup(sourceCategory: string): string | null {
  const tokens = sourceCategory.split(";").map((t) => t.trim());
  for (const g of GROUPS) if (tokens.includes(g.token)) return g.label;
  return null;
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type Prospect = Omit<ExpoProspect, "id">;

/** Lee ambos Excel, filtra y deduplica por empresa. Devuelve los prospectos. */
function parseProspects(): Map<string, Prospect> {
  const byCompany = new Map<string, Prospect>();
  for (const file of FILES) {
    const wb = XLSX.readFile(file);
    for (const sheetName of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<Row>(wb.Sheets[sheetName], { defval: "" });
      for (const r of rows) {
        const group = matchedGroup(String(r["SOURCE CATEGORY"] ?? ""));
        if (!group) continue;
        if (String(r["COUNTRY"] ?? "").trim() !== "United States") continue;

        const company = String(r["COMPANY"] ?? "").trim();
        if (!company) continue;
        const key = slug(company);
        if (byCompany.has(key)) continue; // dedupe (primera ocurrencia)

        byCompany.set(key, {
          company,
          brands: String(r["BRAND(S)"] ?? "").trim(),
          category: group,
          city: String(r["CITY"] ?? "").trim(),
          state: String(r["STATE"] ?? "").trim(),
          website: "",
          email: "",
          mailSent: false,
          dateSent: null,
          response: "",
          notes: "",
        });
      }
    }
  }
  return byCompany;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const prospects = parseProspects();

  const counts = new Map<string, number>();
  for (const p of prospects.values())
    counts.set(p.category, (counts.get(p.category) ?? 0) + 1);

  console.log(`\nProspectos únicos US (filtrados): ${prospects.size}`);
  for (const g of GROUPS) console.log(`  ${g.label}: ${counts.get(g.label) ?? 0}`);

  if (dryRun) {
    console.log("\n(--dry-run) No se escribió nada en Firestore.");
    process.exit(0);
  }

  if (!existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error(
      `\n✗ Falta la service account key en:\n  ${SERVICE_ACCOUNT_PATH}\n` +
        "Generala en Firebase console → Project Settings → Service accounts →\n" +
        "Generate new private key, guardala como scripts/serviceAccount.json, o usá --dry-run.\n",
    );
    process.exit(1);
  }

  const { cert, initializeApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  // Escribir en lotes (≤500 por batch; acá entran de sobra).
  const batch = db.batch();
  for (const [key, p] of prospects) {
    batch.set(db.collection("expoProspects").doc(key), p);
  }
  await batch.commit();

  const total = (await db.collection("expoProspects").count().get()).data().count;
  console.log(`\n✓ Import completo. expoProspects en Firestore: ${total}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Error en el import:", err);
  process.exit(1);
});
