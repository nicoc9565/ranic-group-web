import { CONTACT_STAGE_LABELS, type ContactStage } from "@/lib/contactStage";

/**
 * Colores por etapa. El criterio: verde = avanza, rojo = se terminó, ámbar = pide atención,
 * gris = todavía no pasó nada.
 */
const STYLES: Record<ContactStage, string> = {
  "sin-contactar": "bg-ink-soft/10 text-ink-soft",
  contactado: "bg-status-ontrack/10 text-status-ontrack",
  "sin-respuesta": "bg-status-today/10 text-status-today",
  respondio: "bg-olive/15 text-olive-deep",
  cuenta: "bg-olive/25 text-olive-deep",
  rebotado: "bg-status-overdue/10 text-status-overdue",
  descartado: "bg-ink-soft/10 text-ink-soft line-through",
};

export function ContactStageBadge({ stage }: { stage: ContactStage }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[stage]}`}
    >
      {CONTACT_STAGE_LABELS[stage]}
    </span>
  );
}
