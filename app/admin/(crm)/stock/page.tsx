"use client";

import { useEffect, useMemo, useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { formatDate } from "@/lib/format";
import { subscribeStock } from "@/lib/stock";
import type { StockItem } from "@/lib/types";

const HEALTH_BADGE: Record<string, string> = {
  Healthy: "bg-status-ontrack/10 text-status-ontrack",
  "Low stock": "bg-status-overdue/10 text-status-overdue",
  Excess: "bg-status-today/10 text-status-today",
};

function HealthBadge({ status }: { status: string }) {
  if (!status) return <span className="text-ink-soft">—</span>;
  const cls = HEALTH_BADGE[status] ?? "bg-ink-soft/10 text-ink-soft";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

export default function StockPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(
    () =>
      subscribeStock((list) => {
        setItems(list);
        setLoaded(true);
      }),
    [],
  );

  const latestDate = useMemo(() => {
    return items.reduce<string | null>(
      (max, it) => (!max || it.snapshotDate > max ? it.snapshotDate : max),
      null,
    );
  }, [items]);

  const latest = useMemo(
    () => items.filter((it) => it.snapshotDate === latestDate),
    [items, latestDate],
  );

  const metrics = useMemo(() => {
    return latest.reduce(
      (acc, it) => ({
        available: acc.available + it.available,
        value: acc.value + it.available * it.price,
        shipped30: acc.shipped30 + it.unitsShipped30,
        shipped90: acc.shipped90 + it.unitsShipped90,
      }),
      { available: 0, value: 0, shipped30: 0, shipped90: 0 },
    );
  }, [latest]);

  return (
    <>
      <PageHeader
        eyebrow={latestDate ? `Snapshot: ${formatDate(latestDate)}` : "Stock"}
        title="Stock"
      />

      {!loaded ? (
        <p className="font-mono text-sm text-ink-soft">Cargando…</p>
      ) : items.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface px-4 py-10 text-center">
          <p className="text-sm text-ink">Todavía no hay datos de stock.</p>
          <p className="mt-1 text-xs text-ink-soft">
            Se cargan con el import mensual del inventario de Amazon.
          </p>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricCard label="Unidades disponibles" value={metrics.available} />
            <MetricCard
              label="Valor de inventario"
              value={`$${metrics.value.toFixed(2)}`}
              accent
            />
            <MetricCard label="Vendido (30 días)" value={metrics.shipped30} />
            <MetricCard label="Vendido (90 días)" value={metrics.shipped90} />
          </section>

          <section className="mt-8">
            <h2 className="mb-3 font-eyebrow text-[11px] uppercase tracking-[0.2em] text-ink-soft">
              Productos
            </h2>
            <div className="overflow-hidden rounded-card border border-line bg-surface">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    {[
                      "SKU",
                      "Producto",
                      "Disponible",
                      "Vendido 30d",
                      "Días de stock",
                      "Precio",
                      "Estado",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 font-eyebrow text-[10px] uppercase tracking-[0.15em] text-ink-soft"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {latest.map((it) => (
                    <tr key={it.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 font-mono text-xs text-ink-soft">
                        {it.sku}
                      </td>
                      <td className="px-4 py-3 text-ink">{it.productName}</td>
                      <td className="px-4 py-3 text-right font-mono text-ink">
                        {it.available}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-ink-soft">
                        {it.unitsShipped30}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-ink-soft">
                        {it.daysOfSupply ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-ink">
                        ${it.price.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <HealthBadge status={it.healthStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
