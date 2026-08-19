import { describe, expect, test } from "vitest";
import { computeBucket, withBucket, type ContactBucket } from "../contactStage";
import {
  hardBouncePatch,
  replyDetectedPatch,
  sendFailurePatch,
  sendSuccessPatch,
  softBouncePatch,
} from "../outreachPatches";
import type { Provider } from "../types";

const NOW = Date.parse("2026-08-19T13:10:00.000Z");
const TODAY = "2026-08-19";

/**
 * Un proveedor recién importado, tal cual lo deja el import de outreach: sin contactar, elegible,
 * sin nada escrito por los crons. Es el punto de partida de toda la campaña.
 */
const nuevo = {
  id: "acme-inc",
  company: "Acme Inc",
  status: "Por Contactar",
  blacklisted: false,
  optedOut: false,
  outreachEligible: true,
  firstContactDate: null,
  lastEmailDate: null,
  followUpStep: -1,
  gmailThreadId: null,
  sendAttemptedAt: null,
  sendError: null,
  replyDetectedAt: null,
  bounceType: null,
  excludedReason: null,
  source: "expo-outreach-import",
  notes: [],
} as unknown as Provider;

/** El bucket que quedaría escrito si el cron aplicara este patch a este proveedor. */
function bucketTrasEscribir(p: Provider, patch: Partial<Provider>): ContactBucket {
  return withBucket(p, patch as Record<string, unknown>).bucket;
}

describe("send-batch — envío exitoso", () => {
  const patch = sendSuccessPatch(nuevo, {
    threadId: "1a0118359093412c",
    now: NOW,
    sentDate: TODAY,
  });

  test("el bucket escrito pasa de sin-contactar a contactado", () => {
    expect(computeBucket(nuevo)).toBe("sin-contactar");
    expect(bucketTrasEscribir(nuevo, patch)).toBe("contactado");
  });

  test("escribe firstContactDate, que es de lo que depende el bucket", () => {
    expect(patch.firstContactDate).toBe(TODAY);
  });

  test("escribe replyCheckedAt en 0 para que el cron de respuestas lo vea", () => {
    // Firestore excluye de un orderBy los documentos que no tienen el campo: sin este 0 el
    // proveedor nunca se chequearía.
    expect(patch.replyCheckedAt).toBe(0);
  });
});

describe("send-batch — envío fallido", () => {
  const patch = sendFailurePatch({ now: NOW, message: "550 mailbox unavailable" });

  test("el bucket sigue en sin-contactar, no pasa a contactado", () => {
    expect(bucketTrasEscribir(nuevo, patch)).toBe("sin-contactar");
  });

  test("no escribe firstContactDate: sin eso, contactado quedaría sin fecha", () => {
    // Un "contactado" sin firstContactDate desaparecería de la pantalla, porque la query que
    // separa contactado de sin-respuesta filtra por ese campo y Firestore descarta los docs que
    // no lo tienen.
    expect(patch.firstContactDate).toBeUndefined();
    expect(patch.sendAttemptedAt).toBe(NOW);
  });
});

describe("check-replies — respuesta detectada (el crítico)", () => {
  /** Un proveedor ya contactado por el programa, esperando respuesta. */
  const contactado = {
    ...nuevo,
    status: "Contactado",
    firstContactDate: TODAY,
    followUpStep: 0,
    sendAttemptedAt: NOW,
    replyCheckedAt: 0,
  } as Provider;

  test("escribir replyDetectedAt deja el bucket en respondio", () => {
    expect(computeBucket(contactado)).toBe("contactado");
    const patch = replyDetectedPatch(contactado, NOW);
    expect(patch.replyDetectedAt).toBe(NOW);
    expect(bucketTrasEscribir(contactado, patch)).toBe("respondio");
  });

  test("una segunda corrida no reescribe el timestamp ni cambia el bucket", () => {
    const yaRespondio = { ...contactado, replyDetectedAt: NOW } as Provider;
    const patch = replyDetectedPatch(yaRespondio, NOW + 3_600_000);
    expect(patch).toEqual({});
    expect(bucketTrasEscribir(yaRespondio, patch)).toBe("respondio");
  });

  test("si además está optedOut, descartado gana sobre respondio", () => {
    const dadoDeBaja = { ...contactado, optedOut: true } as Provider;
    const patch = replyDetectedPatch(dadoDeBaja, NOW);
    expect(bucketTrasEscribir(dadoDeBaja, patch)).toBe("descartado");
  });
});

describe("check-replies — rebotes", () => {
  const contactado = {
    ...nuevo,
    status: "Contactado",
    firstContactDate: TODAY,
    followUpStep: 0,
    sendAttemptedAt: NOW,
  } as Provider;

  test("rebote duro deja el bucket en rebotado", () => {
    const patch = hardBouncePatch({ now: NOW, reason: "550 5.1.1 user unknown" });
    expect(bucketTrasEscribir(contactado, patch)).toBe("rebotado");
  });

  test("rebote duro además lo saca del envío automático y del follow-up", () => {
    const patch = hardBouncePatch({ now: NOW, reason: "550 5.1.1 user unknown" });
    expect(patch.outreachEligible).toBe(false);
    expect(patch.followUpStopped).toBe(true);
  });

  test("rebote blando NO mueve el bucket: sigue contactado", () => {
    const patch = softBouncePatch(contactado, { now: NOW });
    expect(patch.bounceType).toBe("soft");
    expect(bucketTrasEscribir(contactado, patch)).toBe("contactado");
  });

  test("un blando posterior no degrada un duro ya escrito", () => {
    const yaDuro = { ...contactado, bounceType: "hard" } as Provider;
    const patch = softBouncePatch(yaDuro, { now: NOW });
    expect(patch.bounceType).toBeUndefined();
    expect(bucketTrasEscribir(yaDuro, patch)).toBe("rebotado");
  });
});

describe("withBucket", () => {
  test("calcula sobre el documento YA parcheado, no sobre el original", () => {
    // Si calculara sobre el original, un proveedor que acaba de responder quedaría en
    // "contactado" y no aparecería nunca en la etapa Respondió.
    const out = withBucket(nuevo, { replyDetectedAt: NOW });
    expect(out.bucket).toBe("respondio");
    expect(computeBucket(nuevo)).toBe("sin-contactar");
  });

  test("no pisa los campos del patch", () => {
    const out = withBucket(nuevo, { optedOut: true, updatedAt: NOW });
    expect(out.optedOut).toBe(true);
    expect(out.updatedAt).toBe(NOW);
    expect(out.bucket).toBe("descartado");
  });
});
