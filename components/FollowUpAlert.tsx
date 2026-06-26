import Link from "next/link";
import { FOLLOWUP_DAYS, followUpStatus, nextFollowUpDate } from "@/lib/followup";
import { formatDate } from "@/lib/format";
import type { Provider } from "@/lib/types";
import { FollowUpTrack } from "./FollowUpTrack";

const STATUS_TEXT = {
  overdue: "text-status-overdue",
  today: "text-status-today",
  ontrack: "text-status-ontrack",
} as const;

const STATUS_LABEL = {
  overdue: "Vencido",
  today: "Vence hoy",
  ontrack: "En fecha",
} as const;

/** Fila de alerta de follow-up: proveedor + track + próximo paso, linkea al detalle. */
export function FollowUpAlert({
  provider,
  today,
}: {
  provider: Provider;
  today: Date;
}) {
  const status = followUpStatus(provider, today);
  if (status === "none") return null;

  const next = nextFollowUpDate(provider);
  const nextDay = FOLLOWUP_DAYS[provider.followUpStep + 1];
  const nextISO = next ? next.toISOString().slice(0, 10) : null;

  return (
    <Link
      href={`/admin/proveedores?id=${provider.id}`}
      className="flex items-center justify-between gap-4 rounded-card border border-line bg-surface px-4 py-3 transition-colors hover:bg-olive-tint"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{provider.company}</p>
        <p className="truncate font-mono text-xs text-ink-soft">{provider.contact}</p>
      </div>

      <div className="hidden shrink-0 sm:block">
        <FollowUpTrack followUpStep={provider.followUpStep} status={status} />
      </div>

      <div className="shrink-0 text-right">
        <p className={`text-xs font-semibold ${STATUS_TEXT[status]}`}>
          {STATUS_LABEL[status]}
        </p>
        <p className="font-mono text-xs text-ink-soft">
          Día {nextDay} · {formatDate(nextISO)}
        </p>
      </div>
    </Link>
  );
}
