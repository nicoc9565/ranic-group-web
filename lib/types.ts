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
  | "Contactado"
  | "Esperando respuesta"
  | "En negociación"
  | "Aprobado"
  | "Descartado";

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
  category: Category;
  status: Status;
  website: string;
  blacklisted: boolean;
  /** Fecha del primer email; base de la secuencia de follow-up. null si no se contactó aún. */
  firstContactDate: string | null;
  /** Fecha del último email enviado. */
  lastEmailDate: string | null;
  /** Índice del último email de la secuencia enviado. -1 = ningún email enviado. */
  followUpStep: number;
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
