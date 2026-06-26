/**
 * Import de prospectos de Expo West 2026 desde los dos Excel a la colección expoProspects.
 *
 * Filtro: SOURCE CATEGORY ∈ {Cosmetics Personal Care, Pet, Home} y COUNTRY = United States.
 * Deduplica por empresa (el archivo Beauty se solapa con Exhibitors). Idempotente (id = slug).
 * Escribe con el SDK web autenticado (signInWithEmailAndPassword) — no requiere service account.
 *
 * Uso:
 *   npm run import-expo -- --dry-run   (solo parsea y reporta el conteo, no escribe ni loguea)
 *   npm run import-expo                (escribe a Firestore; necesita SEED_USER_PASSWORD en .env.local)
 */
import "./env";
import * as XLSX from "xlsx";
import type { ExpoProspect } from "../lib/types";

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
    .replace(/[̀-ͯ]/g, "") // quitar diacríticos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type Prospect = Omit<ExpoProspect, "id">;

/** Lee ambos Excel, filtra y deduplica por empresa. Devuelve los prospectos por id (slug). */
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

  const password = process.env.SEED_USER_PASSWORD;
  if (!password) {
    console.error(
      "\n✗ Falta SEED_USER_PASSWORD en .env.local (o usá --dry-run para solo contar).\n",
    );
    process.exit(1);
  }

  const { signInWithEmailAndPassword } = await import("firebase/auth");
  const { collection, doc, getCountFromServer, writeBatch } = await import(
    "firebase/firestore"
  );
  const { auth, db } = await import("../lib/firebase");

  const email = process.env.SEED_USER_EMAIL ?? "nicolas.conti@ranicgroup.com";
  await signInWithEmailAndPassword(auth, email, password);

  const batch = writeBatch(db);
  for (const [key, p] of prospects) {
    batch.set(doc(db, "expoProspects", key), p);
  }
  await batch.commit();

  const total = (
    await getCountFromServer(collection(db, "expoProspects"))
  ).data().count;
  console.log(`\n✓ Import completo. expoProspects en Firestore: ${total}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Error en el import:", err?.code ?? err);
  process.exit(1);
});
