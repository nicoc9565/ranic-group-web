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
  // La firma exacta de CLAUDE.md son estas 6 líneas y no cambia: la dirección postal es una
  // línea agregada después, no un reemplazo del bloque.
  test("la firma obligatoria de 6 líneas queda intacta", () => {
    expect(generateOutreachEmail(p)).toContain(
      [
        "Nicolas Conti",
        "Managing Member | RANIC GROUP LLC",
        "nicolas.conti@ranicgroup.com",
        "www.ranicgroup.com",
        "+1 (908) 656-6042",
      ].join("\n"),
    );
  });
  test("la dirección va pegada al pie de la firma, no como bloque aparte", () => {
    expect(generateOutreachEmail(p)).toContain(
      "+1 (908) 656-6042\n3 Ridgedale Ave, Summit, NJ 07901",
    );
  });
  test("termina en la línea de opt-out", () => {
    expect(generateOutreachEmail(p).trimEnd().endsWith("remove you from our list.")).toBe(true);
  });
});
