"use client";

import Link from "next/link";
import { useState } from "react";
import { FollowUpTrack } from "@/components/FollowUpTrack";
import { advanceFollowUp, FOLLOWUP_DAYS, nextFollowUpDate } from "@/lib/followup";
import { formatDate, todayISO } from "@/lib/format";
import { updateProvider } from "@/lib/providers";
import type { Provider } from "@/lib/types";

export type FollowUpRow = { p: Provider; s: "overdue" | "today" | "ontrack" };

const LABEL = {
  overdue: "Vencido",
  today: "Vence hoy",
  ontrack: "En fecha",
} as const;
const TEXT = {
  overdue: "text-status-overdue",
  today: "text-status-today",
  ontrack: "text-status-ontrack",
} as const;

const StopIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M6.5 6.5l11 11" />
  </svg>
);

/**
 * Tarjetas de follow-up. Salieron tal cual de la pantalla /admin/follow-ups, que se fusionó en el
 * Dashboard: es UI que ya funcionaba y no se rediseña, solo cambia de casa.
 */
export function FollowUpList({ rows }: { rows: FollowUpRow[] }) {
  const [marking, setMarking] = useState<string | null>(null);
  const [stopping, setStopping] = useState<string | null>(null);

  async function markSent(p: Provider) {
    setMarking(p.id);
    try {
      await updateProvider(p.id, advanceFollowUp(p, todayISO()));
    } finally {
      setMarking(null);
    }
  }

  async function stopFollowUp(p: Provider) {
    setStopping(p.id);
    try {
      await updateProvider(p.id, { followUpStopped: true });
    } finally {
      setStopping(null);
    }
  }

  return (
    <div className="space-y-2">
      {rows.map(({ p, s }) => {
        const day = FOLLOWUP_DAYS[p.followUpStep + 1];
        const next = nextFollowUpDate(p);
        return (
          <div
            key={p.id}
            className={`overflow-hidden rounded-card border border-line bg-surface ${
              s === "overdue" ? "border-l-2 border-l-status-overdue" : ""
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{p.company}</p>
                <p className="truncate font-mono text-xs text-ink-soft">{p.contact}</p>
              </div>

              <div className="hidden shrink-0 sm:block">
                <FollowUpTrack followUpStep={p.followUpStep} status={s} />
              </div>

              <div className="shrink-0 text-right">
                <p className={`text-xs font-semibold ${TEXT[s]}`}>{LABEL[s]}</p>
                <p className="font-mono text-xs text-ink-soft">
                  Día {day} · {formatDate(next ? next.toISOString().slice(0, 10) : null)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5">
              <button
                type="button"
                onClick={() => stopFollowUp(p)}
                disabled={stopping === p.id}
                title="Detener seguimiento"
                className="shrink-0 rounded-control p-1.5 text-ink-soft transition-colors hover:bg-status-overdue/10 hover:text-status-overdue disabled:opacity-50"
              >
                <span className="block h-4 w-4">
                  <StopIcon />
                </span>
              </button>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {/* El generador se mudó adentro de la ficha del proveedor: el link abre el
                    detalle, donde está el composer con el tipo ya sugerido por followUpStep. */}
                <Link
                  href={`/admin/proveedores?id=${p.id}`}
                  className="shrink-0 rounded-control border border-olive px-3 py-2 text-sm font-medium text-olive transition-colors hover:bg-olive/10"
                >
                  Redactar email
                </Link>

                <button
                  type="button"
                  onClick={() => markSent(p)}
                  disabled={marking === p.id}
                  className="shrink-0 rounded-control bg-olive px-3 py-2 text-sm font-medium text-stone transition-colors hover:bg-olive-deep disabled:opacity-60"
                >
                  {marking === p.id ? "Guardando…" : "Marcar como enviado"}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
