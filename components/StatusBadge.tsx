import type { Status } from "@/lib/types";

// Punto de color por estado del proveedor (semáforo logístico, tonos apagados).
const DOT: Record<Status, string> = {
  "Por Contactar": "bg-ink-soft",
  Contactado: "bg-ink-soft",
  "En Espera de Respuesta": "bg-status-today",
  "En Negociación": "bg-status-today",
  Aprobado: "bg-status-ontrack",
  Rechazado: "bg-status-overdue",
  "No Acepta Nuevos": "bg-status-overdue",
  Referido: "bg-ink-soft",
};

/** Pill de estado del proveedor con punto de color del semáforo. */
export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-olive-tint px-2 py-0.5 text-xs text-olive-deep">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} aria-hidden />
      {status}
    </span>
  );
}
