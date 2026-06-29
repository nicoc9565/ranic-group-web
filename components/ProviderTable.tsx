"use client";

import { FOLLOWUP_DAYS, followUpStatus, nextFollowUpDate } from "@/lib/followup";
import { formatDate } from "@/lib/format";
import type { Provider } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

const NEXT_TEXT = {
  overdue: "text-status-overdue",
  today: "text-status-today",
  ontrack: "text-status-ontrack",
  none: "text-ink-soft",
} as const;

function NextCell({ provider, today }: { provider: Provider; today: Date }) {
  const status = followUpStatus(provider, today);
  if (status === "none") {
    return <span className="font-mono text-xs text-ink-soft">—</span>;
  }
  const next = nextFollowUpDate(provider);
  const day = FOLLOWUP_DAYS[provider.followUpStep + 1];
  return (
    <span className={`font-mono text-xs ${NEXT_TEXT[status]}`}>
      D{day} · {formatDate(next ? next.toISOString().slice(0, 10) : null)}
    </span>
  );
}

export function ProviderTable({
  providers,
  today,
  onRowClick,
}: {
  providers: Provider[];
  today: Date;
  onRowClick: (p: Provider) => void;
}) {
  if (providers.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-surface px-4 py-10 text-center">
        <p className="text-sm text-ink">No hay proveedores que coincidan.</p>
        <p className="mt-1 text-xs text-ink-soft">
          Ajustá los filtros o creá un proveedor nuevo.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line">
            {["Empresa", "Contacto", "Categoría", "Estado", "Score", "Próximo"].map((h) => (
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
          {providers.map((p) => (
            <tr
              key={p.id}
              onClick={() => onRowClick(p)}
              className="cursor-pointer border-b border-line last:border-0 transition-colors hover:bg-olive-tint"
            >
              <td className="px-4 py-3 font-medium text-ink">{p.company}</td>
              <td className="px-4 py-3 text-ink-soft">{p.contact || "—"}</td>
              <td className="px-4 py-3 text-ink-soft">{p.category}</td>
              <td className="px-4 py-3">
                <StatusBadge status={p.status} />
              </td>
              <td className="px-4 py-3 font-mono text-xs text-ink-soft">
                {p.score}/5
              </td>
              <td className="px-4 py-3">
                <NextCell provider={p} today={today} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
