import { describe, expect, test } from "vitest";
import { generateEmail } from "../emails";
import type { EmailType, Provider } from "../types";

const p = { company: "FragranceX", contact: "Ces" } as Provider;

const ALL_TYPES: EmailType[] = [
  "first_short",
  "first_long",
  "followup_4",
  "followup_7",
  "last_attempt_12",
  "catalog_upcs",
  "reply_approval",
  "clarification",
];

describe("generateEmail", () => {
  test("first_short empieza con 'Dear Ces,'", () => {
    expect(generateEmail("first_short", p).startsWith("Dear Ces,")).toBe(true);
  });
  test("first_long empieza con 'Dear Ces,'", () => {
    expect(generateEmail("first_long", p).startsWith("Dear Ces,")).toBe(true);
  });
  test("first_short incluye 'recurring monthly orders'", () => {
    expect(generateEmail("first_short", p)).toContain("recurring monthly orders");
  });
  test("first_long incluye 'recurring monthly orders'", () => {
    expect(generateEmail("first_long", p)).toContain("recurring monthly orders");
  });
  test("first_short se presenta como online retailer en Summit, NJ", () => {
    expect(generateEmail("first_short", p)).toContain(
      "online retailer based in Summit, NJ",
    );
  });
  test("ningún email menciona Amazon", () => {
    for (const t of ALL_TYPES) {
      expect(generateEmail(t, p).toLowerCase()).not.toContain("amazon");
    }
  });
  test("ningún email menciona EIN / Resale Certificate / Tax ID", () => {
    for (const t of ALL_TYPES) {
      const body = generateEmail(t, p).toLowerCase();
      expect(body).not.toContain("ein");
      expect(body).not.toContain("resale certificate");
      expect(body).not.toContain("tax id");
    }
  });
  test("todos terminan con la firma (teléfono)", () => {
    for (const t of ALL_TYPES) {
      expect(generateEmail(t, p)).toContain("+1 (201) 572-1383");
    }
  });
  test("reemplaza [Company] por el nombre de la empresa", () => {
    expect(generateEmail("first_short", p)).toContain("FragranceX");
  });
  test("no deja placeholders sin reemplazar", () => {
    for (const t of ALL_TYPES) {
      const body = generateEmail(t, p);
      expect(body).not.toContain("[Contact]");
      expect(body).not.toContain("[Company]");
      expect(body).not.toContain("[signature]");
    }
  });
});
