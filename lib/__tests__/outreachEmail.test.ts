import { describe, expect, test } from "vitest";
import { generateOutreachEmail } from "../outreachEmail";
import type { Provider } from "../types";

const p = { company: "Acme Distributors", contact: "" } as Provider;

describe("generateOutreachEmail", () => {
  test("incluye la dirección postal física", () => {
    expect(generateOutreachEmail(p)).toContain("3 Ridgedale Ave, Summit, NJ 07901");
  });
  test("incluye instrucción de opt-out", () => {
    expect(generateOutreachEmail(p).toLowerCase()).toContain(
      "let us know and we'll remove you",
    );
  });
  test("sigue teniendo el cuerpo del first_short original", () => {
    expect(generateOutreachEmail(p)).toContain("recurring monthly orders");
  });
  test("mantiene el saludo con fallback de empresa", () => {
    expect(generateOutreachEmail(p).startsWith("Dear Acme Distributors Team,")).toBe(true);
  });
  test("mantiene la firma con el teléfono correcto", () => {
    expect(generateOutreachEmail(p)).toContain("+1 (908) 656-6042");
  });
});
