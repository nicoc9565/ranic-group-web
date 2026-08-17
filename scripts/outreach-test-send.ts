/**
 * Runbook del envío de prueba de outreach, con los candados en código.
 *
 * Dos rondas, cada una con su proveedor de prueba y su propio doc ID (que tiene que ordenar
 * antes que cualquier otro para quedar primero en la cola — Firestore ordena por __name__ y los
 * IDs reales del import arrancan con dígitos o letras > "0").
 *
 * Candados:
 *   1. doc ID que ordena primero  → el proveedor de prueba es el primero de la cola.
 *   2. dailyLimit = 1             → como mucho sale UN email por día, pase lo que pase.
 *   3. gate antes de encender     → el dry-run tiene que devolver candidates=1 y ese doc ID.
 *
 * Uso:
 *   npm run outreach-test -- create --id 0-test-ronda-1 --email <destino> --company "Test Ronda 1"
 *   npm run outreach-test -- gate   --id 0-test-ronda-1
 *   npm run outreach-test -- send   --id 0-test-ronda-1     ← el único que manda un email real
 *   npm run outreach-test -- verify --id 0-test-ronda-1
 *   npm run outreach-test -- reset-counter                  ← sentToday a 0, entre rondas
 *   npm run outreach-test -- check-replies
 *   npm run outreach-test -- optout --id 0-test-ronda-1
 *
 * Flag opcional --base <url> (default http://localhost:3000) para apuntar a producción.
 */
import "./env";
import { adminDb } from "../lib/firebaseAdmin";
import { getOutreachConfigAdmin } from "../lib/outreachConfigAdmin";
import type { OutreachConfig, Provider } from "../lib/types";

const args = process.argv.slice(2);
const command = args[0];

function flag(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
}

const BASE = flag("base") ?? "http://localhost:3000";
const CONFIG_REF = () => adminDb().collection("outreachConfig").doc("config");

function requireId(): string {
  const id = flag("id");
  if (!id) throw new Error("Falta --id");
  return id;
}

function authHeaders(): Record<string, string> {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("Falta CRON_SECRET en .env.local");
  return { authorization: `Bearer ${secret}` };
}

async function post(path: string) {
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers: authHeaders() });
  const body = await res.json();
  return { status: res.status, body };
}

async function create() {
  const id = requireId();
  const email = flag("email");
  const company = flag("company") ?? "Test Envio Ranic";
  if (!email) throw new Error("Falta --email");
  if (!id.startsWith("0")) {
    throw new Error(`El doc ID tiene que empezar con "0" para ordenar primero. Recibí: ${id}`);
  }

  const now = Date.now();
  const doc: Omit<Provider, "id"> = {
    company,
    contact: "",
    email,
    phone: "",
    address: "",
    category: "General Merchandise",
    status: "Por Contactar",
    website: "",
    contactMethod: "Email",
    score: 0,
    blacklisted: false,
    firstContactDate: null,
    lastEmailDate: null,
    followUpStep: -1,
    notes: [],
    gmailThreadId: null,
    sendAttemptedAt: null,
    sendError: null,
    source: "expo-outreach-import",
    optedOut: false,
    outreachEligible: true,
    createdAt: now,
    updatedAt: now,
  };
  await adminDb().collection("providers").doc(id).set(doc);
  console.log(`✓ Proveedor de prueba creado: ${id} → ${email}`);
}

/** Gate: dry-run que confirma que el único candidato es el proveedor de prueba de esta ronda. */
async function gate(): Promise<boolean> {
  const id = requireId();
  const config = await getOutreachConfigAdmin();
  console.log("config:", JSON.stringify(config));

  if (config.dailyLimit !== 1) {
    console.error(`✗ ABORTA: dailyLimit es ${config.dailyLimit}, tiene que ser 1.`);
    return false;
  }
  if (config.sentToday !== 0) {
    console.error(`✗ ABORTA: sentToday es ${config.sentToday}. Corré reset-counter primero.`);
    return false;
  }

  const { status, body } = await post("/api/outreach/send-batch?dryRun=1");
  console.log("dry-run:", status, JSON.stringify(body));

  if (body.candidates !== 1) {
    console.error(`✗ ABORTA: candidates=${body.candidates}, esperaba 1.`);
    return false;
  }
  if (body.sample?.[0]?.id !== id) {
    console.error(`✗ ABORTA: el primero de la cola es ${body.sample?.[0]?.id}, no ${id}.`);
    return false;
  }
  console.log(`✓ GATE OK: el único candidato es ${id} (${body.sample[0].email}).`);
  return true;
}

/** Enciende, dispara una vez y apaga. El apagado va en finally: pase lo que pase, queda en false. */
async function send() {
  if (!(await gate())) {
    console.error("\nNo se envió nada.");
    process.exit(1);
  }

  console.log("\nenabled → true");
  await CONFIG_REF().update({ enabled: true });
  try {
    const { status, body } = await post("/api/outreach/send-batch");
    console.log("send-batch:", status, JSON.stringify(body));
  } finally {
    await CONFIG_REF().update({ enabled: false });
    const after = (await CONFIG_REF().get()).data() as OutreachConfig;
    console.log("enabled → false | config:", JSON.stringify(after));
  }
}

async function verify() {
  const id = requireId();
  const snap = await adminDb().collection("providers").doc(id).get();
  const p = snap.data() as Provider;
  const checks: [string, boolean, unknown][] = [
    ["status === Contactado", p.status === "Contactado", p.status],
    ["gmailThreadId presente", !!p.gmailThreadId, p.gmailThreadId],
    ["sendAttemptedAt presente", p.sendAttemptedAt != null, p.sendAttemptedAt],
    ["sendError null", p.sendError == null, p.sendError],
    ["replyCheckedAt presente", p.replyCheckedAt != null, p.replyCheckedAt],
    ["firstContactDate presente", !!p.firstContactDate, p.firstContactDate],
    ["followUpStep === 0", p.followUpStep === 0, p.followUpStep],
  ];
  for (const [label, ok, value] of checks) {
    console.log(`${ok ? "✓" : "✗"} ${label.padEnd(28)} ${JSON.stringify(value)}`);
  }
  console.log("\nnotas:", JSON.stringify(p.notes));
}

async function main() {
  switch (command) {
    case "create":
      return create();
    case "gate":
      return void (await gate());
    case "send":
      return send();
    case "verify":
      return verify();
    case "set-limit": {
      const value = Number(flag("value"));
      if (!Number.isInteger(value) || value < 0) throw new Error("Falta --value <entero >= 0>");
      await CONFIG_REF().update({ dailyLimit: value });
      console.log("✓ dailyLimit →", value, "|", JSON.stringify(await getOutreachConfigAdmin()));
      return;
    }
    case "reset-counter": {
      await CONFIG_REF().update({ sentToday: 0 });
      console.log("✓ sentToday → 0 |", JSON.stringify(await getOutreachConfigAdmin()));
      return;
    }
    case "check-replies": {
      const { status, body } = await post("/api/outreach/check-replies");
      console.log("check-replies:", status, JSON.stringify(body));
      return;
    }
    case "optout": {
      await adminDb().collection("providers").doc(requireId()).update({ optedOut: true });
      console.log("✓ optedOut → true");
      return;
    }
    default:
      console.error("Comando desconocido. Ver el encabezado del archivo para el uso.");
      process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FALLO:", e?.message ?? e);
    process.exit(1);
  });
