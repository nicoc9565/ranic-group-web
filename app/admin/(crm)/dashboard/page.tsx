"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { TaskForm } from "@/components/TaskForm";
import { TaskList } from "@/components/TaskList";
import { followUpStatus } from "@/lib/followup";
import { subscribeProviders } from "@/lib/providers";
import { subscribeTasks, type Task } from "@/lib/tasks";
import type { Provider } from "@/lib/types";

const IN_PROGRESS: Provider["status"][] = [
  "Contactado",
  "En Espera de Respuesta",
  "En Negociación",
];

export default function DashboardPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => subscribeProviders(setProviders), []);
  useEffect(
    () =>
      subscribeTasks((list) => {
        setTasks(list);
        setLoaded(true);
      }),
    [],
  );

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

  return (
    <>
      <PageHeader eyebrow="Resumen" title="Dashboard" />

      {/* Métricas */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Proveedores" value={metrics.total} />
        <MetricCard label="Aprobados" value={metrics.aprobados} accent />
        <MetricCard label="En proceso" value={metrics.enProceso} />
        <MetricCard label="Follow-ups hoy" value={metrics.pendientesHoy} accent />
      </section>

      {/* Tareas */}
      <section className="mt-8">
        <h2 className="mb-3 font-eyebrow text-[11px] uppercase tracking-[0.2em] text-ink-soft">
          Tareas
        </h2>

        {!loaded ? (
          <p className="font-mono text-sm text-ink-soft">Cargando…</p>
        ) : (
          <div className="space-y-3">
            <TaskForm />
            <TaskList tasks={tasks} />
          </div>
        )}
      </section>

      {/* Banner follow-ups compacto */}
      {metrics.pendientesHoy > 0 && (
        <section className="mt-6">
          <div className="flex items-center justify-between rounded-card border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-medium text-amber-800">
              Tenés {metrics.pendientesHoy} follow-up
              {metrics.pendientesHoy === 1 ? "" : "s"} vencido
              {metrics.pendientesHoy === 1 ? "" : "s"} o que vence
              {metrics.pendientesHoy === 1 ? "" : "n"} hoy
            </p>
            <Link
              href="/admin/follow-ups"
              className="text-sm font-medium text-amber-800 underline hover:text-amber-900"
            >
              Ver todos →
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
