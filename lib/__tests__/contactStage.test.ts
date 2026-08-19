import { describe, expect, test } from "vitest";
import {
  computeBucket,
  CONTACT_STAGE_LABELS,
  contactStage,
  NO_REPLY_DAYS,
  type ContactBucket,
  type ContactStage,
} from "../contactStage";
import type { Provider } from "../types";

const TODAY = new Date("2026-08-18T12:00:00.000Z");

/** Proveedor contactado hoy por el envío automático: el caso base de la campaña. */
const base = {
  blacklisted: false,
  optedOut: false,
  status: "Contactado",
  firstContactDate: "2026-08-18",
  sendAttemptedAt: Date.parse("2026-08-18T13:00:00.000Z"),
  replyDetectedAt: null,
  bounceType: null,
} as Provider;

function stage(p: Partial<Provider>): ContactStage {
  return contactStage({ ...base, ...p } as Provider, TODAY);
}

describe("NO_REPLY_DAYS", () => {
  test("son 14 días: la secuencia se agota al día 12 más dos de margen", () => {
    expect(NO_REPLY_DAYS).toBe(14);
  });
});

describe("contactStage — una rama por etapa", () => {
  test("blacklisteado → descartado", () => {
    expect(stage({ blacklisted: true })).toBe("descartado");
  });
  test("optedOut → descartado", () => {
    expect(stage({ optedOut: true })).toBe("descartado");
  });
  test("Rechazado → descartado", () => {
    expect(stage({ status: "Rechazado" })).toBe("descartado");
  });
  test("No Acepta Nuevos → descartado", () => {
    expect(stage({ status: "No Acepta Nuevos" })).toBe("descartado");
  });
  test("Aprobado → cuenta", () => {
    expect(stage({ status: "Aprobado" })).toBe("cuenta");
  });
  test("En Negociación → cuenta", () => {
    expect(stage({ status: "En Negociación" })).toBe("cuenta");
  });
  test("rebote duro → rebotado", () => {
    expect(stage({ bounceType: "hard" })).toBe("rebotado");
  });
  test("respuesta detectada → respondio", () => {
    expect(stage({ replyDetectedAt: Date.parse("2026-08-18T14:00:00Z") })).toBe(
      "respondio",
    );
  });
  test("sin intento de envío ni primer contacto → sin-contactar", () => {
    expect(
      stage({
        status: "Por Contactar",
        sendAttemptedAt: null,
        firstContactDate: null,
      }),
    ).toBe("sin-contactar");
  });
  test("contactado hoy, sin respuesta todavía → contactado", () => {
    expect(stage({})).toBe("contactado");
  });
  test("pasados los 14 días sin respuesta → sin-respuesta", () => {
    expect(stage({ firstContactDate: "2026-08-03" })).toBe("sin-respuesta");
  });
});

describe("contactStage — el borde de NO_REPLY_DAYS", () => {
  test("exactamente 14 días todavía es contactado (la condición es estricta)", () => {
    expect(stage({ firstContactDate: "2026-08-04" })).toBe("contactado");
  });
  test("15 días ya es sin-respuesta", () => {
    expect(stage({ firstContactDate: "2026-08-03" })).toBe("sin-respuesta");
  });
});

describe("contactStage — precedencia estricta", () => {
  test("blacklisteado con respuesta detectada → descartado, no respondio", () => {
    expect(
      stage({
        blacklisted: true,
        replyDetectedAt: Date.parse("2026-08-18T14:00:00Z"),
      }),
    ).toBe("descartado");
  });
  test("rebote duro con firstContactDate viejo → rebotado, no sin-respuesta", () => {
    expect(stage({ bounceType: "hard", firstContactDate: "2026-07-01" })).toBe(
      "rebotado",
    );
  });
  test("Aprobado con replyDetectedAt → cuenta, no respondio", () => {
    expect(
      stage({
        status: "Aprobado",
        replyDetectedAt: Date.parse("2026-08-18T14:00:00Z"),
      }),
    ).toBe("cuenta");
  });
  test("Rechazado con cuenta abierta gana descartado sobre cuenta", () => {
    expect(stage({ status: "Rechazado", optedOut: false })).toBe("descartado");
  });
  test("rebote duro con respuesta detectada → rebotado", () => {
    expect(
      stage({
        bounceType: "hard",
        replyDetectedAt: Date.parse("2026-08-18T14:00:00Z"),
      }),
    ).toBe("rebotado");
  });
  test("rebote blando no gana: si respondió, respondio", () => {
    expect(
      stage({
        bounceType: "soft",
        replyDetectedAt: Date.parse("2026-08-18T14:00:00Z"),
      }),
    ).toBe("respondio");
  });
});

describe("contactStage — proveedores viejos sin los campos nuevos", () => {
  test("proveedor manual cargado a mano, sin ningún campo de outreach → contactado", () => {
    expect(
      contactStage(
        {
          blacklisted: false,
          status: "Contactado",
          firstContactDate: "2026-08-18",
        } as Provider,
        TODAY,
      ),
    ).toBe("contactado");
  });
  test("proveedor viejo sin contactar y sin campos de outreach → sin-contactar", () => {
    expect(
      contactStage(
        {
          blacklisted: false,
          status: "Por Contactar",
          firstContactDate: null,
        } as Provider,
        TODAY,
      ),
    ).toBe("sin-contactar");
  });
});

describe("CONTACT_STAGE_LABELS", () => {
  test("hay un label en español para cada etapa", () => {
    const stages: ContactStage[] = [
      "sin-contactar",
      "contactado",
      "sin-respuesta",
      "respondio",
      "cuenta",
      "rebotado",
      "descartado",
    ];
    for (const s of stages) {
      expect(CONTACT_STAGE_LABELS[s]).toBeTruthy();
    }
    expect(Object.keys(CONTACT_STAGE_LABELS)).toHaveLength(stages.length);
  });
});

describe("computeBucket — la invariante que sostiene la pantalla", () => {
  function bucket(p: Partial<Provider>): ContactBucket {
    return computeBucket({ ...base, ...p } as Provider);
  }

  // El caso que motivó cambiar la regla 5. send-batch escribe sendAttemptedAt cuando el envío
  // falla, pero NO firstContactDate (advanceFollowUp solo corre en el camino de éxito). Con la
  // regla vieja este proveedor caía en "contactado" sin fecha y la query que separa contactado de
  // sin-respuesta lo habría descartado por no tener el campo: desaparecía de la pantalla sin que
  // nada fallara.
  test("envío fallido: sendAttemptedAt y sendError pero sin firstContactDate → sin-contactar", () => {
    expect(
      bucket({
        status: "Por Contactar",
        sendAttemptedAt: Date.parse("2026-08-18T13:00:00Z"),
        sendError: "550 mailbox unavailable",
        firstContactDate: null,
      }),
    ).toBe("sin-contactar");
  });

  test("todo lo que está en contactado tiene firstContactDate", () => {
    const sinFecha = [
      { firstContactDate: null, sendAttemptedAt: 1 },
      { firstContactDate: null, sendAttemptedAt: null },
      { firstContactDate: "", sendAttemptedAt: 1 },
    ];
    for (const p of sinFecha) {
      expect(bucket(p as Partial<Provider>)).not.toBe("contactado");
    }
  });

  test("excludedReason → descartado: quedó fuera sin haberse intentado nunca", () => {
    expect(bucket({ excludedReason: "dominio sin registro MX" })).toBe("descartado");
  });

  test("excludedReason gana sobre respondio", () => {
    expect(
      bucket({
        excludedReason: "dominio sin registro MX",
        replyDetectedAt: Date.parse("2026-08-18T14:00:00Z"),
      }),
    ).toBe("descartado");
  });

  test("nunca devuelve sin-respuesta: ese corte es temporal y no se persiste", () => {
    expect(bucket({ firstContactDate: "2026-01-01" })).toBe("contactado");
  });
});

describe("contactStage se construye encima de computeBucket", () => {
  const casos: Partial<Provider>[] = [
    { blacklisted: true },
    { optedOut: true },
    { status: "Rechazado" },
    { status: "Aprobado" },
    { bounceType: "hard" },
    { replyDetectedAt: 1 },
    { firstContactDate: null, sendAttemptedAt: null },
    { excludedReason: "x" },
  ];
  test("para todo lo que no es contactado, las dos funciones coinciden", () => {
    for (const c of casos) {
      const p = { ...base, ...c } as Provider;
      const b = computeBucket(p);
      expect(b).not.toBe("contactado");
      expect(contactStage(p, TODAY)).toBe(b);
    }
  });
  test("solo contactado se puede convertir en sin-respuesta", () => {
    const p = { ...base, firstContactDate: "2026-01-01" } as Provider;
    expect(computeBucket(p)).toBe("contactado");
    expect(contactStage(p, TODAY)).toBe("sin-respuesta");
  });
});
