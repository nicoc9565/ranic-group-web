/**
 * Seed idempotente de Firestore: 9 proveedores activos (§8 del spec) + 25 blacklist (§9).
 *
 * Requiere una service account key en scripts/serviceAccount.json (gitignored).
 * Cómo correr:  npm run seed
 *
 * Usa firebase-admin (saltea las reglas de Firestore). IDs deterministas por slug del nombre
 * de la empresa → re-correr el seed no duplica, sobreescribe el mismo documento.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { Category, Status } from "../lib/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVICE_ACCOUNT_PATH = resolve(__dirname, "serviceAccount.json");

type SeedProvider = {
  company: string;
  email: string;
  contact: string;
  category: Category;
  status: Status;
  lastEmailDate: string;
  note: string;
};

// §8 del spec — textual, no negociable.
const PROVIDERS: SeedProvider[] = [
  {
    company: "FragranceX",
    email: "support@fragrancex.com",
    contact: "Ces",
    category: "Fragancias & Beauty",
    status: "Aprobado",
    lastEmailDate: "2026-06-01",
    note: "Account approved. Catalog has no UPCs — requested Excel with UPCs.",
  },
  {
    company: "SN International",
    email: "info@snillc.com",
    contact: "Sales Team",
    category: "General Merchandise",
    status: "En negociación",
    lastEmailDate: "2026-06-10",
    note: "Requested catalog sample before paying commercial membership.",
  },
  {
    company: "Perfume Center / Worldwide",
    email: "elina@perfumeworldwide.com",
    contact: "Elina",
    category: "Fragancias & Beauty",
    status: "En negociación",
    lastEmailDate: "2026-06-12",
    note: "Sister company confirmed. Requested catalog, ordering process and payment methods.",
  },
  {
    company: "Alliance Entertainment",
    email: "randy.martin@aent.com",
    contact: "Randy Martin",
    category: "Entertainment & Toys",
    status: "En negociación",
    lastEmailDate: "2026-06-20",
    note: "Spreadsheet received. Requested WebAMI access reactivation to verify stock.",
  },
  {
    company: "EE Distribution",
    email: "eedadmin@eedistribution.com",
    contact: "Sales Team",
    category: "General Merchandise",
    status: "Contactado",
    lastEmailDate: "2026-06-15",
    note: "Registration form completed.",
  },
  {
    company: "TPS Wholesale",
    email: "info@tps-wholesale.com",
    contact: "Sales Team",
    category: "Fragancias & Beauty",
    status: "Contactado",
    lastEmailDate: "2026-06-08",
    note: "Form completed with Resale Certificate.",
  },
  {
    company: "BD Distributors",
    email: "info@bddistributors.com",
    contact: "Sales Team",
    category: "Fragancias & Beauty",
    status: "Contactado",
    lastEmailDate: "2026-06-08",
    note: "Form completed.",
  },
  {
    company: "Goodbye Inventory",
    email: "contact@goodbyeinventory.com",
    contact: "Sales Team",
    category: "Fragancias & Beauty",
    status: "Contactado",
    lastEmailDate: "2026-06-25",
    note: "Requested price list in Excel with UPCs.",
  },
  {
    company: "WholesalePet",
    email: "service@wholesalepet.com",
    contact: "Sales Team",
    category: "Pet Products",
    status: "Contactado",
    lastEmailDate: "2026-06-18",
    note: "Requested price list with UPCs.",
  },
];

// §9 del spec — textual, no negociable (25 entradas).
const BLACKLIST: string[] = [
  "ESM Trading LLC",
  "Econzeller",
  "Upsellwholesale",
  "Nation Distributor (Nashville)",
  "Nexus Wholesale",
  "Premier Products Co. US",
  "ZG Distribution",
  "Swanson Distribution",
  "Artext Wholesale / Artext LLC",
  "Flo Distribution",
  "EN Distribution / EN Wholesale LLC",
  "Royal Wholesale INC",
  "GABA Distribution",
  "Prime Pallet Wholesale Deals / Source Buys Inc",
  "Supply Leader",
  "B2B Wholesale LLC",
  "Tsubaki-us",
  "Palletfly",
  "Century Wholesalers LLC (Wyoming)",
  "Jefferson Wholesale",
  "Reliable Distribuidor LLC",
  "VITAL DISTRIBUTIONS (Texas)",
  "Petco Wholesale",
  "Medcare LLC",
  "Miami Trading Zone",
];

/** Slug estable para usar como id de documento (idempotencia). */
function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quitar diacríticos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  if (!existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error(
      `\n✗ Falta la service account key en:\n  ${SERVICE_ACCOUNT_PATH}\n\n` +
        "Generala en Firebase console → Project Settings → Service accounts →\n" +
        "Generate new private key, y guardá el JSON como scripts/serviceAccount.json\n",
    );
    process.exit(1);
  }

  const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();
  const now = Date.now();

  // Providers
  let pBatch = db.batch();
  for (const p of PROVIDERS) {
    const ref = db.collection("providers").doc(slug(p.company));
    pBatch.set(ref, {
      company: p.company,
      contact: p.contact,
      email: p.email,
      category: p.category,
      status: p.status,
      website: "",
      blacklisted: false,
      firstContactDate: p.lastEmailDate,
      lastEmailDate: p.lastEmailDate,
      followUpStep: 0,
      notes: [{ date: p.lastEmailDate, text: p.note }],
      createdAt: now,
      updatedAt: now,
    });
  }
  await pBatch.commit();

  // Blacklist
  let bBatch = db.batch();
  for (const name of BLACKLIST) {
    const ref = db.collection("blacklist").doc(slug(name));
    bBatch.set(ref, { name });
  }
  await bBatch.commit();

  const providersCount = (await db.collection("providers").count().get()).data().count;
  const blacklistCount = (await db.collection("blacklist").count().get()).data().count;

  console.log(`\n✓ Seed completo.`);
  console.log(`  providers:  ${providersCount} (esperado 9)`);
  console.log(`  blacklist:  ${blacklistCount} (esperado 25)`);
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Error en el seed:", err);
  process.exit(1);
});
