"use client";

import { useEffect, useMemo, useState } from "react";
import { FollowUpTrack } from "@/components/FollowUpTrack";
import { PageHeader } from "@/components/PageHeader";
import {
  advanceFollowUp,
  FOLLOWUP_DAYS,
  followUpStatus,
  nextFollowUpDate,
} from "@/lib/followup";
import { formatDate, todayISO } from "@/lib/format";
import { subscribeProviders, updateProvider } from "@/lib/providers";
import type { Provider } from "@/lib/types";

const URGENCY = { overdue: 0, today: 1, ontrack: 2, none: 3 } as const;
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

export default function FollowUpsPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);

  useEffect(
    () =>
      subscribeProviders((list) => {
        setProviders(list);
        setLoaded(true);
      }),
    [],
  );

  const today = useMemo(() => new Date(), []);

  const rows = useMemo(() => {
    return providers
      .map((p) => ({ p, s: followUpStatus(p, today) }))
      .filter(({ s }) => s !== "none")
      .sort((a, b) => {
        if (URGENCY[a.s] !== URGENCY[b.s]) return URGENCY[a.s] - URGENCY[b.s];
        const da = nextFollowUpDate(a.p)?.getTime() ?? 0;
        const db = nextFollowUpDate(b.p)?.getTime() ?? 0;
        return da - db;
      });
  }, [providers, today]);

  async function markSent(p: Provider) {
    setMarking(p.id);
    try {
      await updateProvider(p.id, advanceFollowUp(p, todayISO()));
    } finally {
      setMarking(null);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Seguimiento" title="Follow-ups" />

      {!loaded ? (
        <p className="font-mono text-sm text-ink-soft">Cargando…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface px-4 py-10 text-center">
          <p className="text-sm text-ink">No hay follow-ups en curso.</p>
          <p className="mt-1 text-xs text-ink-soft">
            Los proveedores aparecen acá una vez enviado el primer email.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(({ p, s }) => {
            const status = s as "overdue" | "today" | "ontrack";
            const day = FOLLOWUP_DAYS[p.followUpStep + 1];
            const next = nextFollowUpDate(p);
            return (
              <div
                key={p.id}
                className={`flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-surface px-4 py-3 ${
                  status === "overdue" ? "border-l-2 border-l-status-overdue" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {p.company}
                  </p>
                  <p className="truncate font-mono text-xs text-ink-soft">
                    {p.contact}
                  </p>
                </div>

                <div className="hidden shrink-0 sm:block">
                  <FollowUpTrack followUpStep={p.followUpStep} status={status} />
                </div>

                <div className="shrink-0 text-right">
                  <p className={`text-xs font-semibold ${TEXT[status]}`}>
                    {LABEL[status]}
                  </p>
                  <p className="font-mono text-xs text-ink-soft">
                    Día {day} · {formatDate(next ? next.toISOString().slice(0, 10) : null)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => markSent(p)}
                  disabled={marking === p.id}
                  className="shrink-0 rounded-control bg-olive px-3 py-2 text-sm font-medium text-stone transition-colors hover:bg-olive-deep disabled:opacity-60"
                >
                  {marking === p.id ? "Guardando…" : "Marcar como enviado"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
