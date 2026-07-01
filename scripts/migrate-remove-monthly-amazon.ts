/**
 * Migración one-shot: borra los movimientos mensuales de Amazon cargados por el import viejo
 * (scripts/import-amazon-transactions.ts), para no contar doble al pasar al modelo por
 * liquidación. Solo borra movimientos cuya descripción empieza con "Ventas Amazon — " o
 * "Comisión Amazon — " Y que NO tengan importSource (los cargados a mano no se tocan).
 *
 * Uso:
 *   npm run migrate-remove-monthly-amazon -- --dry-run   (solo lista, no borra)
 *   npm run migrate-remove-monthly-amazon                (borra; necesita SEED_USER_PASSWORD)
 */
import "./env";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import type { Transaction } from "../lib/types";

const MONTHLY_RE = /^(Ventas Amazon|Comisión Amazon) — /;

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const password = process.env.SEED_USER_PASSWORD;
  if (!password) {
    console.error(
      "\n✗ Falta SEED_USER_PASSWORD en .env.local (leer Firestore requiere login).\n",
    );
    process.exit(1);
  }
  const email = process.env.SEED_USER_EMAIL ?? "nicolas.conti@ranicgroup.com";
  await signInWithEmailAndPassword(auth, email, password);

  const snap = await getDocs(collection(db, "transactions"));
  const targets = snap.docs.filter((d) => {
    const t = d.data() as Transaction;
    return MONTHLY_RE.test(t.description ?? "") && t.importSource === undefined;
  });

  console.log(`\nMovimientos mensuales viejos de Amazon a borrar: ${targets.length}`);
  for (const d of targets) {
    const t = d.data() as Transaction;
    console.log(
      `  ${t.date}  ${t.type.padEnd(8)} $${Number(t.amount).toFixed(2).padStart(9)}  ${t.description}`,
    );
  }

  if (dryRun) {
    console.log("\n(--dry-run) No se borró nada en Firestore.");
    process.exit(0);
  }

  for (const d of targets) {
    await deleteDoc(doc(db, "transactions", d.id));
  }

  console.log(`\n✓ Migración completa. ${targets.length} movimientos borrados.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Error en la migración:", err?.code ?? err);
  process.exit(1);
});
