import { describe, expect, test } from "vitest";
import { computeBucket, withBucket } from "../contactStage";
import { unsubscribePatch } from "../outreachPatches";
import { isSendCandidate } from "../sendCandidate";
import {
  isUnsubscribeRequest,
  senderAddress,
  shouldOptOut,
  type OptOutCandidate,
} from "../unsubscribeClassification";
import type { Provider } from "../types";

const ENVIO = Date.parse("2026-08-21T13:20:00.000Z");
const DESPUES = ENVIO + 60_000;

/** Un proveedor de la campaña al que ya le mandamos el primer contacto. */
const contactado: OptOutCandidate = {
  email: "sales@acme.com",
  source: "expo-outreach-import",
  sendAttemptedAt: ENVIO,
  optedOut: false,
};

const bajaLegitima = { sender: "sales@acme.com", receivedAt: DESPUES };

const asunto = (subject: string, from = "Sales <sales@acme.com>") => ({
  headers: { subject, from },
});

describe("qué asunto cuenta como pedido de baja", () => {
  test("el asunto exacto que genera nuestra cabecera", () => {
    expect(isUnsubscribeRequest(asunto("Unsubscribe"))).toBe(true);
    expect(isUnsubscribeRequest(asunto("unsubscribe"))).toBe(true);
    expect(isUnsubscribeRequest(asunto("  Unsubscribe  "))).toBe(true);
  });

  test("con el 'Re:' que agregan algunos clientes", () => {
    expect(isUnsubscribeRequest(asunto("Re: Unsubscribe"))).toBe(true);
  });
});

// ── LOS CASOS QUE NO DEBEN MARCAR ───────────────────────────────────────────────────────────
// Marcar optedOut de más es, en la práctica, irreversible. Estos tres son el motivo por el que
// el clasificador es estricto, y son los que hay que mirar si alguien lo quiere aflojar.
describe("lo que NO se marca solo", () => {
  test("un humano pidiendo la baja con sus palabras", () => {
    expect(isUnsubscribeRequest(asunto("please remove me from your list"))).toBe(false);
    expect(isUnsubscribeRequest(asunto("Re: Wholesale inquiry - Acme"))).toBe(false);
    expect(isUnsubscribeRequest(asunto("unsubscribe request"))).toBe(false);
    expect(isUnsubscribeRequest(asunto("How do I unsubscribe?"))).toBe(false);
    expect(isUnsubscribeRequest(asunto("Fwd: Unsubscribe"))).toBe(false);
  });

  test("una baja desde una dirección que no es la del proveedor", () => {
    const deOtro = { sender: "otra.persona@gmail.com", receivedAt: DESPUES };
    expect(shouldOptOut(contactado, deOtro)).toBe(false);
  });

  test("una baja ANTERIOR a nuestro envío", () => {
    // El caso real que esto evita: un mail viejo con ese asunto, de otra campaña o de un
    // proveedor que nos escribió por su cuenta, matando a alguien a quien recién contactamos.
    const vieja = { sender: "sales@acme.com", receivedAt: ENVIO - 1 };
    expect(shouldOptOut(contactado, vieja)).toBe(false);
  });

  test("un mail exactamente simultáneo al envío tampoco cuenta", () => {
    expect(shouldOptOut(contactado, { sender: "sales@acme.com", receivedAt: ENVIO })).toBe(false);
  });

  test("un proveedor al que nunca le mandamos nada", () => {
    expect(shouldOptOut({ ...contactado, sendAttemptedAt: null }, bajaLegitima)).toBe(false);
  });

  test("un proveedor manual, que Nico gestiona a mano", () => {
    expect(shouldOptOut({ ...contactado, source: "manual" }, bajaLegitima)).toBe(false);
  });

  test("uno ya dado de baja: no se reescribe en cada corrida", () => {
    expect(shouldOptOut({ ...contactado, optedOut: true }, bajaLegitima)).toBe(false);
  });
});

describe("la baja legítima sí se marca", () => {
  test("todos los guardas en verde", () => {
    expect(shouldOptOut(contactado, bajaLegitima)).toBe(true);
  });

  test("la dirección compara sin importar mayúsculas ni espacios", () => {
    expect(shouldOptOut({ ...contactado, email: " Sales@Acme.com " }, bajaLegitima)).toBe(true);
  });
});

describe("de quién vino el pedido", () => {
  test("parsea el From con nombre y sin nombre", () => {
    expect(senderAddress("Sales Team <Sales@Acme.com>")).toBe("sales@acme.com");
    expect(senderAddress("sales@acme.com")).toBe("sales@acme.com");
  });

  test("sin dirección parseable devuelve null, no adivina", () => {
    expect(senderAddress(undefined)).toBe(null);
    expect(senderAddress("Mailer Daemon")).toBe(null);
    expect(senderAddress("<>")).toBe(null);
  });
});

describe("qué queda escrito al marcar la baja", () => {
  const p = {
    company: "Acme",
    status: "Contactado",
    email: "sales@acme.com",
    source: "expo-outreach-import",
    firstContactDate: "2026-08-21",
    sendAttemptedAt: ENVIO,
    optedOut: false,
    outreachEligible: true,
    followUpStep: 0,
    blacklisted: false,
    notes: [],
  } as unknown as Provider;

  const marcado = { ...p, ...withBucket(p, unsubscribePatch(DESPUES) as Record<string, unknown>) };

  test("el bucket pasa a descartado", () => {
    expect(computeBucket(p)).toBe("contactado");
    expect(marcado.bucket).toBe("descartado");
  });

  test("deja de ser candidato del envío automático", () => {
    expect(marcado.optedOut).toBe(true);
    expect(isSendCandidate({ ...marcado, status: "Por Contactar", sendAttemptedAt: null })).toBe(
      false,
    );
  });

  test("detiene el follow-up", () => {
    expect(marcado.followUpStopped).toBe(true);
  });

  test("NO toca outreachEligible: mide la dirección, no la voluntad", () => {
    expect(marcado.outreachEligible).toBe(true);
  });
});
