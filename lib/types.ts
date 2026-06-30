// Tipos y enums del dominio del CRM de RANIC GROUP.
// Labels de UI en español; el contenido de los emails (otro módulo) va en inglés.

export type Category =
  | "Fragancias & Beauty"
  | "Health & Personal Care"
  | "Pet Products"
  | "Home Products"
  | "Entertainment & Toys"
  | "General Merchandise";

export type Status =
  | "Por Contactar"
  | "Contactado"
  | "En Espera de Respuesta"
  | "En Negociación"
  | "Aprobado"
  | "Rechazado"
  | "No Acepta Nuevos"
  | "Referido";

export type ContactMethod = "Email" | "Llamada" | "Web";

/** Entrada del log de notas: solo-append, en orden cronológico (no se edita el pasado). */
export type NoteEntry = {
  date: string; // ISO yyyy-mm-dd
  text: string;
};

export type Provider = {
  id: string;
  company: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  category: Category;
  status: Status;
  website: string;
  contactMethod: ContactMethod;
  score: number;
  blacklisted: boolean;
  /** Fecha del primer email; base de la secuencia de follow-up. null si no se contactó aún. */
  firstContactDate: string | null;
  /** Fecha del último email enviado. */
  lastEmailDate: string | null;
  /** Índice del último email de la secuencia enviado. -1 = ningún email enviado. */
  followUpStep: number;
  /** true = se detuvo manualmente el seguimiento; no aparece en Follow-ups aunque haya secuencia activa. */
  followUpStopped?: boolean;
  notes: NoteEntry[];
  createdAt: number;
  updatedAt: number;
};

export type BlacklistEntry = {
  id: string;
  name: string;
};

export type ExpoProspect = {
  id: string;
  company: string;
  brands: string;
  category: string;
  city: string;
  state: string;
  website: string;
  email: string;
  mailSent: boolean;
  dateSent: string | null;
  response: string;
  notes: string;
};

export type EmailType =
  | "first_short"
  | "first_long"
  | "followup_4"
  | "followup_7"
  | "last_attempt_12"
  | "catalog_upcs"
  | "reply_approval"
  | "clarification";

// Listas para selects/filtros de la UI (orden de presentación).
export const CATEGORIES: Category[] = [
  "Fragancias & Beauty",
  "Health & Personal Care",
  "Pet Products",
  "Home Products",
  "Entertainment & Toys",
  "General Merchandise",
];

export const STATUSES: Status[] = [
  "Por Contactar",
  "Contactado",
  "En Espera de Respuesta",
  "En Negociación",
  "Aprobado",
  "Rechazado",
  "No Acepta Nuevos",
  "Referido",
];

export const CONTACT_METHODS: ContactMethod[] = ["Email", "Llamada", "Web"];

// Labels en español para los tipos de email (contenido en inglés).
export const EMAIL_TYPE_LABELS: Record<EmailType, string> = {
  first_short: "Primer contacto (corto)",
  first_long: "Primer contacto (largo)",
  followup_4: "Follow-up día 4",
  followup_7: "Follow-up día 7 (urgencia)",
  last_attempt_12: "Último intento día 12",
  catalog_upcs: "Pedir catálogo con UPCs",
  reply_approval: "Responder a aprobación",
  clarification: "Pedido de aclaración",
};

// ── Finanzas (flujo de caja) ──────────────────────────────────────────────

export type TransactionType = "Ingreso" | "Egreso";

export type IncomeSource = "Venta" | "Aporte de Socio" | "Reintegro";

export type ExpenseCategory =
  | "Compra a Proveedor"
  | "Suscripciones y Software"
  | "Gastos Operativos"
  | "Educación"
  | "Otros";

export type Transaction = {
  id: string;
  date: string; // ISO yyyy-mm-dd
  type: TransactionType;
  description: string;
  amount: number; // siempre positivo; el signo lo da `type`
  payer: string; // "Quién" — texto libre
  method: string; // "Método" — texto libre
  incomeSource: IncomeSource | null; // solo si type === "Ingreso"
  expenseCategory: ExpenseCategory | null; // solo si type === "Egreso"
  createdAt: number;
  updatedAt: number;
};

export const INCOME_SOURCES: IncomeSource[] = [
  "Venta",
  "Aporte de Socio",
  "Reintegro",
];

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Compra a Proveedor",
  "Suscripciones y Software",
  "Gastos Operativos",
  "Educación",
  "Otros",
];
