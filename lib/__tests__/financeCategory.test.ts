import { describe, expect, test } from "vitest";
import { inferExpenseCategory, inferIncomeSource } from "../financeCategory";

describe("inferIncomeSource", () => {
  test("menciona Rafa → Aporte de Socio", () => {
    expect(inferIncomeSource("Zelle Rafa")).toBe("Aporte de Socio");
  });
  test("menciona Reintegro → Reintegro", () => {
    expect(inferIncomeSource("Reintegro Frontier Botella Rota")).toBe("Reintegro");
  });
  test("sin pista clara → Venta", () => {
    expect(inferIncomeSource("Ventas Amazon")).toBe("Venta");
  });
});

describe("inferExpenseCategory", () => {
  test("menciona curso → Educación", () => {
    expect(inferExpenseCategory("Pago del curso Mundo Amazon Cuota 1")).toBe(
      "Educación",
    );
  });
  test("menciona Frontier → Compra a Proveedor", () => {
    expect(inferExpenseCategory("Primera Compra Frontier Co-op")).toBe(
      "Compra a Proveedor",
    );
  });
  test("menciona Keepa → Suscripciones y Software", () => {
    expect(inferExpenseCategory("Pago de Keepa")).toBe("Suscripciones y Software");
  });
  test("menciona Dominio → Gastos Operativos", () => {
    expect(inferExpenseCategory("Pago de Dominio ranicgroup.com")).toBe(
      "Gastos Operativos",
    );
  });
  test("sin pista clara → Otros", () => {
    expect(inferExpenseCategory("Pago varios")).toBe("Otros");
  });
});
