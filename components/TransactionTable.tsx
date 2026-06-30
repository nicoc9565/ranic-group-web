"use client";

import { useMemo, useState } from "react";
import { formatDate } from "@/lib/format";
import type { Transaction } from "@/lib/types";

type SortKey = "date" | "type" | "description" | "category" | "payer" | "amount";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; defaultDir: SortDir }[] = [
  { key: "date", label: "Fecha", defaultDir: "desc" },
  { key: "type", label: "Tipo", defaultDir: "asc" },
  { key: "description", label: "Descripción", defaultDir: "asc" },
  { key: "category", label: "Categoría", defaultDir: "asc" },
  { key: "payer", label: "Quién", defaultDir: "asc" },
  { key: "amount", label: "Monto", defaultDir: "desc" },
];

function categoryLabel(t: Transaction): string {
  return t.type === "Ingreso"
    ? (t.incomeSource ?? "—")
    : (t.expenseCategory ?? "—");
}

function sortValue(t: Transaction, key: SortKey): string | number {
  switch (key) {
    case "date":
      return t.date;
    case "type":
      return t.type;
    case "description":
      return t.description.toLowerCase();
    case "category":
      return categoryLabel(t).toLowerCase();
    case "payer":
      return (t.payer || "").toLowerCase();
    case "amount":
      return t.amount;
  }
}

export function TransactionTable({
  transactions,
  onRowClick,
}: {
  transactions: Transaction[];
  onRowClick: (t: Transaction) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(COLUMNS.find((c) => c.key === key)!.defaultDir);
    }
  }

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...transactions].sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [transactions, sortKey, sortDir]);

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
            {COLUMNS.map((c) => (
              <th key={c.key} className="px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => toggleSort(c.key)}
                  className="flex items-center gap-1 font-eyebrow text-[10px] uppercase tracking-[0.15em] text-ink-soft transition-colors hover:text-ink"
                >
                  {c.label}
                  {sortKey === c.key && (
                    <span aria-hidden>{sortDir === "asc" ? "▲" : "▼"}</span>
                  )}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
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
