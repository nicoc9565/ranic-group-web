"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FollowUpList, type FollowUpRow } from "@/components/FollowUpList";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { TaskForm } from "@/components/TaskForm";
import { TaskList } from "@/components/TaskList";
import { followUpStatus, nextFollowUpDate } from "@/lib/followup";
import { formatDate } from "@/lib/format";
import {
  countAutoContacted,
  countEverContacted,
  countProvidersByStatus,
  fetchFollowUpCandidates,
  fetchHardBouncedProviders,
  fetchRepliedProviders,
} from "@/lib/providers";
import { subscribeTasks, type Task } from "@/lib/tasks";
import type { Provider } from "@/lib/types";

const ACCOUNT_STATUSES: Provider["status"][] = ["Aprobado", "En Negociación"];
const URGENCY = { overdue: 0, today: 1, ontrack: 2 } as const;

/** Ventana para mostrar un rebote duro como novedad; después queda en la ficha del proveedor. */
const BOUNCE_WINDOW_DAYS = 7;

type Attention = {
  replies: Provider[];
  bounces: Provider[];
  followUps: FollowUpRow[];
};

const EMPTY: Attention = { replies: [], bounces: [], followUps: [] };

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [counts, setCounts] = useState<{
    autoContactados: number;
    contactados: number;
    cuenta: number;
  } | null>(null);
  const [attention, setAttention] = useState<Attention>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  useEffect(
    () =>
      subscribeTasks((list) => {
        setTasks(list);
        setTasksLoaded(true);
      }),
    [],
  );

  const today = useMemo(() => new Date(), []);

  // A diferencia del resto del CRM esto no es una suscripción en tiempo real: son lecturas
  // puntuales al montar. El Dashboard no necesita ver cambiar un contador solo, y suscribirse a
  // la colección entera costaba 2500 lecturas por visita para mostrar cuatro números.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [autoContactados, contactados, cuenta, replied, bounced, candidates] =
        await Promise.all([
          countAutoContacted(),
          countEverContacted(),
          countProvidersByStatus(ACCOUNT_STATUSES),
          fetchRepliedProviders(),
          fetchHardBouncedProviders(),
          fetchFollowUpCandidates(),
        ]);
      if (cancelled) return;

      // Sin triar = el cron detectó la respuesta y Nico todavía no movió el status.
      const replies = replied.filter((p) => p.status === "Contactado");

      // updatedAt es la aproximación al momento del rebote: es la escritura que lo registró.
      const cutoff = Date.now() - BOUNCE_WINDOW_DAYS * 86_400_000;
      const bounces = bounced
        .filter((p) => (p.updatedAt ?? 0) >= cutoff)
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

      const followUps = candidates
        .map((p) => ({ p, s: followUpStatus(p, today) }))
        .filter((r): r is FollowUpRow => r.s === "overdue" || r.s === "today")
        .sort((a, b) => {
          if (URGENCY[a.s] !== URGENCY[b.s]) return URGENCY[a.s] - URGENCY[b.s];
          return (
            (nextFollowUpDate(a.p)?.getTime() ?? 0) -
            (nextFollowUpDate(b.p)?.getTime() ?? 0)
          );
        });

      setCounts({ autoContactados, contactados, cuenta });
      setAttention({ replies, bounces, followUps });
      setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [today]);

  const attentionCount =
    attention.replies.length + attention.bounces.length + attention.followUps.length;

  return (
    <>
      <PageHeader eyebrow="Resumen" title="Dashboard" />

      {/* Métricas */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard
          label="Contactados por el programa"
          value={counts?.autoContactados ?? "—"}
        />
        <MetricCard label="Contactados en total" value={counts?.contactados ?? "—"} />
        <MetricCard
          label="Respuestas sin revisar"
          value={loaded ? attention.replies.length : "—"}
          accent
        />
        <MetricCard label="Cuenta abierta" value={counts?.cuenta ?? "—"} accent />
      </section>

      {/* Requieren tu atención */}
      <section className="mt-8">
        <h2 className="mb-3 font-eyebrow text-[11px] uppercase tracking-[0.2em] text-ink-soft">
          Requieren tu atención
        </h2>

        {!loaded ? (
          <p className="font-mono text-sm text-ink-soft">Cargando…</p>
        ) : attentionCount === 0 ? (
          <div className="rounded-card border border-dashed border-line bg-surface px-4 py-10 text-center">
            <p className="text-sm text-ink">No hay nada pendiente.</p>
            <p className="mt-1 text-xs text-ink-soft">
              Las respuestas, los rebotes y los follow-ups vencidos aparecen acá.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {attention.replies.length > 0 && (
              <AttentionGroup
                title="Respuestas sin triar"
                tone="olive"
                providers={attention.replies}
                detail={(p) => p.email}
              />
            )}

            {attention.bounces.length > 0 && (
              <AttentionGroup
                title={`Rebotes duros (últimos ${BOUNCE_WINDOW_DAYS} días)`}
                tone="overdue"
                providers={attention.bounces}
                detail={(p) => p.sendError || p.email}
              />
            )}

            {attention.followUps.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold text-ink-soft">
                  Follow-ups vencidos o de hoy
                </h3>
                <FollowUpList rows={attention.followUps} />
              </div>
            )}
          </div>
        )}
      </section>

      {/* Tareas */}
      <section className="mt-8">
        <h2 className="mb-3 font-eyebrow text-[11px] uppercase tracking-[0.2em] text-ink-soft">
          Tareas
        </h2>

        {!tasksLoaded ? (
          <p className="font-mono text-sm text-ink-soft">Cargando…</p>
        ) : (
          <div className="space-y-3">
            <TaskForm />
            <TaskList tasks={tasks} />
          </div>
        )}
      </section>
    </>
  );
}

function AttentionGroup({
  title,
  tone,
  providers,
  detail,
}: {
  title: string;
  tone: "olive" | "overdue";
  providers: Provider[];
  detail: (p: Provider) => string;
}) {
  const border = tone === "overdue" ? "border-l-status-overdue" : "border-l-olive";
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold text-ink-soft">{title}</h3>
      <div className="space-y-2">
        {providers.map((p) => (
          <Link
            key={p.id}
            href={`/admin/proveedores?id=${p.id}`}
            className={`flex items-center justify-between gap-4 rounded-card border border-l-2 border-line bg-surface px-4 py-3 transition-colors hover:bg-cream ${border}`}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{p.company}</p>
              <p className="truncate font-mono text-xs text-ink-soft">{detail(p)}</p>
            </div>
            <span className="shrink-0 font-mono text-xs text-ink-soft">
              {formatDate(p.firstContactDate)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
