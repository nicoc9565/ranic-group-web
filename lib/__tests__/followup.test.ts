import { describe, expect, test } from "vitest";
import {
  advanceFollowUp,
  FOLLOWUP_DAYS,
  followUpStatus,
  nextFollowUpDate,
} from "../followup";
import type { Provider } from "../types";

const base = {
  firstContactDate: "2026-06-01",
  followUpStep: 0,
  contactMethod: "Email",
} as Provider;

describe("FOLLOWUP_DAYS", () => {
  test("es la secuencia [1, 4, 7, 12]", () => {
    expect(FOLLOWUP_DAYS).toEqual([1, 4, 7, 12]);
  });
});

describe("nextFollowUpDate", () => {
  test("step 0 → firstContact + 4 días", () => {
    expect(nextFollowUpDate(base)?.toISOString().slice(0, 10)).toBe("2026-06-05");
  });
  test("sin firstContactDate → null", () => {
    expect(
      nextFollowUpDate({ firstContactDate: null, followUpStep: -1 } as Provider),
    ).toBeNull();
  });
  test("secuencia agotada (step 3) → null", () => {
    expect(nextFollowUpDate({ ...base, followUpStep: 3 })).toBeNull();
  });
  test("step -1 (recién contactado en seq) → firstContact + 1 día", () => {
    expect(
      nextFollowUpDate({ ...base, followUpStep: -1 })?.toISOString().slice(0, 10),
    ).toBe("2026-06-02");
  });
  test("contactMethod distinto de Email → null aunque haya firstContactDate", () => {
    expect(
      nextFollowUpDate({ ...base, contactMethod: "Web" } as Provider),
    ).toBeNull();
  });
  test("contactMethod Email → calcula normalmente", () => {
    expect(
      nextFollowUpDate({ ...base, contactMethod: "Email" } as Provider)
        ?.toISOString()
        .slice(0, 10),
    ).toBe("2026-06-05");
  });
  test("followUpStopped → null aunque haya secuencia activa", () => {
    expect(
      nextFollowUpDate({ ...base, followUpStopped: true } as Provider),
    ).toBeNull();
  });
  test("followUpForced permite tracking aunque contactMethod no sea Email", () => {
    expect(
      nextFollowUpDate({
        ...base,
        contactMethod: "Llamada",
        followUpForced: true,
      } as Provider)
        ?.toISOString()
        .slice(0, 10),
    ).toBe("2026-06-05");
  });
  test("sin followUpForced, contactMethod distinto de Email sigue devolviendo null", () => {
    expect(
      nextFollowUpDate({ ...base, contactMethod: "Web" } as Provider),
    ).toBeNull();
  });
});

describe("followUpStatus", () => {
  test("vencido → overdue", () => {
    expect(followUpStatus(base, new Date("2026-06-10"))).toBe("overdue");
  });
  test("vence hoy → today", () => {
    expect(followUpStatus(base, new Date("2026-06-05"))).toBe("today");
  });
  test("en fecha → ontrack", () => {
    expect(followUpStatus(base, new Date("2026-06-03"))).toBe("ontrack");
  });
  test("sin próximo follow-up → none", () => {
    expect(
      followUpStatus(
        { firstContactDate: null, followUpStep: -1 } as Provider,
        new Date("2026-06-10"),
      ),
    ).toBe("none");
  });
});

describe("advanceFollowUp", () => {
  test("primer contacto fija firstContactDate y step 0", () => {
    const out = advanceFollowUp(
      { firstContactDate: null, followUpStep: -1 } as Provider,
      "2026-06-25",
    );
    expect(out.firstContactDate).toBe("2026-06-25");
    expect(out.followUpStep).toBe(0);
    expect(out.lastEmailDate).toBe("2026-06-25");
  });
  test("contacto subsiguiente avanza el step sin tocar firstContactDate", () => {
    const out = advanceFollowUp(base, "2026-06-05");
    expect(out.followUpStep).toBe(1);
    expect(out.lastEmailDate).toBe("2026-06-05");
    // El patch no incluye firstContactDate cuando ya existe (no se sobreescribe el pasado).
    expect(out.firstContactDate).toBeUndefined();
  });
});
