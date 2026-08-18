/**
 * Migración one-shot de los campos que introdujo la reestructuración del CRM (Task 3):
 *
 *   - companyLower  → company.toLowerCase(), para búsqueda y orden.
 *   - replyDetectedAt / bounceType → deducidos de las notas que dejó el cron hasta ahora.
 *   - source: "manual" → SOLO donde el campo esté ausente, nunca pisando un import.
 *   - bucket → la etapa de contacto ya resuelta (ver lib/contactStage.ts).
 *
 * ORDEN: correr `migrate-excluded-reason` ANTES que esto. `excludedReason` es el primer peldaño
 * de la escalera de computeBucket, así que si se calcula el bucket antes de moverlo, los 15
 * excluidos por MX quedan en la etapa equivocada.
 *
 * Este es el ÚNICO lugar donde leer las notas por string es correcto: es la traducción del
 * formato viejo al nuevo, se corre una vez y no vuelve a mirarse. De acá en adelante los campos
 * los escribe check-replies (Task 2) y nadie parsea texto para saber si un proveedor respondió.
 *
 * Solo completa campos AUSENTES: si check-replies ya escribió uno, no lo pisa.
 *
 * Uso:
 *   npm run migrate-contact-fields -- --dry-run   (no escribe nada, reporta el desglose)
 *   npm run migrate-contact-fields                (escribe, en batches de 500)
 */
import "./env";
import { computeBucket } from "../lib/contactStage";
import { adminDb } from "../lib/firebaseAdmin";
import type { Provider } from "../lib/types";

// Los textos exactos que escribió check-replies hasta hoy. Si alguno cambia, esta migración ya
// corrió: no hay que actualizarlos, hay que borrar el script.
const REPLY_NOTE_TEXT = "Respuesta detectada — revisar Gmail.";
const HARD_BOUNCE_NOTE = "Rebote duro — la dirección no existe.";
const SOFT_BOUNCE_NOTE = "Rebote transitorio — puede reintentarse.";

const BATCH_LIMIT = 500;

/** Timestamp aproximado a partir del día de la nota: medianoche UTC de esa fecha. */
function noteTimestamp(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const snap = await adminDb().collection("providers").get();
  console.log(`\nProveedores leídos: ${snap.size}`);

  const patches: { id: string; company: string; patch: Record<string, unknown> }[] = [];
  const counts = { companyLower: 0, replyDetectedAt: 0, hard: 0, soft: 0, source: 0, bucket: 0 };
  const byBucket = new Map<string, number>();

  for (const d of snap.docs) {
    const p = { id: d.id, ...(d.data() as Omit<Provider, "id">) };
    const patch: Record<string, unknown> = {};

    const lower = (p.company ?? "").toLowerCase();
    if (p.companyLower !== lower) {
      patch.companyLower = lower;
      counts.companyLower++;
    }

    const notes = p.notes ?? [];
    const find = (text: string) => notes.find((n) => n.text === text);

    if (p.replyDetectedAt === undefined) {
      const n = find(REPLY_NOTE_TEXT);
      if (n) {
        patch.replyDetectedAt = noteTimestamp(n.date);
        counts.replyDetectedAt++;
      }
    }

    if (p.bounceType === undefined) {
      // Un duro gana sobre un blando: si las dos notas existen, la dirección no existe.
      const hard = find(HARD_BOUNCE_NOTE);
      const soft = find(SOFT_BOUNCE_NOTE);
      if (hard) {
        patch.bounceType = "hard";
        counts.hard++;
      } else if (soft) {
        patch.bounceType = "soft";
        counts.soft++;
      }
    }

    // El Dashboard busca los candidatos a follow-up con where("source","==","manual"). Los
    // proveedores cargados antes de que existiera el campo no tienen ninguno, y una query de
    // igualdad no los ve. Se completa solo donde falta: un "expo-outreach-import" no se pisa.
    if (p.source === undefined) {
      patch.source = "manual";
      counts.source++;
    }

    // bucket se calcula sobre el documento YA parcheado: si en esta misma corrida se dedujo un
    // bounceType "hard", la etapa tiene que reflejarlo.
    const bucket = computeBucket({ ...p, ...patch } as Provider);
    byBucket.set(bucket, (byBucket.get(bucket) ?? 0) + 1);
    if (p.bucket !== bucket) {
      patch.bucket = bucket;
      counts.bucket++;
    }

    if (Object.keys(patch).length > 0) {
      patches.push({ id: p.id, company: p.company, patch });
    }
  }

  console.log(`\nDocumentos a tocar: ${patches.length}`);
  console.log(`  companyLower a escribir : ${counts.companyLower}`);
  console.log(`  replyDetectedAt deducido: ${counts.replyDetectedAt}`);
  console.log(`  bounceType "hard"       : ${counts.hard}`);
  console.log(`  bounceType "soft"       : ${counts.soft}`);
  console.log(`  source "manual"         : ${counts.source}`);
  console.log(`  bucket a escribir       : ${counts.bucket}`);
  console.log(`
  distribución por etapa (todos los proveedores):`);
  for (const [b, n] of [...byBucket].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${b.padEnd(16)} ${n}`);
  }

  const deduced = patches.filter(
    (x) => "replyDetectedAt" in x.patch || "bounceType" in x.patch,
  );
  if (deduced.length > 0) {
    console.log(`\nDeducidos de notas (${deduced.length}):`);
    for (const x of deduced) {
      console.log(`  ${x.id} — ${x.company} → ${JSON.stringify(x.patch)}`);
    }
  }

  if (dryRun) {
    console.log("\n--dry-run: no se escribió nada.\n");
    return;
  }

  let written = 0;
  for (let i = 0; i < patches.length; i += BATCH_LIMIT) {
    const chunk = patches.slice(i, i + BATCH_LIMIT);
    const batch = adminDb().batch();
    for (const x of chunk) {
      batch.update(adminDb().collection("providers").doc(x.id), x.patch);
    }
    await batch.commit();
    written += chunk.length;
    console.log(`  batch ${i / BATCH_LIMIT + 1}: ${chunk.length} documentos (total ${written})`);
  }

  console.log(`\n✓ Documentos actualizados: ${written}\n`);
}

main().then(() => process.exit(0));
