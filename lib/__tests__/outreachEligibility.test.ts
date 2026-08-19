import { describe, expect, test } from "vitest";
import {
  ALL_REASONS,
  ineligibleReasons,
  isNonNanpPhone,
} from "../outreachEligibility";

const US = { email: "sales@acme.com", phone: "908-656-6042", website: "acme.com" };

describe("ineligibleReasons — el caso que sí queremos contactar", () => {
  test("proveedor US con email, teléfono NANP y web .com → elegible", () => {
    expect(ineligibleReasons(US)).toEqual([]);
  });
  test("sin teléfono no penaliza: el criterio castiga el dato que contradice, no el que falta", () => {
    expect(ineligibleReasons({ ...US, phone: "" })).toEqual([]);
  });
  test("sin website tampoco penaliza", () => {
    expect(ineligibleReasons({ ...US, website: "" })).toEqual([]);
  });
});

describe("ineligibleReasons — un criterio por rama", () => {
  test("email inválido → sin email", () => {
    expect(ineligibleReasons({ ...US, email: "" })).toContain("sin email");
    expect(ineligibleReasons({ ...US, email: "no-es-un-mail" })).toContain("sin email");
  });
  test("prefijo internacional distinto de +1 → teléfono internacional", () => {
    expect(ineligibleReasons({ ...US, phone: "+86 579 8888 8888" })).toContain(
      "teléfono internacional",
    );
  });
  test("notación 00 + código de país también cuenta", () => {
    expect(ineligibleReasons({ ...US, phone: "0086 579 88888888" })).toContain(
      "teléfono internacional",
    );
  });
  test("+1 NO es internacional", () => {
    expect(ineligibleReasons({ ...US, phone: "+1 908 656 6042" })).toEqual([]);
  });
  // Falso positivo conocido y aceptado: 001 es la notación internacional de +1, así que el
  // criterio "teléfono internacional" no lo marca — pero isNonNanpPhone tampoco reconoce el
  // 001 como prefijo y lo da por no-NANP. Se documenta en vez de arreglarse porque en los 2502
  // proveedores reales afecta a 2, y en uno de los dos (001-86-13957167237) la exclusión es
  // correcta: el 001 va seguido del código de China. Un 00 que se descarta a ciegas rompería ese
  // caso, que es el más común de los dos.
  test("001 + número US: no es internacional, pero cae por no-NANP", () => {
    const reasons = ineligibleReasons({ ...US, phone: "001 908 656 6042" });
    expect(reasons).not.toContain("teléfono internacional");
    expect(reasons).toEqual(["teléfono no-NANP"]);
  });
  test("TLD no-US en el website", () => {
    expect(ineligibleReasons({ ...US, website: "www.acme.com.cn" })).toContain("TLD no-US");
  });
  test("TLD no-US en el dominio del email", () => {
    expect(ineligibleReasons({ ...US, email: "sales@acme.cn" })).toContain("TLD no-US");
  });
  test("webmail asiático", () => {
    expect(ineligibleReasons({ ...US, email: "sales@163.com" })).toContain("webmail no-US");
  });
  test("teléfono que no es NANP", () => {
    expect(ineligibleReasons({ ...US, phone: "13901574565" })).toContain("teléfono no-NANP");
  });
});

describe("isNonNanpPhone — los casos reales de la lista", () => {
  test("número US normal → es NANP", () => {
    expect(isNonNanpPhone("908-656-6042")).toBe(false);
  });
  test("con 1 adelante → sigue siendo NANP", () => {
    expect(isNonNanpPhone("1-908-656-6042")).toBe(false);
  });
  test("vanity number: 888-908-BUGS se lee por teclado", () => {
    expect(isNonNanpPhone("888-908-BUGS")).toBe(false);
  });
  test("extensión no invalida: 877-311-2287 X101", () => {
    expect(isNonNanpPhone("877-311-2287 X101")).toBe(false);
  });
  test("dos números en el mismo campo: alcanza con que uno sea NANP", () => {
    expect(isNonNanpPhone("877 864-2201 or 310 952-9000")).toBe(false);
  });
  test("prefijo de texto no rompe el número", () => {
    expect(isNonNanpPhone("Tel: 908-656-6042")).toBe(false);
  });
  test("celular chino → no NANP", () => {
    expect(isNonNanpPhone("13901574565")).toBe(true);
  });
  test("código de país sin + → no NANP", () => {
    expect(isNonNanpPhone("86-579-85288888")).toBe(true);
  });
  test("campo sin dígitos no penaliza", () => {
    expect(isNonNanpPhone("")).toBe(false);
    expect(isNonNanpPhone("contactar por web")).toBe(false);
  });
  test("area code que arranca en 1 no es NANP válido", () => {
    expect(isNonNanpPhone("108-656-6042")).toBe(true);
  });
});

describe("ineligibleReasons — se devuelven todos los motivos que aplican", () => {
  test("un proveedor chino acumula varios", () => {
    const reasons = ineligibleReasons({
      email: "sales@acme.cn",
      phone: "+86 579 8888 8888",
      website: "acme.com.cn",
    });
    expect(reasons).toContain("teléfono internacional");
    expect(reasons).toContain("TLD no-US");
    expect(reasons.length).toBeGreaterThan(1);
  });
  test("todo motivo devuelto está en ALL_REASONS (el CSV tiene una columna por criterio)", () => {
    const reasons = ineligibleReasons({ email: "", phone: "+86 1", website: "x.cn" });
    for (const r of reasons) expect(ALL_REASONS).toContain(r);
  });
});
