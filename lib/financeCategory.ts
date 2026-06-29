import type { ExpenseCategory, IncomeSource } from "./types";

/**
 * Infiere el origen de un Ingreso a partir de la descripción — mejor esfuerzo para el
 * import histórico (spec §5). Sin pista clara: Venta (default, la mayoría de los
 * ingresos futuros van a ser ventas).
 */
export function inferIncomeSource(description: string): IncomeSource {
  const text = description.toLowerCase();
  if (text.includes("rafa")) return "Aporte de Socio";
  if (text.includes("reintegro")) return "Reintegro";
  return "Venta";
}

const EXPENSE_RULES: { keywords: string[]; category: ExpenseCategory }[] = [
  { keywords: ["curso"], category: "Educación" },
  {
    keywords: ["frontier", "compra", "proveedor"],
    category: "Compra a Proveedor",
  },
  {
    keywords: [
      "keepa",
      "smartscout",
      "price checker",
      "revseller",
      "amazon seller",
      "google",
      "claude",
    ],
    category: "Suscripciones y Software",
  },
  {
    keywords: ["dominio", "llc", "esim", "impresora", "papel"],
    category: "Gastos Operativos",
  },
];

/**
 * Infiere la categoría de un Egreso a partir de la descripción — mejor esfuerzo para el
 * import histórico (spec §5). Sin coincidencia clara: Otros.
 */
export function inferExpenseCategory(description: string): ExpenseCategory {
  const text = description.toLowerCase();
  for (const rule of EXPENSE_RULES) {
    if (rule.keywords.some((kw) => text.includes(kw))) return rule.category;
  }
  return "Otros";
}
