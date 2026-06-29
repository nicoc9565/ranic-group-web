"use client";

import { useEffect, useMemo, useState } from "react";
import { FollowUpAlert } from "@/components/FollowUpAlert";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { followUpStatus } from "@/lib/followup";
import { subscribeProviders } from "@/lib/providers";
import type { Provider } from "@/lib/types";

const IN_PROGRESS: Provider["status"][] = [
  "Contactado",
  "En Espera de Respuesta",
  "En Negociación",
];

// Orden de urgencia para las alertas.
const URGENCY = { overdue: 0, today: 1, ontrack: 2, none: 3 } as const;

export default function DashboardPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(
    () =>
      subscribeProviders((list) => {
        setProviders(list);
        setLoaded(true);
      }),
    [],
  );

  // Fecha de hoy estable durante el render.
  const today = useMemo(() => new Date(), []);

  const metrics = useMemo(() => {
    const aprobados = providers.filter((p) => p.status === "Aprobado").length;
    const enProceso = providers.filter((p) =>
      IN_PROGRESS.includes(p.status),
    ).length;
    const pendientesHoy = providers.filter((p) => {
      const s = followUpStatus(p, today);
      return s === "today" || s === "overdue";
    }).length;
    return { total: providers.length, aprobados, enProceso, pendientesHoy };
  }, [providers, today]);

  const alerts = useMemo(() => {
    return providers
      .map((p) => ({ p, s: followUpStatus(p, today) }))
      .filter(({ s }) => s === "overdue" || s === "today")
      .sort((a, b) => URGENCY[a.s] - URGENCY[b.s]);
  }, [providers, today]);

  return (
    <>
      <PageHeader eyebrow="Resumen" title="Dashboard" />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Proveedores" value={metrics.total} />
        <MetricCard label="Aprobados" value={metrics.aprobados} accent />
        <MetricCard label="En proceso" value={metrics.enProceso} />
        <MetricCard label="Follow-ups hoy" value={metrics.pendientesHoy} accent />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-eyebrow text-[11px] uppercase tracking-[0.2em] text-ink-soft">
          Follow-ups pendientes
        </h2>

        {!loaded ? (
          <p className="font-mono text-sm text-ink-soft">Cargando…</p>
        ) : alerts.length === 0 ? (
          <div className="rounded-card border border-dashed border-line bg-surface px-4 py-8 text-center">
            <p className="text-sm text-ink">Nada pendiente para hoy.</p>
            <p className="mt-1 text-xs text-ink-soft">
              No hay follow-ups vencidos ni que venzan hoy.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map(({ p }) => (
              <FollowUpAlert key={p.id} provider={p} today={today} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
