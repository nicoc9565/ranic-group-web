/**
 * Red contra la deriva del campo `bucket`.
 *
 * `bucket` es un CACHE de computeBucket() persistido en Firestore, porque la escalera de
 * precedencia de las etapas de contacto no se puede expresar como filtros de Firestore. Como todo
 * cache, puede quedar desincronizado: alcanza con un camino de escritura nuevo que se olvide de
 * recalcularlo. Ese tipo de bug no rompe nada visiblemente — la pantalla simplemente muestra a un
 * proveedor en la columna equivocada, y nadie se entera.
 *
 * Este script compara lo guardado contra lo recalculado y reporta las diferencias.
 *
 * ⚠ CUESTA UNA LECTURA COMPLETA DE LA COLECCIÓN (~2500 lecturas). El proyecto está en el plan
 * Spark, con 50.000 lecturas por día compartidas con la app y los crons. NO es un script para
 * correr a la ligera ni en un loop: se corre después de una migración, o cuando hay una sospecha
 * concreta de deriva. Presupuestalo.
 *
 * Uso:
 *   npm run verify-buckets
 */
import "./env";
import { computeBucket } from "../lib/contactStage";
import { adminDb } from "../lib/firebaseAdmin";
import type { Provider } from "../lib/types";

async function main() {
  const snap = await adminDb().collection("providers").get();
  console.log(`\nProveedores leídos: ${snap.size}  (costo: ~${snap.size} lecturas)`);

  const mismatches: { id: string; company: string; guardado: string; real: string }[] = [];
  const missing: string[] = [];
  const byBucket = new Map<string, number>();

  for (const d of snap.docs) {
    const p = { id: d.id, ...(d.data() as Omit<Provider, "id">) };
    const real = computeBucket(p);
    byBucket.set(real, (byBucket.get(real) ?? 0) + 1);

    if (p.bucket === undefined) {
      missing.push(p.id);
      continue;
    }
    if (p.bucket !== real) {
      mismatches.push({ id: p.id, company: p.company, guardado: p.bucket, real });
    }
  }

  console.log("\nDistribución real (recalculada):");
  let total = 0;
  for (const [b, n] of [...byBucket].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${b.padEnd(16)} ${n}`);
    total += n;
  }
  console.log(`  ${"TOTAL".padEnd(16)} ${total}`);

  console.log(`\nSin campo bucket : ${missing.length}`);
  if (missing.length > 0) console.log(`  ${missing.slice(0, 20).join(", ")}`);

  console.log(`Desincronizados  : ${mismatches.length}`);
  for (const m of mismatches.slice(0, 50)) {
    console.log(`  ${m.id} — ${m.company}: guardado "${m.guardado}" vs real "${m.real}"`);
  }

  if (mismatches.length === 0 && missing.length === 0) {
    console.log("\n✓ El cache coincide con el recálculo en los " + snap.size + " documentos.\n");
  } else {
    console.log("\n✗ Hay deriva. Corré migrate-contact-fields para reescribir los buckets.\n");
    process.exitCode = 1;
  }
}

main().then(() => process.exit(process.exitCode ?? 0));
