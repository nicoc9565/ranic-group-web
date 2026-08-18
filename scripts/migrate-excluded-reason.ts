/**
 * Migración one-shot: separa `excludedReason` de `sendError`.
 *
 * Los dos campos decían cosas opuestas y estaban en el mismo lugar. `sendError` es un intento de
 * envío que falló; las exclusiones de MX nunca se intentaron. Mezclados, la tabla de "envíos
 * fallidos" mostraba 15 filas de las cuales 14 eran no-fallos, y el único fallo real quedaba
 * sepultado abajo.
 *
 * Hace dos cosas:
 *   1. A los marcados por check-mx: mueve el valor de sendError a excludedReason y deja
 *      sendError en null.
 *   2. Suma macphersonart.com, que check-mx dejó sin marcar por dar ESERVFAIL (error transitorio,
 *      y la regla es no marcar por un fallo de red). Verificado a mano desde dos resolvers: falla
 *      en MX, NS y A. Que falle NS es lo decisivo — la delegación del dominio está rota, no es un
 *      blip. La regla de check-mx NO se afloja: este caso se marca acá, a mano y documentado.
 *
 * Uso:
 *   npm run migrate-excluded-reason -- --dry-run
 *   npm run migrate-excluded-reason
 */
import "./env";
import { adminDb } from "../lib/firebaseAdmin";
import { domainOf } from "../lib/mxCheck";
import type { Provider } from "../lib/types";

const MX_REASON = "dominio sin registro MX";
const MANUAL_REASON = "dominio sin registro MX (zona DNS rota, verificado a mano)";
const MANUAL_DOMAIN = "macphersonart.com";

type Patch = { id: string; company: string; email: string; patch: Record<string, unknown> };

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const patches: Patch[] = [];

  // 1. Los que ya marcó check-mx, por igualdad sobre sendError (query de un solo campo).
  const marked = await adminDb()
    .collection("providers")
    .where("sendError", "==", MX_REASON)
    .get();

  for (const d of marked.docs) {
    const p = { id: d.id, ...(d.data() as Omit<Provider, "id">) };
    patches.push({
      id: p.id,
      company: p.company,
      email: p.email,
      patch: { excludedReason: MX_REASON, sendError: null, updatedAt: Date.now() },
    });
  }
  console.log(`\nMarcados por check-mx (sendError == "${MX_REASON}"): ${marked.size}`);

  // 2. macphersonart.com. No se puede filtrar por dominio en Firestore, así que se recorren los
  //    elegibles. Es la parte cara de esta migración: ~905 lecturas.
  const eligibles = await adminDb()
    .collection("providers")
    .where("outreachEligible", "==", true)
    .get();

  let manualHits = 0;
  for (const d of eligibles.docs) {
    const p = { id: d.id, ...(d.data() as Omit<Provider, "id">) };
    if (domainOf(p.email) !== MANUAL_DOMAIN) continue;
    manualHits++;
    patches.push({
      id: p.id,
      company: p.company,
      email: p.email,
      patch: {
        outreachEligible: false,
        excludedReason: MANUAL_REASON,
        sendError: null,
        updatedAt: Date.now(),
      },
    });
  }
  console.log(`Elegibles recorridos: ${eligibles.size} → con ${MANUAL_DOMAIN}: ${manualHits}`);

  console.log(`\nDocumentos a tocar: ${patches.length}`);
  for (const x of patches) {
    console.log(`  ${x.email.padEnd(38)} ${x.company}`);
  }

  if (dryRun) {
    console.log("\n--dry-run: no se escribió nada.\n");
    return;
  }

  const batch = adminDb().batch();
  for (const x of patches) {
    batch.update(adminDb().collection("providers").doc(x.id), x.patch);
  }
  await batch.commit();
  console.log(`\n✓ Documentos actualizados: ${patches.length}\n`);
}

main().then(() => process.exit(0));
