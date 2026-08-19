import { describe, expect, test } from "vitest";
import { computeBucket, withBucket } from "../contactStage";
import { blacklistPatch } from "../outreachPatches";
import { isSendCandidate, SEND_CANDIDATE_FILTERS } from "../sendCandidate";
import type { Provider } from "../types";

/** Un proveedor importado que hoy es candidato vivo del envío automático. */
const candidato = {
  id: "acme-inc",
  company: "Acme Inc",
  companyLower: "acme inc",
  status: "Por Contactar",
  contactMethod: "Email",
  source: "expo-outreach-import",
  outreachEligible: true,
  optedOut: false,
  sendAttemptedAt: null,
  blacklisted: false,
  excludedReason: null,
  firstContactDate: null,
  replyDetectedAt: null,
  bounceType: null,
  notes: [],
} as unknown as Provider;

/** Lo que queda escrito al marcarlo desde el formulario (values → setBlacklisted → updateProvider). */
function marcarDesdeFormulario(p: Provider, blacklisted: boolean) {
  return { ...p, ...withBucket(p, blacklistPatch(blacklisted) as Record<string, unknown>) };
}

describe("el punto de partida", () => {
  test("el proveedor de prueba es candidato de send-batch", () => {
    expect(isSendCandidate(candidato)).toBe(true);
  });
});

describe("marcar como blacklisteado desde el formulario", () => {
  const marcado = marcarDesdeFormulario(candidato, true);

  // Este es el bug que motivó el cambio: el checkbox escribía solo `blacklisted`, el bucket
  // quedaba bien —"descartado", así que desaparecía de la pantalla— y el proveedor seguía
  // siendo candidato del cron. Invisible y activo a la vez.
  test("DEJA de ser candidato de send-batch", () => {
    expect(isSendCandidate(marcado)).toBe(false);
  });

  test("y además el bucket queda en descartado", () => {
    expect(marcado.bucket).toBe("descartado");
  });

  test("apaga los dos campos que send-batch sí filtra", () => {
    expect(marcado.optedOut).toBe(true);
    expect(marcado.outreachEligible).toBe(false);
  });

  test("detiene el follow-up: no tiene sentido insistirle a quien bloqueaste", () => {
    expect(marcado.followUpStopped).toBe(true);
  });

  // La garantía de fondo: escribir SOLO blacklisted no alcanzaría, porque ese campo no está
  // entre los filtros del envío. Si algún día se agrega, este test deja de tener sentido y hay
  // que revisar el comentario de lib/sendCandidate.ts.
  test("blacklisted por sí solo NO sacaría al proveedor del envío", () => {
    const soloFlag = { ...candidato, blacklisted: true } as Provider;
    expect(computeBucket(soloFlag)).toBe("descartado");
    expect(isSendCandidate(soloFlag)).toBe(true);
  });
});

describe("desmarcar", () => {
  test("vuelve a blacklisted false y reanuda el follow-up", () => {
    const marcado = marcarDesdeFormulario(candidato, true);
    const desmarcado = marcarDesdeFormulario(marcado as Provider, false);
    expect(desmarcado.blacklisted).toBe(false);
    expect(desmarcado.optedOut).toBe(false);
    expect(desmarcado.followUpStopped).toBe(false);
  });

  test("NO resucita outreachEligible", () => {
    // Pudo haberse apagado por otra razón (dominio sin MX, rebote duro). Desmarcar la blacklist
    // no puede volver a meter en la campaña a una dirección que ya sabemos que no recibe.
    const marcado = marcarDesdeFormulario(candidato, true);
    const desmarcado = marcarDesdeFormulario(marcado as Provider, false);
    expect(desmarcado.outreachEligible).toBe(false);
    expect(isSendCandidate(desmarcado)).toBe(false);
  });
});

describe("SEND_CANDIDATE_FILTERS es la fuente única", () => {
  test("son los seis filtros del envío automático", () => {
    expect(SEND_CANDIDATE_FILTERS.map(([f]) => f)).toEqual([
      "status",
      "contactMethod",
      "source",
      "outreachEligible",
      "optedOut",
      "sendAttemptedAt",
    ]);
  });

  test("cada filtro por separado alcanza para descartar a un candidato", () => {
    // Si alguno dejara de discriminar, isSendCandidate estaría midiendo de menos y el test de
    // arriba pasaría por el motivo equivocado.
    for (const [field, value] of SEND_CANDIDATE_FILTERS) {
      const roto = { ...candidato, [field]: value === null ? 1 : "otro" } as Provider;
      expect(isSendCandidate(roto)).toBe(false);
    }
  });

  test("sendAttemptedAt ausente tampoco es candidato (igual que Firestore)", () => {
    // where(campo, "==", null) NO matchea los documentos sin el campo.
    const sinCampo = { ...candidato };
    delete (sinCampo as Record<string, unknown>).sendAttemptedAt;
    expect(isSendCandidate(sinCampo)).toBe(false);
  });
});
