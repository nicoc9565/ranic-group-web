/**
 * Pre-flight de DNS sobre los candidatos al envío automático: marca como no elegibles a los
 * proveedores cuyo dominio de email no tiene registro MX.
 *
 * Por qué: un dominio sin MX no recibe correo. Ese envío es un rebote duro garantizado, y los
 * rebotes duros son la métrica que mira el cortacircuito (5% histórico). Gastar ese presupuesto
 * en correo que ya sabemos que no llega es regalar margen de reputación a cambio de nada.
 *
 * Un fallo transitorio de DNS (timeout, SERVFAIL, EAI_AGAIN) NO marca a nadie: se reporta aparte
 * y el proveedor queda como estaba. Marcar por un problema de red propio sería sacar de la
 * campaña a gente que sí recibe correo, y nadie lo notaría después.
 *
 * NO corrige typos. "info@magnogrip.cpm" es obviamente ".com", pero una dirección adivinada que
 * rebota es peor que una que no se manda: los queda para revisión manual.
 *
 * Uso:
 *   npm run check-mx -- --dry-run   (resuelve y reporta, no escribe)
 *   npm run check-mx                (escribe outreachEligible:false + sendError)
 */
import "./env";
import { adminDb } from "../lib/firebaseAdmin";
import { domainOf, resolveDomains, type DomainVerdict } from "../lib/mxCheck";
import type { Provider } from "../lib/types";

const SEND_ERROR = "dominio sin registro MX";
const BATCH_LIMIT = 500;

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const snap = await adminDb()
    .collection("providers")
    .where("outreachEligible", "==", true)
    .get();

  const providers = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Provider, "id">) }))
    .filter((p) => (p.email ?? "").trim() !== "");

  const domains = [...new Set(providers.map((p) => domainOf(p.email)).filter(Boolean))];

  console.log(`\nElegibles con email: ${providers.length}`);
  console.log(`Dominios únicos a resolver: ${domains.length}`);

  const verdicts = await resolveDomains(domains);

  const dead = [...verdicts.entries()].filter(([, v]) => v === "sin-mx").map(([d]) => d);
  const transient = [...verdicts.entries()].filter(([, v]) => v === "error-transitorio").map(([d]) => d);
  const ok = domains.length - dead.length - transient.length;

  console.log(`\n  con MX            : ${ok}`);
  console.log(`  SIN MX (muertos)  : ${dead.length}`);
  console.log(`  error transitorio : ${transient.length}  (no se marca a nadie por esto)`);

  if (transient.length > 0) {
    console.log(`\nDominios que fallaron por DNS transitorio (revisar en otra corrida):`);
    for (const d of transient) console.log(`  ${d}`);
  }

  const deadSet = new Set(dead);
  const affected = providers.filter((p) => deadSet.has(domainOf(p.email)));

  console.log(`\nProveedores afectados: ${affected.length}`);
  for (const p of affected) {
    console.log(`  ${p.email.padEnd(38)} ${p.company}`);
  }

  if (dryRun) {
    console.log("\n--dry-run: no se escribió nada.\n");
    return;
  }

  let written = 0;
  for (let i = 0; i < affected.length; i += BATCH_LIMIT) {
    const chunk = affected.slice(i, i + BATCH_LIMIT);
    const batch = adminDb().batch();
    for (const p of chunk) {
      // Solo estos dos campos: status y notas son el registro humano y no los toca un chequeo
      // automático de DNS.
      batch.update(adminDb().collection("providers").doc(p.id), {
        outreachEligible: false,
        sendError: SEND_ERROR,
        updatedAt: Date.now(),
      });
    }
    await batch.commit();
    written += chunk.length;
  }

  console.log(`\n✓ Proveedores marcados como no elegibles: ${written}\n`);
}

main().then(() => process.exit(0));

export type { DomainVerdict };
