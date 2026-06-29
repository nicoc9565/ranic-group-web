"use client";

import { formatDate } from "@/lib/format";
import type { Transaction } from "@/lib/types";

function categoryLabel(t: Transaction): string {
  return t.type === "Ingreso"
    ? (t.incomeSource ?? "—")
    : (t.expenseCategory ?? "—");
}

export function TransactionTable({
  transactions,
  onRowClick,
}: {
  transactions: Transaction[];
  onRowClick: (t: Transaction) => void;
}) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-surface px-4 py-10 text-center">
        <p className="text-sm text-ink">No hay movimientos que coincidan.</p>
        <p className="mt-1 text-xs text-ink-soft">
          Ajustá los filtros o agregá un movimiento nuevo.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line">
            {["Fecha", "Tipo", "Descripción", "Categoría", "Quién", "Monto"].map(
              (h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 font-eyebrow text-[10px] uppercase tracking-[0.15em] text-ink-soft"
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr
              key={t.id}
              onClick={() => onRowClick(t)}
              className="cursor-pointer border-b border-line last:border-0 transition-colors hover:bg-olive-tint"
            >
              <td className="px-4 py-3 font-mono text-xs text-ink-soft">
                {formatDate(t.date)}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`text-xs font-semibold ${
                    t.type === "Ingreso"
                      ? "text-status-ontrack"
                      : "text-status-overdue"
                  }`}
                >
                  {t.type}
                </span>
              </td>
              <td className="px-4 py-3 text-ink">{t.description}</td>
              <td className="px-4 py-3 text-ink-soft">{categoryLabel(t)}</td>
              <td className="px-4 py-3 text-ink-soft">{t.payer || "—"}</td>
              <td className="px-4 py-3 text-right font-mono text-ink">
                ${t.amount.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
