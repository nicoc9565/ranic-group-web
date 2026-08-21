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
  // first_short es la excepción: Nico decidió ofrecer EIN y reseller certificate de entrada en el
  // primer contacto en frío, para acortar el ida y vuelta de apertura de cuenta. El resto de los
  // templates sigue bajo la regla original — no se ofrecen salvo que el proveedor los pida.
  test("ningún email menciona EIN / Resale Certificate / Tax ID (salvo first_short)", () => {
    for (const t of ALL_TYPES.filter((t) => t !== "first_short")) {
      const body = generateEmail(t, p).toLowerCase();
      expect(body).not.toContain("ein");
      expect(body).not.toContain("resale certificate");
      expect(body).not.toContain("tax id");
    }
  });
  test("todos terminan con la firma (web)", () => {
    for (const t of ALL_TYPES) {
      expect(generateEmail(t, p)).toContain("www.ranicgroup.com");
    }
  });
  // Ningún template lleva teléfono: el único canal que ofrecemos es el email.
  test("ningún email incluye un número de teléfono", () => {
    for (const t of ALL_TYPES) {
      expect(generateEmail(t, p)).not.toMatch(/\d{3}[-.\s]\d{3}[-.\s]\d{4}/);
    }
  });
  test("reemplaza [Company] por el nombre de la empresa", () => {
    expect(generateEmail("first_short", p)).toContain("FragranceX");
  });
  test("sin contact, saluda 'Dear [Company] Team,'", () => {
    const noContact = { company: "Acme Distributors", contact: "" } as Provider;
    expect(generateEmail("first_short", noContact).startsWith("Dear Acme Distributors Team,")).toBe(
      true,
    );
  });
  test("con contact, sigue saludando por nombre", () => {
    expect(generateEmail("first_short", p).startsWith("Dear Ces,")).toBe(true);
  });
  test("el saludo recorta el sufijo legal de la razón social", () => {
    const c = { company: "1791 Outdoor Lifestyle Group", contact: "" } as Provider;
    expect(generateEmail("first_short", c).startsWith("Dear 1791 Outdoor Lifestyle Team,")).toBe(
      true,
    );
  });
  test("el cuerpo mantiene la razón social completa", () => {
    const c = { company: "1791 Outdoor Lifestyle Group", contact: "" } as Provider;
    expect(generateEmail("first_short", c)).toContain("1791 Outdoor Lifestyle Group products");
  });
  test("una razón social sin sufijo no pierde nada", () => {
    const c = { company: "Acme Distributors", contact: "" } as Provider;
    expect(generateEmail("first_short", c).startsWith("Dear Acme Distributors Team,")).toBe(true);
  });
  test("si el recorte deja el nombre vacío, usa la razón social completa", () => {
    const c = { company: "Group Enterprises Inc.", contact: "" } as Provider;
    expect(generateEmail("first_short", c).startsWith("Dear Group Enterprises Inc. Team,")).toBe(
      true,
    );
  });
  test("el recorte limpia la puntuación que queda colgando", () => {
    const c = { company: "Chen Household Hardware Supply Co., Ltd.", contact: "" } as Provider;
    expect(
      generateEmail("first_short", c).startsWith("Dear Chen Household Hardware Supply Team,"),
    ).toBe(true);
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
