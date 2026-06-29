/**
 * Seed idempotente de Firestore: 9 proveedores activos (§8 del spec) + 25 blacklist (§9).
 *
 * Se autentica con el SDK web (signInWithEmailAndPassword) usando el login de Nico, y escribe
 * cumpliendo las reglas (auth != null). No requiere service account.
 *
 * Cómo correr:  npm run seed
 * Necesita en .env.local: las 6 claves NEXT_PUBLIC_FIREBASE_* + SEED_USER_PASSWORD
 * (y opcionalmente SEED_USER_EMAIL; por defecto nicolas.conti@ranicgroup.com).
 *
 * IDs deterministas por slug del nombre → re-correr no duplica, sobreescribe el mismo doc.
 */
import "./env";
import { signInWithEmailAndPassword } from "firebase/auth";
import {
  collection,
  doc,
  getCountFromServer,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import type { Category, Status } from "../lib/types";

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
    status: "En Negociación",
    lastEmailDate: "2026-06-10",
    note: "Requested catalog sample before paying commercial membership.",
  },
  {
    company: "Perfume Center / Worldwide",
    email: "elina@perfumeworldwide.com",
    contact: "Elina",
    category: "Fragancias & Beauty",
    status: "En Negociación",
    lastEmailDate: "2026-06-12",
    note: "Sister company confirmed. Requested catalog, ordering process and payment methods.",
  },
  {
    company: "Alliance Entertainment",
    email: "randy.martin@aent.com",
    contact: "Randy Martin",
    category: "Entertainment & Toys",
    status: "En Negociación",
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
  const email = process.env.SEED_USER_EMAIL ?? "nicolas.conti@ranicgroup.com";
  const password = process.env.SEED_USER_PASSWORD;
  if (!password) {
    console.error(
      "\n✗ Falta SEED_USER_PASSWORD en .env.local (password de Firebase del usuario de seed).\n",
    );
    process.exit(1);
  }

  await signInWithEmailAndPassword(auth, email, password);
  const now = Date.now();

  const pBatch = writeBatch(db);
  for (const p of PROVIDERS) {
    pBatch.set(doc(db, "providers", slug(p.company)), {
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

  const bBatch = writeBatch(db);
  for (const name of BLACKLIST) {
    bBatch.set(doc(db, "blacklist", slug(name)), { name });
  }
  await bBatch.commit();

  const providersCount = (
    await getCountFromServer(collection(db, "providers"))
  ).data().count;
  const blacklistCount = (
    await getCountFromServer(collection(db, "blacklist"))
  ).data().count;

  console.log(`\n✓ Seed completo.`);
  console.log(`  providers:  ${providersCount} (esperado 9)`);
  console.log(`  blacklist:  ${blacklistCount} (esperado 25)`);
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Error en el seed:", err?.code ?? err);
  process.exit(1);
});
