import { describe, expect, test } from "vitest";
import { generateOutreachEmail } from "../outreachEmail";
import type { Provider } from "../types";

const p = { company: "Acme Distributors", contact: "" } as Provider;

/**
 * El texto EXACTO que reciben los proveedores de la campaña en frío, aprobado por Nico.
 *
 * Está fijado entero y no por fragmentos a propósito: es el único artefacto de todo el sistema
 * que ve un tercero, sale a ~900 direcciones sin que nadie lo lea antes, y una palabra cambiada
 * por accidente no rompe nada que un test parcial pueda notar. Si este test falla, la pregunta
 * no es cómo arreglarlo: es si el texto nuevo está aprobado.
 */
const TEXTO_APROBADO = `Dear Acme Distributors Team,

My name is Nicolas Conti, Managing Member of RANIC GROUP LLC, an online retailer based in Summit, NJ.

We are actively looking to add Acme Distributors products to our catalog and would like to open a wholesale account with you for recurring monthly orders.

Could you please send us your wholesale price list (with UPCs) and minimum order requirements, along with any dealer application you'd like us to complete?

We have our EIN and reseller certificate ready to provide, and are ready to move quickly on an initial order.

Email is the best way to reach me.

Best regards,
Nicolas Conti
Managing Member | RANIC GROUP LLC
nicolas.conti@ranicgroup.com
www.ranicgroup.com
3 Ridgedale Ave, Summit, NJ 07901

If you'd prefer not to receive future emails from us, just reply and let us know and we'll remove you from our list.`;

describe("generateOutreachEmail", () => {
  test("es exactamente el texto aprobado", () => {
    expect(generateOutreachEmail(p)).toBe(TEXTO_APROBADO);
  });

  // Los párrafos en orden. Si el texto exacto de arriba falla, esta lista dice CUÁL se movió.
  test("los párrafos van en el orden aprobado", () => {
    const parrafos = generateOutreachEmail(p).split("\n\n");
    expect(parrafos.map((s) => s.split("\n")[0].slice(0, 40))).toEqual([
      "Dear Acme Distributors Team,",
      "My name is Nicolas Conti, Managing Membe",
      "We are actively looking to add Acme Dist",
      "Could you please send us your wholesale ",
      "We have our EIN and reseller certificate",
      "Email is the best way to reach me.",
      "Best regards,",
      "If you'd prefer not to receive future em",
    ]);
  });
});

describe("las reglas que el texto tiene que seguir cumpliendo", () => {
  test("incluye la dirección postal física (CAN-SPAM)", () => {
    expect(generateOutreachEmail(p)).toContain("3 Ridgedale Ave, Summit, NJ 07901");
  });
  test("incluye instrucción de opt-out", () => {
    expect(generateOutreachEmail(p).toLowerCase()).toContain(
      "let us know and we'll remove you",
    );
  });
  test("mantiene la frase obligatoria 'recurring monthly orders'", () => {
    expect(generateOutreachEmail(p)).toContain("recurring monthly orders");
  });
  test("nunca menciona Amazon: se presenta como online retailer", () => {
    expect(generateOutreachEmail(p).toLowerCase()).not.toContain("amazon");
    expect(generateOutreachEmail(p)).toContain("an online retailer based in Summit, NJ");
  });
  test("mantiene el saludo con fallback de empresa", () => {
    expect(generateOutreachEmail(p).startsWith("Dear Acme Distributors Team,")).toBe(true);
  });

  // El mail no lleva teléfono en NINGUNA parte: ni en la firma, ni en el cuerpo, ni como
  // invitación a llamar. El canal es el email y solo el email.
  test("no contiene ningún número de teléfono", () => {
    const out = generateOutreachEmail(p);
    expect(out).not.toContain("+1 (908) 656-6042");
    expect(out).not.toMatch(/\d{3}[-.\s]\d{3}[-.\s]\d{4}/);
  });
  test("no invita a llamar", () => {
    expect(generateOutreachEmail(p)).not.toMatch(/\bcall\b|hop on|phone/i);
  });
  test("dirige la respuesta al email", () => {
    expect(generateOutreachEmail(p)).toContain("Email is the best way to reach me.");
  });

  // La firma queda en 4 líneas: nombre, cargo, email y sitio. Ningún otro dato de contacto.
  test("la firma es exactamente nombre, cargo, email y web", () => {
    expect(generateOutreachEmail(p)).toContain(
      [
        "Nicolas Conti",
        "Managing Member | RANIC GROUP LLC",
        "nicolas.conti@ranicgroup.com",
        "www.ranicgroup.com",
      ].join("\n"),
    );
  });
  test("la dirección va pegada al pie de la firma, no como bloque aparte", () => {
    expect(generateOutreachEmail(p)).toContain(
      "www.ranicgroup.com\n3 Ridgedale Ave, Summit, NJ 07901",
    );
  });
});

describe("el mecanismo de placeholders sigue intacto", () => {
  test("con persona de contacto, saluda por nombre en vez de 'Team'", () => {
    const conContacto = { company: "Acme Distributors", contact: "Sarah" } as Provider;
    expect(generateOutreachEmail(conContacto).startsWith("Dear Sarah,")).toBe(true);
  });
  test("no queda ningún placeholder sin reemplazar", () => {
    expect(generateOutreachEmail(p)).not.toMatch(/\[Contact\]|\[Company\]|\[signature\]/);
  });
});
