import type { Category } from "./types";

const RULES: { keywords: string[]; category: Category }[] = [
  {
    keywords: ["beauty", "perfume", "cosmetic", "fragance", "fragrance", "makeup"],
    category: "Fragancias & Beauty",
  },
  {
    keywords: ["mascota", "pet", "pescado"],
    category: "Pet Products",
  },
  {
    keywords: ["toy", "juguete", "entertainment", "games"],
    category: "Entertainment & Toys",
  },
  {
    keywords: ["hogar", "home improvement", "tools", "cocina"],
    category: "Home Products",
  },
  {
    keywords: ["personal care", "health"],
    category: "Health & Personal Care",
  },
];

/**
 * Infiere la categoría de un proveedor a partir del texto libre de notas — mejor
 * esfuerzo para el import histórico (spec §5). Sin coincidencia clara: General
 * Merchandise. Revisar y corregir manualmente las que queden mal categorizadas.
 */
export function inferCategory(notes: string): Category {
  const text = notes.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => text.includes(kw))) return rule.category;
  }
  return "General Merchandise";
}
