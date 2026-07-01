"use client";

import { useEffect, useMemo, useState } from "react";
import { ImportDialog } from "@/components/ImportDialog";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import {
  TransactionForm,
  type TransactionFormValues,
} from "@/components/TransactionForm";
import { TransactionTable } from "@/components/TransactionTable";
import { formatDate, formatShort } from "@/lib/format";
import { importSettlement, settlementExists } from "@/lib/importWrite";
import {
  parseSettlement,
  type SettlementParseResult,
} from "@/lib/parseSettlement";
import {
  addTransaction,
  deleteTransaction,
  subscribeTransactions,
  updateTransaction,
} from "@/lib/transactions";
import {
  EXPENSE_CATEGORIES,
  INCOME_SOURCES,
  type Transaction,
} from "@/lib/types";

export default function FinanzasPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(
    () =>
      subscribeTransactions((list) => {
        setTransactions(list);
        setLoaded(true);
      }),
    [],
  );

  const metrics = useMemo(() => {
    let ingresos = 0;
    let egresos = 0;
    let operativo = 0; // Venta + Reintegro - Egresos
    for (const t of transactions) {
      if (t.type === "Ingreso") {
        ingresos += t.amount;
        if (t.incomeSource !== "Aporte de Socio") operativo += t.amount;
      } else {
        egresos += t.amount;
        operativo -= t.amount;
      }
    }
    return {
      ingresos,
      egresos,
      balance: ingresos - egresos,
      operativo,
    };
  }, [transactions]);

  const byCategory = useMemo(() => {
    const totals = new Map<string, number>();
    for (const cat of EXPENSE_CATEGORIES) totals.set(cat, 0);
    for (const t of transactions) {
      if (t.type === "Egreso" && t.expenseCategory) {
        totals.set(
          t.expenseCategory,
          (totals.get(t.expenseCategory) ?? 0) + t.amount,
        );
      }
    }
    return [...totals.entries()];
  }, [transactions]);

  const byIncomeSource = useMemo(() => {
    const totals = new Map<string, number>();
    for (const src of INCOME_SOURCES) totals.set(src, 0);
    for (const t of transactions) {
      if (t.type === "Ingreso" && t.incomeSource) {
        totals.set(t.incomeSource, (totals.get(t.incomeSource) ?? 0) + t.amount);
      }
    }
    return [...totals.entries()];
  }, [transactions]);

  const editingTransaction = editId
    ? transactions.find((t) => t.id === editId)
    : undefined;

  function openNew() {
    setEditId(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditId(null);
  }

  async function handleSave(values: TransactionFormValues) {
    if (editId) {
      await updateTransaction(editId, values);
    } else {
      await addTransaction(values);
    }
  }

  async function handleRowClick(t: Transaction) {
    setEditId(t.id);
    setFormOpen(true);
  }

  return (
    <>
      <PageHeader
        eyebrow="Finanzas"
        title="Flujo de caja"
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="rounded-control border border-olive px-3 py-2 text-sm font-medium text-olive transition-colors hover:bg-olive hover:text-stone"
            >
              Subir informe
            </button>
            <button
              type="button"
              onClick={openNew}
              className="rounded-control bg-olive px-3 py-2 text-sm font-medium text-stone transition-colors hover:bg-olive-deep"
            >
              Nuevo movimiento
            </button>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Ingresos" value={`$${metrics.ingresos.toFixed(2)}`} />
        <MetricCard label="Egresos" value={`$${metrics.egresos.toFixed(2)}`} />
        <MetricCard
          label="Balance"
          value={`$${metrics.balance.toFixed(2)}`}
          accent
        />
        <MetricCard
          label="Balance Operativo"
          value={`$${metrics.operativo.toFixed(2)}`}
          accent
        />
      </section>

      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <h2 className="mb-3 font-eyebrow text-[11px] uppercase tracking-[0.2em] text-ink-soft">
            Egresos por categoría
          </h2>
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            <table className="w-full text-left text-sm">
              <tbody>
                {byCategory.map(([cat, total]) => (
                  <tr key={cat} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5 text-ink">{cat}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-ink-soft">
                      ${total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="mb-3 font-eyebrow text-[11px] uppercase tracking-[0.2em] text-ink-soft">
            Ingresos por categoría
          </h2>
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            <table className="w-full text-left text-sm">
              <tbody>
                {byIncomeSource.map(([src, total]) => (
                  <tr key={src} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5 text-ink">{src}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-ink-soft">
                      ${total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-eyebrow text-[11px] uppercase tracking-[0.2em] text-ink-soft">
          Movimientos
        </h2>
        {!loaded ? (
          <p className="font-mono text-sm text-ink-soft">Cargando…</p>
        ) : (
          <TransactionTable
            transactions={transactions}
            onRowClick={handleRowClick}
          />
        )}
      </section>

      <TransactionForm
        open={formOpen}
        onClose={closeForm}
        initial={editingTransaction}
        onSave={handleSave}
        onDelete={
          editId ? async () => void (await deleteTransaction(editId)) : undefined
        }
      />

      <ImportDialog<SettlementParseResult>
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Subir informe de liquidación (Amazon)"
        accept=".txt"
        parse={parseSettlement}
        renderPreview={(r) => <SettlementPreview r={r} />}
        canConfirm={(r) => r.reconciles}
        checkDuplicate={(r) => settlementExists(r.settlementId)}
        onConfirm={(r, replace) => importSettlement(r, replace)}
      />
    </>
  );
}

function SettlementPreview({ r }: { r: SettlementParseResult }) {
  const neto = Math.round((r.ventas - r.gastos) * 100) / 100;
  return (
    <div className="space-y-1">
      <p className="font-medium text-ink">
        Liquidación {formatShort(r.periodStart)}–{formatDate(r.periodEnd)} · depósito{" "}
        {formatDate(r.depositDate)}
      </p>
      <div className="flex justify-between">
        <span className="text-ink-soft">Ventas Amazon</span>
        <span className="font-mono text-status-ontrack">+${r.ventas.toFixed(2)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-ink-soft">Gastos Amazon</span>
        <span className="font-mono text-status-overdue">−${r.gastos.toFixed(2)}</span>
      </div>
      <div className="flex justify-between border-t border-line pt-1 font-medium text-ink">
        <span>Neto</span>
        <span className="font-mono">
          ${neto.toFixed(2)} {r.reconciles ? "✓" : "⚠"}
        </span>
      </div>
      <p className="text-ink-soft">
        {r.skuSales.length} productos · liquidación {r.settlementId}
      </p>
    </div>
  );
}
