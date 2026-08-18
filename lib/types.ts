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
  /** true = fuerza el tracking de follow-up aunque contactMethod no sea "Email". */
  followUpForced?: boolean;
  // ── Outreach automático ──
  // Opcionales porque los proveedores cargados antes de esta feature no los tienen
  // (mismo criterio que followUpStopped/followUpForced). El import de outreach los
  // escribe siempre, que es lo que necesita la query del envío en tandas.
  /** Thread de Gmail del primer contacto automático. null si no se envió por acá. */
  gmailThreadId?: string | null;
  /** Timestamp del último intento de envío automático (éxito o error). */
  sendAttemptedAt?: number | null;
  /** Motivo de un envío automático fallido (bounce, dirección inválida, etc.). null si no falló. */
  sendError?: string | null;
  /** Origen del proveedor, para auditoría. Ausente = cargado a mano antes de esta feature. */
  source?:
    | "expo-outreach-import"
    | "expo-west-import"
    | "csv-import"
    | "manual";
  /** true = el proveedor pidió no recibir más emails. Se excluye de cualquier envío automático. */
  optedOut?: boolean;
  /**
   * true = candidato al envío automático de primer contacto. Lo calcula el importador con la
   * heurística de elegibilidad (ver scripts/import-outreach-list.ts): la lista de la feria trae
   * muchos fabricantes OEM del exterior, a los que el template de first_short no les aplica.
   */
  outreachEligible?: boolean;
  /**
   * Timestamp del último chequeo de reply-detection; ordena la rotación del cron de respuestas.
   * Lo escribe el envío automático en 0 al mandar el primer contacto: Firestore excluye de un
   * orderBy los docs que no tienen el campo, así que sin ese 0 el proveedor nunca se chequearía.
   */
  replyCheckedAt?: number;
  /**
   * Timestamp de la respuesta detectada por el cron. null = todavía no respondió.
   * Reemplaza el match por string contra las notas, que era frágil: cualquier retoque al texto
   * de la nota rompía silenciosamente el conteo de respuestas del panel.
   */
  replyDetectedAt?: number | null;
  /**
   * Clasificación del rebote (ver lib/bounceClassification.ts). Un "hard" no se degrada nunca
   * a "soft": la dirección no existe, y que un reintento posterior dé un error transitorio no
   * la resucita.
   */
  bounceType?: "hard" | "soft" | null;
  /** company.toLowerCase(), para búsqueda y orden sin traerse el documento entero a memoria. */
  companyLower?: string;
  notes: NoteEntry[];
  createdAt: number;
  updatedAt: number;
};

/** Configuración del envío automático de outreach, un solo doc en Firestore (id fijo "config"). */
export type OutreachConfig = {
  /** Máximo de emails automáticos por día. Ajustable desde /admin/outreach sin redeploy. */
  dailyLimit: number;
  /** true = el cron manda emails; false = pausado. */
  enabled: boolean;
  /** Cuántos emails ya se mandaron automáticamente hoy (se resetea a las 00:00 America/New_York). */
  sentToday: number;
  /** yyyy-mm-dd (America/New_York) del último reset de sentToday. */
  lastResetDate: string;
  /**
   * Envíos automáticos acumulados desde siempre. NO es una ventana móvil: la tasa de rebote que
   * evalúa el cortacircuito es HISTÓRICA sobre toda la campaña. Para 917 envíos alcanza; si algún
   * día el outreach fuera continuo y de años, habría que pasar a una ventana.
   */
  sentTotal?: number;
  /** Rebotes DUROS acumulados. Los blandos no suman: un buzón lleno no dice nada de la lista. */
  bouncedTotal?: number;
  /** Motivo de la última pausa automática. null = nunca pasó, o alguien lo limpió a mano. */
  pausedReason?: string | null;
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
  | "Comisión Amazon"
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
  /** Origen del import automático. Ausente en movimientos cargados a mano. */
  importSource?: "amazon-settlement";
  /** Corte al que pertenece el movimiento importado (settlement-id). */
  importPeriod?: string;
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
  "Comisión Amazon",
  "Otros",
];

// ── Stock (inventario FBA de Amazon) ──────────────────────────────────────

export type StockItem = {
  id: string;
  snapshotDate: string; // yyyy-mm-dd
  sku: string;
  asin: string;
  productName: string;
  available: number;
  unitsShipped30: number;
  unitsShipped90: number;
  daysOfSupply: number | null;
  price: number;
  healthStatus: string; // "Healthy" | "Low stock" | "Excess" | ""
  alert: string; // "Low traffic" | "Low conversion" | ""
  /** Origen del import automático. Ausente en filas cargadas a mano. */
  importSource?: "amazon-inventory";
  /** Corte al que pertenece el item importado (snapshotDate). */
  importPeriod?: string;
  createdAt: number;
};

// ── Rentabilidad por producto (ventas de Amazon por SKU y liquidación) ─────

export type AmazonSkuSale = {
  id: string;
  settlementId: string; // = importPeriod
  periodStart: string; // yyyy-mm-dd
  periodEnd: string; // yyyy-mm-dd
  depositDate: string; // yyyy-mm-dd
  sku: string;
  productName: string; // se resuelve desde stockItems al escribir; "" si no hay match
  unitsSold: number; // Order − Refund
  ventas: number; // money in del SKU
  gastosAmazon: number; // money out del SKU (positivo)
  neto: number; // ventas − gastosAmazon
  importSource: "amazon-settlement";
  createdAt: number;
};
