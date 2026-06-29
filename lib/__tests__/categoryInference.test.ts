import { describe, expect, test } from "vitest";
import { inferCategory } from "../categoryInference";

describe("inferCategory", () => {
  test("menciona beauty/personal care → Fragancias & Beauty", () => {
    expect(inferCategory("Beauty and Personal Care")).toBe("Fragancias & Beauty");
  });
  test("menciona perfume → Fragancias & Beauty", () => {
    expect(inferCategory("Tienda de perfume, catalogo amplio")).toBe(
      "Fragancias & Beauty",
    );
  });
  test("menciona mascotas → Pet Products", () => {
    expect(
      inferCategory("Productos de mascotas en general, tiene orden minimas de $6.000"),
    ).toBe("Pet Products");
  });
  test("menciona pescados → Pet Products", () => {
    expect(inferCategory("Productos para pescados")).toBe("Pet Products");
  });
  test("menciona toys → Entertainment & Toys", () => {
    expect(inferCategory("Toys & Games")).toBe("Entertainment & Toys");
  });
  test("menciona hogar → Home Products", () => {
    expect(inferCategory("Articulos Generales, cocina, hogar, etc")).toBe(
      "Home Products",
    );
  });
  test("sin pista clara → General Merchandise", () => {
    expect(inferCategory("Mercaderia en General")).toBe("General Merchandise");
  });
  test("notas vacías → General Merchandise", () => {
    expect(inferCategory("")).toBe("General Merchandise");
  });
});
