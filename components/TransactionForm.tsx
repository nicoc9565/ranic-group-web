"use client";

import { useState } from "react";
import { todayISO } from "@/lib/format";
import {
  EXPENSE_CATEGORIES,
  INCOME_SOURCES,
  type ExpenseCategory,
  type IncomeSource,
  type Transaction,
  type TransactionType,
} from "@/lib/types";
import { Modal } from "./Modal";

export type TransactionFormValues = {
  date: string;
  type: TransactionType;
  description: string;
  amount: number;
  payer: string;
  method: string;
  incomeSource: IncomeSource | null;
  expenseCategory: ExpenseCategory | null;
};

// Opciones fijas para los selects; "Otro…" despliega un input de texto libre.
const FIXED_PAYERS = ["Nico", "Rafa", "Ranic Group LLC", "Amazon"];
const FIXED_METHODS = [
  "Credit Card",
  "Debit Card",
  "Transferencia",
  "Credit Card Rafa",
];
const OTHER = "__other__";

const inputCls =
  "w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-olive";
const labelCls =
  "mb-1 block font-eyebrow text-[11px] uppercase tracking-[0.15em] text-ink-soft";

function initialValues(initial?: Transaction): TransactionFormValues {
  return initial
    ? {
        date: initial.date,
        type: initial.type,
        description: initial.description,
        amount: initial.amount,
        payer: initial.payer,
        method: initial.method,
        incomeSource: initial.incomeSource,
        expenseCategory: initial.expenseCategory,
      }
    : {
        date: todayISO(),
        type: "Egreso",
        description: "",
        amount: 0,
        payer: "",
        method: "",
        incomeSource: null,
        expenseCategory: EXPENSE_CATEGORIES[0],
      };
}

/** ¿El valor cae fuera de la lista fija (y no es vacío)? → modo "Otro…". */
function isCustom(value: string, fixed: string[]): boolean {
  return value !== "" && !fixed.includes(value);
}

export function TransactionForm({
  open,
  onClose,
  initial,
  onSave,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Transaction;
  onSave: (values: TransactionFormValues) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
}) {
  // El Modal desmonta a sus hijos al cerrar, así que el cuerpo se remonta cada vez que
  // se abre; la `key` lo reinicia también al cambiar de movimiento con el form ya abierto.
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Editar movimiento" : "Nuevo movimiento"}
    >
      <TransactionFormBody
        key={initial?.id ?? "new"}
        initial={initial}
        onClose={onClose}
        onSave={onSave}
        onDelete={onDelete}
      />
    </Modal>
  );
}

function TransactionFormBody({
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  initial?: Transaction;
  onClose: () => void;
  onSave: (values: TransactionFormValues) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
}) {
  const [values, setValues] = useState<TransactionFormValues>(() =>
    initialValues(initial),
  );
  const [payerOther, setPayerOther] = useState(() =>
    isCustom(initialValues(initial).payer, FIXED_PAYERS),
  );
  const [methodOther, setMethodOther] = useState(() =>
    isCustom(initialValues(initial).method, FIXED_METHODS),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function set<K extends keyof TransactionFormValues>(
    key: K,
    val: TransactionFormValues[K],
  ) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  function setType(type: TransactionType) {
    setValues((v) => ({
      ...v,
      type,
      incomeSource: type === "Ingreso" ? INCOME_SOURCES[0] : null,
      expenseCategory: type === "Egreso" ? EXPENSE_CATEGORIES[0] : null,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!values.description.trim())
      return setError("La descripción es obligatoria.");
    if (!values.amount || values.amount <= 0)
      return setError("El monto debe ser mayor a 0.");
    setSaving(true);
    try {
      await onSave({
        ...values,
        description: values.description.trim(),
        payer: values.payer.trim(),
        method: values.method.trim(),
      });
      onClose();
    } catch {
      setError("No se pudo guardar. Probá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="date">
              Fecha
            </label>
            <input
              id="date"
              type="date"
              className={`${inputCls} font-mono`}
              value={values.date}
              onChange={(e) => set("date", e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="type">
              Tipo
            </label>
            <select
              id="type"
              className={inputCls}
              value={values.type}
              onChange={(e) => setType(e.target.value as TransactionType)}
            >
              <option value="Ingreso">Ingreso</option>
              <option value="Egreso">Egreso</option>
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="description">
            Descripción
          </label>
          <input
            id="description"
            className={inputCls}
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="amount">
              Monto
            </label>
            <input
              id="amount"
              type="number"
              min="0.01"
              step="0.01"
              className={`${inputCls} font-mono`}
              value={values.amount || ""}
              onChange={(e) => set("amount", Number(e.target.value))}
              required
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="category">
              {values.type === "Ingreso" ? "Origen" : "Categoría"}
            </label>
            {values.type === "Ingreso" ? (
              <select
                id="category"
                className={inputCls}
                value={values.incomeSource ?? INCOME_SOURCES[0]}
                onChange={(e) =>
                  set("incomeSource", e.target.value as IncomeSource)
                }
              >
                {INCOME_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : (
              <select
                id="category"
                className={inputCls}
                value={values.expenseCategory ?? EXPENSE_CATEGORIES[0]}
                onChange={(e) =>
                  set("expenseCategory", e.target.value as ExpenseCategory)
                }
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="payer">
              Quién
            </label>
            <select
              id="payer"
              className={inputCls}
              value={payerOther ? OTHER : values.payer}
              onChange={(e) => {
                if (e.target.value === OTHER) {
                  setPayerOther(true);
                  set("payer", "");
                } else {
                  setPayerOther(false);
                  set("payer", e.target.value);
                }
              }}
            >
              <option value="">Seleccionar…</option>
              {FIXED_PAYERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              <option value={OTHER}>Otro…</option>
            </select>
            {payerOther && (
              <input
                aria-label="Quién (otro)"
                className={`${inputCls} mt-2`}
                value={values.payer}
                onChange={(e) => set("payer", e.target.value)}
                placeholder="Escribir quién…"
              />
            )}
          </div>
          <div>
            <label className={labelCls} htmlFor="method">
              Método
            </label>
            <select
              id="method"
              className={inputCls}
              value={methodOther ? OTHER : values.method}
              onChange={(e) => {
                if (e.target.value === OTHER) {
                  setMethodOther(true);
                  set("method", "");
                } else {
                  setMethodOther(false);
                  set("method", e.target.value);
                }
              }}
            >
              <option value="">Seleccionar…</option>
              {FIXED_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              <option value={OTHER}>Otro…</option>
            </select>
            {methodOther && (
              <input
                aria-label="Método (otro)"
                className={`${inputCls} mt-2`}
                value={values.method}
                onChange={(e) => set("method", e.target.value)}
                placeholder="Escribir método…"
              />
            )}
          </div>
        </div>

        {error && <p className="text-sm text-status-overdue">{error}</p>}

        {/* Acciones: eliminar (solo al editar) a la izquierda, cancelar/guardar a la derecha */}
        <div className="flex items-center justify-between gap-2 border-t border-line pt-4">
          {initial && onDelete ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-status-overdue">¿Eliminar?</span>
                <button
                  type="button"
                  onClick={async () => {
                    await onDelete();
                    onClose();
                  }}
                  className="rounded-control bg-status-overdue px-3 py-1.5 text-xs font-medium text-white"
                >
                  Sí, eliminar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-ink-soft hover:text-ink"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-sm text-status-overdue hover:underline"
              >
                Eliminar
              </button>
            )
          ) : (
            <span />
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-control px-4 py-2 text-sm text-ink-soft hover:text-ink"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-control bg-olive px-4 py-2 text-sm font-medium text-stone transition-colors hover:bg-olive-deep disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </form>
  );
}
