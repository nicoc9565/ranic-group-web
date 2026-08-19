import { describe, expect, test } from "vitest";
import { isBlacklisted, MIN_INCLUSION_LENGTH } from "../blacklistMatch";
import type { BlacklistEntry } from "../types";

function list(...names: string[]): BlacklistEntry[] {
  return names.map((name, i) => ({ id: String(i), name }));
}

describe("isBlacklisted — entradas cortas exigen igualdad exacta", () => {
  // El caso que motivó el cambio: con "Ace" en la lista, el match por inclusión marcaba como
  // blacklisteada a cualquier empresa que tuviera esas tres letras en el nombre.
  test('"Grace Foods" NO es blacklisteada por una entrada "Ace"', () => {
    expect(isBlacklisted("Grace Foods", list("Ace"))).toBe(false);
  });
  test('"Ace" sí matchea consigo misma', () => {
    expect(isBlacklisted("Ace", list("Ace"))).toBe(true);
  });
  test("la igualdad exacta de una entrada corta ignora mayúsculas y espacios", () => {
    expect(isBlacklisted("  aCe ", list("Ace"))).toBe(true);
  });
  test("una entrada corta no matchea un nombre que la contiene", () => {
    expect(isBlacklisted("Acme Ace Supply", list("Ace"))).toBe(false);
  });
});

describe("isBlacklisted — los dos lados del borde", () => {
  const shortEntry = "abc"; // 3 caracteres: por debajo del mínimo
  const longEntry = "abcd"; // 4 caracteres: en el mínimo

  test(`el mínimo para matchear por inclusión es ${MIN_INCLUSION_LENGTH}`, () => {
    expect(MIN_INCLUSION_LENGTH).toBe(4);
  });
  test("3 caracteres: no matchea por inclusión", () => {
    expect(isBlacklisted("abc corp", list(shortEntry))).toBe(false);
  });
  test("4 caracteres: sí matchea por inclusión", () => {
    expect(isBlacklisted("abcd corp", list(longEntry))).toBe(true);
  });
  test("4 caracteres: también matchea en el sentido inverso", () => {
    expect(isBlacklisted("abcd", list("abcd corp"))).toBe(true);
  });
});

describe("isBlacklisted — comportamiento que no cambia", () => {
  test("nombre vacío nunca matchea", () => {
    expect(isBlacklisted("", list("Acme Corp"))).toBe(false);
    expect(isBlacklisted("   ", list("Acme Corp"))).toBe(false);
  });
  test("entrada vacía se ignora", () => {
    expect(isBlacklisted("Acme Corp", list("", "  "))).toBe(false);
  });
  test("lista vacía", () => {
    expect(isBlacklisted("Acme Corp", [])).toBe(false);
  });
  test("case-insensitive en las entradas largas", () => {
    expect(isBlacklisted("ACME CORP", list("acme corp"))).toBe(true);
  });
  test("inclusión larga sigue funcionando: el nombre contiene la entrada", () => {
    expect(isBlacklisted("Acme Corporation LLC", list("Acme Corp"))).toBe(true);
  });
  test("alcanza con que matchee una entrada de la lista", () => {
    expect(isBlacklisted("Acme Corp", list("Otra", "Acme Corp", "Tercera"))).toBe(true);
  });
});
