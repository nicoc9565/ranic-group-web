"use client";

import { useEffect, useMemo, useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { formatDate } from "@/lib/format";
import {
  subscribeOutreachConfig,
  updateOutreachConfig,
} from "@/lib/outreachConfig";
import { subscribeProviders } from "@/lib/providers";
import type { OutreachConfig, Provider } from "@/lib/types";

const REPLY_NOTE_TEXT = "Respuesta detectada — revisar Gmail.";

/** Tasa de rebote acumulada de toda la campaña (histórica, no una ventana móvil). */
function bounceRateLabel(config: OutreachConfig): string {
  const sent = config.sentTotal ?? 0;
  const bounced = config.bouncedTotal ?? 0;
  if (sent === 0) return "—";
  return `${((bounced / sent) * 100).toFixed(1)}% (${bounced}/${sent})`;
}

export default function OutreachPage() {
  const [config, setConfig] = useState<OutreachConfig | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [limitDraft, setLimitDraft] = useState("");

  useEffect(
    () =>
      subscribeOutreachConfig((c) => {
        setConfig(c);
        setLimitDraft(String(c.dailyLimit));
      }),
    [],
  );

  useEffect(() => subscribeProviders(setProviders), []);

  const outreach = useMemo(
    () => providers.filter((p) => p.source === "expo-outreach-import"),
    [providers],
  );

  const metrics = useMemo(() => {
    const eligible = outreach.filter((p) => p.outreachEligible);
    return {
      eligible: eligible.length,
      pending: eligible.filter(
        (p) => p.status === "Por Contactar" && !p.optedOut && p.sendAttemptedAt == null,
      ).length,
      contacted: outreach.filter((p) => p.status !== "Por Contactar").length,
      replies: outreach.filter(
        (p) => p.status === "Contactado" && p.notes.some((n) => n.text === REPLY_NOTE_TEXT),
      ).length,
    };
  }, [outreach]);

  const failed = useMemo(
    () =>
      outreach
        .filter((p) => p.sendError)
        .sort((a, b) => (b.sendAttemptedAt ?? 0) - (a.sendAttemptedAt ?? 0))
        .slice(0, 20),
    [outreach],
  );

  async function saveLimit() {
    const value = Number(limitDraft);
    if (!config || !Number.isFinite(value) || value < 0) {
      setLimitDraft(String(config?.dailyLimit ?? 0));
      return;
    }
    const rounded = Math.floor(value);
    if (rounded !== config.dailyLimit) await updateOutreachConfig({ dailyLimit: rounded });
    setLimitDraft(String(rounded));
  }

  if (!config) {
    return (
      <>
        <PageHeader eyebrow="Campaña" title="Outreach" />
        <p className="text-sm text-ink-soft">Cargando configuración…</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Campaña"
        title="Outreach"
        actions={
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              config.enabled
                ? "bg-status-ontrack/10 text-status-ontrack"
                : "bg-ink-soft/10 text-ink-soft"
            }`}
          >
            {config.enabled ? "Enviando" : "Pausado"}
          </span>
        }
      />

      {/* Motivo de la última pausa automática. No se borra al volver a encender: un enabled:false
          silencioso es indistinguible de que Nico lo apagó a mano. */}
      {config.pausedReason && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-card border border-status-overdue/40 bg-status-overdue/10 p-4">
          <div>
            <p className="font-eyebrow text-[10px] uppercase tracking-[0.18em] text-status-overdue">
              Pausa automática
            </p>
            <p className="mt-1 text-sm text-ink">{config.pausedReason}</p>
          </div>
          <button
            type="button"
            onClick={() => updateOutreachConfig({ pausedReason: null })}
            className="rounded-control border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:text-ink"
          >
            Limpiar aviso
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard
          label="Enviados hoy"
          value={`${config.sentToday} / ${config.dailyLimit}`}
          accent
        />
        <MetricCard label="Tasa de rebote" value={bounceRateLabel(config)} />
        <MetricCard label="Pendientes de envío" value={metrics.pending} />
        <MetricCard label="Contactados (outreach)" value={metrics.contacted} />
        <MetricCard label="Respuestas a revisar" value={metrics.replies} />
      </div>

      {/* Controles */}
      <div className="mt-6 rounded-card border border-line bg-surface p-4">
        <p className="font-eyebrow text-[10px] uppercase tracking-[0.18em] text-ink-soft">
          Control de envío
        </p>

        <label className="mt-3 flex items-start gap-3">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => updateOutreachConfig({ enabled: e.target.checked })}
            className="mt-0.5 h-4 w-4 shrink-0 accent-olive"
          />
          <span>
            <span className="block text-sm font-medium text-ink">Envío automático activo</span>
            <span className="block text-xs text-ink-soft">
              Con esto tildado, el cron manda hasta el límite diario a proveedores reales.
            </span>
          </span>
        </label>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label
              htmlFor="dailyLimit"
              className="block font-eyebrow text-[10px] uppercase tracking-[0.18em] text-ink-soft"
            >
              Límite diario
            </label>
            <input
              id="dailyLimit"
              type="number"
              min={0}
              value={limitDraft}
              onChange={(e) => setLimitDraft(e.target.value)}
              onBlur={saveLimit}
              className="mt-1 w-28 rounded-control border border-line bg-surface px-3 py-2 font-mono text-sm text-ink"
            />
          </div>
          <p className="pb-2 text-xs text-ink-soft">
            Se guarda al salir del campo. Reset del contador: {formatDate(config.lastResetDate)}{" "}
            (America/New_York).
          </p>
        </div>

        <p className="mt-4 text-xs text-ink-soft">
          Universo elegible: <span className="font-mono text-ink">{metrics.eligible}</span>{" "}
          proveedores importados que pasaron el filtro de elegibilidad.
        </p>
      </div>

      {/* Envíos fallidos */}
      <div className="mt-6">
        <p className="font-eyebrow text-[10px] uppercase tracking-[0.18em] text-ink-soft">
          Últimos envíos fallidos
        </p>
        {failed.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Sin errores de envío.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-card border border-line">
            <table className="min-w-full text-sm">
              <thead className="bg-stone/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium text-ink-soft">Empresa</th>
                  <th className="px-3 py-2 font-medium text-ink-soft">Email</th>
                  <th className="px-3 py-2 font-medium text-ink-soft">Error</th>
                </tr>
              </thead>
              <tbody>
                {failed.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="px-3 py-2 text-ink">{p.company}</td>
                    <td className="px-3 py-2 font-mono text-xs text-ink-soft">{p.email}</td>
                    <td className="px-3 py-2 text-xs text-status-overdue">{p.sendError}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
