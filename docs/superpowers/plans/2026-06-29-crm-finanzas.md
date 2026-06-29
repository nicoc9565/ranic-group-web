# RANIC CRM — Módulo de Finanzas Implementation Plan

> **For agentic workers (Claude en VS Code):** Ejecutá este plan tarea por tarea, en orden, con
> commit al final de cada tarea. Solo toca `/admin` (CRM) — no tocar el sitio público. Trabajá en
> un branch nuevo (ej. `crm-finanzas`) y abrí un PR al final, igual que en los planes anteriores.

**Goal:** Agregar un módulo de Finanzas (flujo de caja) al CRM: nueva colección `transactions`,
página `/admin/finanzas` con métricas y tabla de movimientos, e importación de los 43 movimientos
históricos de la planilla de Nico.

**Architecture:** Mismo patrón que `providers`: tipos en `lib/types.ts`, acceso a datos en
`lib/transactions.ts` (real-time con `onSnapshot`), un módulo puro testeado
(`lib/financeCategory.ts`) para inferir categorías en el import, componentes de UI calcados a
`ProviderForm`/`ProviderTable`, y un script de import calcado a `import-providers.ts`.

**Tech Stack:** TypeScript, Firebase Web SDK, Vitest (TDD para `lib/financeCategory.ts`),
`csv-parse` (ya instalado desde el plan anterior).

**Spec de referencia:** `docs/superpowers/specs/2026-06-29-crm-finanzas-design.md`.

## Global Constraints

- **No tocar el sitio público** (`app/page.tsx`, `app/privacy/`, `app/terms/`,
  `components/public/`).
- **Un solo ítem nuevo en el nav** ("Finanzas") — no se separan dashboard y tabla en dos rutas.
- **`payer` y `method` quedan en texto libre**, no listas cerradas.
- **No se construye la parte de rentabilidad por producto** (hoja "Stock") en este plan — queda
  para un tramo futuro.
- **Idioma:** labels de UI en español, consistente con el resto del CRM.

---

## File Structure

```
ranic-web/
├── lib/
│   ├── types.ts                          # Modify: + TransactionType, IncomeSource,
│   │                                        ExpenseCategory, Transaction
│   ├── financeCategory.ts                # Create: inferIncomeSource, inferExpenseCategory
│   ├── transactions.ts                   # Create: acceso a datos (mismo patrón que providers.ts)
│   └── __tests__/
│       └── financeCategory.test.ts       # Create
├── components/
│   ├── TransactionForm.tsx               # Create
│   ├── TransactionTable.tsx              # Create
│   └── Nav.tsx                           # Modify: + ítem "Finanzas"
├── app/admin/(crm)/
│   └── finanzas/page.tsx                 # Create
├── scripts/
│   └── import-transactions.ts            # Create
└── package.json                          # Modify: + script import-transactions
```

---

## Task 1: Tipos del dominio de Finanzas

**Files:**
- Modify: `lib/types.ts` (agregar al final del archivo, después de `EMAIL_TYPE_LABELS`)

**Interfaces:**
- Produces: `TransactionType`, `IncomeSource`, `ExpenseCategory`, `Transaction`,
  `INCOME_SOURCES: IncomeSource[]`, `EXPENSE_CATEGORIES: ExpenseCategory[]`.

- [ ] **Step 1:** Agregar al final de `lib/types.ts`:
      ```ts
      export type TransactionType = "Ingreso" | "Egreso";

      export type IncomeSource = "Venta" | "Aporte de Socio" | "Reintegro";

      export type ExpenseCategory =
        | "Compra a Proveedor"
        | "Suscripciones y Software"
        | "Gastos Operativos"
        | "Educación"
        | "Otros";

      export type Transaction = {
        id: string;
        date: string; // ISO yyyy-mm-dd
        type: TransactionType;
        description: string;
        amount: number; // siempre positivo; el signo lo da `type`
        payer: string; // "Quién" — texto libre
        method: string; // "Método" — texto libre
        incomeSource: IncomeSource | null; // solo si type === "Ingreso"
        expenseCategory: ExpenseCategory | null; // solo si type === "Egreso"
        createdAt: number;
        updatedAt: number;
      };

      export const INCOME_SOURCES: IncomeSource[] = [
        "Venta",
        "Aporte de Socio",
        "Reintegro",
      ];

      export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
        "Compra a Proveedor",
        "Suscripciones y Software",
        "Gastos Operativos",
        "Educación",
        "Otros",
      ];
      ```
- [ ] **Step 2:** Verificar: `npm run build` pasa.
- [ ] **Step 3:** Commit:
      ```bash
      git add lib/types.ts
      git commit -m "feat: add Transaction types for Finanzas module"
      ```

---

## Task 2: `lib/financeCategory.ts` — inferencia para el import

**Files:**
- Create: `lib/financeCategory.ts`
- Test: `lib/__tests__/financeCategory.test.ts`

**Interfaces:**
- Produces: `inferIncomeSource(description: string): IncomeSource`,
  `inferExpenseCategory(description: string): ExpenseCategory` — funciones puras, sin
  dependencias de Firebase/React. Las usa `scripts/import-transactions.ts` (Task 8).

- [ ] **Step 1:** Crear el test que falla, `lib/__tests__/financeCategory.test.ts`:
      ```ts
      import { describe, expect, test } from "vitest";
      import { inferExpenseCategory, inferIncomeSource } from "../financeCategory";

      describe("inferIncomeSource", () => {
        test("menciona Rafa → Aporte de Socio", () => {
          expect(inferIncomeSource("Zelle Rafa")).toBe("Aporte de Socio");
        });
        test("menciona Reintegro → Reintegro", () => {
          expect(inferIncomeSource("Reintegro Frontier Botella Rota")).toBe(
            "Reintegro",
          );
        });
        test("sin pista clara → Venta", () => {
          expect(inferIncomeSource("Ventas Amazon")).toBe("Venta");
        });
      });

      describe("inferExpenseCategory", () => {
        test("menciona curso → Educación", () => {
          expect(inferExpenseCategory("Pago del curso Mundo Amazon Cuota 1")).toBe(
            "Educación",
          );
        });
        test("menciona Frontier → Compra a Proveedor", () => {
          expect(inferExpenseCategory("Primera Compra Frontier Co-op")).toBe(
            "Compra a Proveedor",
          );
        });
        test("menciona Keepa → Suscripciones y Software", () => {
          expect(inferExpenseCategory("Pago de Keepa")).toBe(
            "Suscripciones y Software",
          );
        });
        test("menciona Dominio → Gastos Operativos", () => {
          expect(inferExpenseCategory("Pago de Dominio ranicgroup.com")).toBe(
            "Gastos Operativos",
          );
        });
        test("sin pista clara → Otros", () => {
          expect(inferExpenseCategory("Pago varios")).toBe("Otros");
        });
      });
      ```
- [ ] **Step 2:** Run: `npm test -- financeCategory` — debe fallar (el módulo no existe).
- [ ] **Step 3:** Crear `lib/financeCategory.ts`:
      ```ts
      import type { ExpenseCategory, IncomeSource } from "./types";

      /**
       * Infiere el origen de un Ingreso a partir de la descripción — mejor esfuerzo para el
       * import histórico (spec §5). Sin pista clara: Venta (default, la mayoría de los
       * ingresos futuros van a ser ventas).
       */
      export function inferIncomeSource(description: string): IncomeSource {
        const text = description.toLowerCase();
        if (text.includes("rafa")) return "Aporte de Socio";
        if (text.includes("reintegro")) return "Reintegro";
        return "Venta";
      }

      const EXPENSE_RULES: { keywords: string[]; category: ExpenseCategory }[] = [
        { keywords: ["curso"], category: "Educación" },
        {
          keywords: ["frontier", "compra", "proveedor"],
          category: "Compra a Proveedor",
        },
        {
          keywords: [
            "keepa",
            "smartscout",
            "price checker",
            "revseller",
            "amazon seller",
            "google",
            "claude",
          ],
          category: "Suscripciones y Software",
        },
        {
          keywords: ["dominio", "llc", "esim", "impresora", "papel"],
          category: "Gastos Operativos",
        },
      ];

      /**
       * Infiere la categoría de un Egreso a partir de la descripción — mejor esfuerzo para el
       * import histórico (spec §5). Sin coincidencia clara: Otros.
       */
      export function inferExpenseCategory(description: string): ExpenseCategory {
        const text = description.toLowerCase();
        for (const rule of EXPENSE_RULES) {
          if (rule.keywords.some((kw) => text.includes(kw))) return rule.category;
        }
        return "Otros";
      }
      ```
- [ ] **Step 4:** Run: `npm test -- financeCategory` — todos los tests deben pasar.
- [ ] **Step 5:** Commit:
      ```bash
      git add lib/financeCategory.ts lib/__tests__/financeCategory.test.ts
      git commit -m "feat: add income/expense category inference for transaction import"
      ```

---

## Task 3: `lib/transactions.ts` — acceso a datos

**Files:**
- Create: `lib/transactions.ts`

**Interfaces:**
- Consumes: `Transaction` (Task 1).
- Produces: `subscribeTransactions(cb)`, `addTransaction(data)`, `updateTransaction(id, patch)`,
  `deleteTransaction(id)`, `type TransactionInput = Omit<Transaction, "id"|"createdAt"|"updatedAt">`.

- [ ] **Step 1:** Crear `lib/transactions.ts`:
      ```ts
      import {
        addDoc,
        collection,
        deleteDoc,
        doc,
        onSnapshot,
        updateDoc,
      } from "firebase/firestore";
      import { db } from "./firebase";
      import type { Transaction } from "./types";

      const COL = "transactions";

      /** Datos de un movimiento sin los campos que el sistema gestiona (id/timestamps). */
      export type TransactionInput = Omit<
        Transaction,
        "id" | "createdAt" | "updatedAt"
      >;

      /** Suscripción en tiempo real a la colección transactions. Devuelve la función de unsubscribe. */
      export function subscribeTransactions(cb: (transactions: Transaction[]) => void) {
        return onSnapshot(collection(db, COL), (snap) => {
          cb(
            snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<Transaction, "id">),
            })),
          );
        });
      }

      export function addTransaction(data: TransactionInput) {
        const now = Date.now();
        return addDoc(collection(db, COL), {
          ...data,
          createdAt: now,
          updatedAt: now,
        });
      }

      export function updateTransaction(id: string, patch: Partial<Transaction>) {
        return updateDoc(doc(db, COL, id), { ...patch, updatedAt: Date.now() });
      }

      export function deleteTransaction(id: string) {
        return deleteDoc(doc(db, COL, id));
      }
      ```
- [ ] **Step 2:** Verificar: `npm run build` pasa.
- [ ] **Step 3:** Commit:
      ```bash
      git add lib/transactions.ts
      git commit -m "feat: add transactions data access layer"
      ```

---

## Task 4: `TransactionForm`

**Files:**
- Create: `components/TransactionForm.tsx`

**Interfaces:**
- Consumes: `Modal` (existente), `INCOME_SOURCES`, `EXPENSE_CATEGORIES`, `Transaction`,
  `TransactionType`, `IncomeSource`, `ExpenseCategory` (Task 1).
- Produces: `export type TransactionFormValues = { date: string; type: TransactionType;
  description: string; amount: number; payer: string; method: string;
  incomeSource: IncomeSource | null; expenseCategory: ExpenseCategory | null }`,
  `export function TransactionForm(props): JSX.Element`. Usado por
  `app/admin/(crm)/finanzas/page.tsx` (Task 6).

- [ ] **Step 1:** Crear `components/TransactionForm.tsx`:
      ```tsx
      "use client";

      import { useEffect, useState } from "react";
      import {
        EXPENSE_CATEGORIES,
        INCOME_SOURCES,
        type ExpenseCategory,
        type IncomeSource,
        type Transaction,
        type TransactionType,
      } from "@/lib/types";
      import { todayISO } from "@/lib/format";
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

      const inputCls =
        "w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-olive";
      const labelCls =
        "mb-1 block font-eyebrow text-[11px] uppercase tracking-[0.15em] text-ink-soft";

      function emptyValues(): TransactionFormValues {
        return {
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

      export function TransactionForm({
        open,
        onClose,
        initial,
        onSave,
      }: {
        open: boolean;
        onClose: () => void;
        initial?: Transaction;
        onSave: (values: TransactionFormValues) => Promise<void> | void;
      }) {
        const [values, setValues] = useState<TransactionFormValues>(emptyValues);
        const [error, setError] = useState<string | null>(null);
        const [saving, setSaving] = useState(false);

        useEffect(() => {
          if (!open) return;
          setError(null);
          setValues(
            initial
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
              : emptyValues(),
          );
        }, [open, initial]);

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
          <Modal
            open={open}
            onClose={onClose}
            title={initial ? "Editar movimiento" : "Nuevo movimiento"}
          >
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
                  <input
                    id="payer"
                    className={inputCls}
                    value={values.payer}
                    onChange={(e) => set("payer", e.target.value)}
                    placeholder="Nico, Rafa, Ranic Group LLC…"
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="method">
                    Método
                  </label>
                  <input
                    id="method"
                    className={inputCls}
                    value={values.method}
                    onChange={(e) => set("method", e.target.value)}
                    placeholder="Credit Card, Transferencia…"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-status-overdue">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
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
            </form>
          </Modal>
        );
      }
      ```
- [ ] **Step 2:** Verificar: `npm run build` pasa (el componente todavía no se usa en ninguna
      página — eso es la Task 6 — así que solo debe compilar sin errores de tipos).
- [ ] **Step 3:** Commit:
      ```bash
      git add components/TransactionForm.tsx
      git commit -m "feat: add TransactionForm"
      ```

---

## Task 5: `TransactionTable`

**Files:**
- Create: `components/TransactionTable.tsx`

**Interfaces:**
- Consumes: `Transaction`, `formatDate` (`lib/format.ts`).
- Produces: `export function TransactionTable({ transactions, onRowClick }): JSX.Element`.

- [ ] **Step 1:** Crear `components/TransactionTable.tsx`:
      ```tsx
      "use client";

      import { formatDate } from "@/lib/format";
      import type { Transaction } from "@/lib/types";

      function categoryLabel(t: Transaction): string {
        return t.type === "Ingreso"
          ? t.incomeSource ?? "—"
          : t.expenseCategory ?? "—";
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
      ```
- [ ] **Step 2:** Verificar: `npm run build` pasa.
- [ ] **Step 3:** Commit:
      ```bash
      git add components/TransactionTable.tsx
      git commit -m "feat: add TransactionTable"
      ```

---

## Task 6: Página `/admin/finanzas`

**Files:**
- Create: `app/admin/(crm)/finanzas/page.tsx`

**Interfaces:**
- Consumes: `subscribeTransactions`, `addTransaction`, `updateTransaction`, `deleteTransaction`
  (Task 3); `TransactionForm`, `TransactionFormValues` (Task 4); `TransactionTable` (Task 5);
  `EXPENSE_CATEGORIES` (Task 1); `MetricCard`, `PageHeader`, `Modal` (existentes).

- [ ] **Step 1:** Crear `app/admin/(crm)/finanzas/page.tsx`:
      ```tsx
      "use client";

      import { useEffect, useMemo, useState } from "react";
      import { MetricCard } from "@/components/MetricCard";
      import { PageHeader } from "@/components/PageHeader";
      import {
        TransactionForm,
        type TransactionFormValues,
      } from "@/components/TransactionForm";
      import { TransactionTable } from "@/components/TransactionTable";
      import {
        addTransaction,
        deleteTransaction,
        subscribeTransactions,
        updateTransaction,
      } from "@/lib/transactions";
      import { EXPENSE_CATEGORIES, type Transaction } from "@/lib/types";

      export default function FinanzasPage() {
        const [transactions, setTransactions] = useState<Transaction[]>([]);
        const [loaded, setLoaded] = useState(false);
        const [formOpen, setFormOpen] = useState(false);
        const [editId, setEditId] = useState<string | null>(null);

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

        const sorted = useMemo(
          () => [...transactions].sort((a, b) => b.date.localeCompare(a.date)),
          [transactions],
        );

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
                <button
                  type="button"
                  onClick={openNew}
                  className="rounded-control bg-olive px-3 py-2 text-sm font-medium text-stone transition-colors hover:bg-olive-deep"
                >
                  Nuevo movimiento
                </button>
              }
            />

            <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MetricCard
                label="Ingresos"
                value={`$${metrics.ingresos.toFixed(2)}`}
              />
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

            <section className="mt-8">
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
            </section>

            <section className="mt-8">
              <h2 className="mb-3 font-eyebrow text-[11px] uppercase tracking-[0.2em] text-ink-soft">
                Movimientos
              </h2>
              {!loaded ? (
                <p className="font-mono text-sm text-ink-soft">Cargando…</p>
              ) : (
                <TransactionTable transactions={sorted} onRowClick={handleRowClick} />
              )}
            </section>

            <TransactionForm
              open={formOpen}
              onClose={closeForm}
              initial={editingTransaction}
              onSave={handleSave}
            />

            {editId && editingTransaction && (
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={async () => {
                    await deleteTransaction(editId);
                    closeForm();
                  }}
                  className="text-xs text-status-overdue hover:underline"
                >
                  Eliminar este movimiento
                </button>
              </div>
            )}
          </>
        );
      }
      ```
- [ ] **Step 2:** Verificar: `npm run dev`, abrir `/admin/finanzas` directamente en la URL
      (todavía sin link en el nav — eso es la Task 7) y confirmar que carga, las métricas
      muestran $0.00 (no hay datos todavía), y "Nuevo movimiento" abre el form y guarda
      correctamente (probarlo con un movimiento de prueba, después borrarlo). `npm run build`
      pasa.
- [ ] **Step 3:** Commit:
      ```bash
      git add "app/admin/(crm)/finanzas/page.tsx"
      git commit -m "feat: add Finanzas page with metrics and transaction table"
      ```

---

## Task 7: Nav — agregar "Finanzas"

**Files:**
- Modify: `components/Nav.tsx`

**Interfaces:**
- No cambia ninguna firma — solo agrega un ítem al array `NAV` y un ícono nuevo.

- [ ] **Step 1:** Agregar un ícono `finanzas` al objeto `icons` (después de `expo`, línea 50):
      ```tsx
      finanzas: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
      ```
- [ ] **Step 2:** Agregar el ítem al array `NAV` (después de `expo-west`, línea 59):
      ```tsx
      { href: "/admin/finanzas", label: "Finanzas", icon: icons.finanzas },
      ```
- [ ] **Step 3:** En el `<nav>` de bottom-nav mobile (línea 140), cambiar `grid-cols-6` por
      `grid-cols-7` para que entre el ítem nuevo:
      ```tsx
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-7 border-t border-line bg-olive-deep text-olive-tint md:hidden">
      ```
- [ ] **Step 4:** Verificar: `npm run dev`, confirmar que "Finanzas" aparece en el sidebar
      (desktop) y en el bottom nav (mobile, achicar la ventana), y que el link navega a
      `/admin/finanzas`. `npm run build` pasa.
- [ ] **Step 5:** Commit:
      ```bash
      git add components/Nav.tsx
      git commit -m "feat: add Finanzas item to CRM nav"
      ```

---

## Task 8: Script de importación histórica

**Files:**
- Modify: `package.json` (agregar el script `import-transactions`)
- Create: `scripts/import-transactions.ts`

**Interfaces:**
- Consumes: `inferIncomeSource`, `inferExpenseCategory` (Task 2); `Transaction`,
  `TransactionType` (Task 1).
- Produces: comando `npm run import-transactions [-- --dry-run]`.

- [ ] **Step 1:** Agregar a `package.json`, junto a `import-providers`:
      ```json
      "import-transactions": "tsx scripts/import-transactions.ts"
      ```
- [ ] **Step 2:** Crear `scripts/import-transactions.ts`:
      ```ts
      /**
       * Import histórico de movimientos financieros desde el CSV de la planilla de Nico a la
       * colección `transactions`. Ver spec
       * docs/superpowers/specs/2026-06-29-crm-finanzas-design.md.
       *
       * El CSV tiene, además de las 9 columnas con datos reales (Fecha..Año), una caja de
       * resumen suelta en columnas a la derecha (Ingresos/Egresos/Balance ya calculados de la
       * propia planilla) — se ignora completamente parseando por posición de columna en vez de
       * por nombre de header, así no hay colisión con esas celdas sueltas.
       *
       * Uso:
       *   npm run import-transactions -- --dry-run   (solo parsea y reporta, no escribe)
       *   npm run import-transactions                (escribe; necesita SEED_USER_PASSWORD)
       */
      import { readFileSync } from "node:fs";
      import "./env";
      import { parse } from "csv-parse/sync";
      import { signInWithEmailAndPassword } from "firebase/auth";
      import {
        collection,
        doc,
        getCountFromServer,
        writeBatch,
      } from "firebase/firestore";
      import { auth, db } from "../lib/firebase";
      import { inferExpenseCategory, inferIncomeSource } from "../lib/financeCategory";
      import type { Transaction, TransactionType } from "../lib/types";

      const CSV_PATH =
        "C:/Nico-Archivos/ClaudeCode/Ranic-Group/Finanzas_Ranic_Group_LLC.csv";

      type ParsedTransaction = Omit<Transaction, "id" | "createdAt" | "updatedAt">;

      /** "12/01/26" → "2026-01-12". null si no matchea el formato esperado. */
      function parseSpanishDate(value: string): string | null {
        const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
        if (!m) return null;
        const [, d, mo, y] = m;
        return `20${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }

      /** "$1,749.00" → 1749. NaN si no se puede parsear (la fila se descarta). */
      function parseAmount(value: string): number {
        return Number(value.trim().replace(/[$,]/g, ""));
      }

      function parseRows(): ParsedTransaction[] {
        const csv = readFileSync(CSV_PATH, "utf8");
        // skip_empty_lines + parseo por posición (sin columns:true) para no chocar con las
        // columnas vacías/duplicadas de la caja de resumen suelta del CSV.
        const rows: string[][] = parse(csv, { skip_empty_lines: true });

        const out: ParsedTransaction[] = [];
        for (const row of rows.slice(1)) {
          const [
            fecha,
            tipoRaw,
            descripcion,
            montoRaw,
            payer,
            method,
          ] = row;

          const date = parseSpanishDate(fecha ?? "");
          const amount = parseAmount(montoRaw ?? "");
          const description = (descripcion ?? "").trim();
          const type: TransactionType =
            tipoRaw?.trim() === "Ingreso" ? "Ingreso" : "Egreso";

          if (!date || !description || !Number.isFinite(amount) || amount <= 0) {
            continue; // fila incompleta o de la caja de resumen, se descarta
          }

          out.push({
            date,
            type,
            description,
            amount,
            payer: (payer ?? "").trim(),
            method: (method ?? "").trim(),
            incomeSource: type === "Ingreso" ? inferIncomeSource(description) : null,
            expenseCategory:
              type === "Egreso" ? inferExpenseCategory(description) : null,
          });
        }
        return out;
      }

      async function main() {
        const dryRun = process.argv.includes("--dry-run");
        const transactions = parseRows();

        console.log(`\nMovimientos a importar: ${transactions.length}`);
        const ingresos = transactions
          .filter((t) => t.type === "Ingreso")
          .reduce((s, t) => s + t.amount, 0);
        const egresos = transactions
          .filter((t) => t.type === "Egreso")
          .reduce((s, t) => s + t.amount, 0);
        console.log(`  Ingresos: $${ingresos.toFixed(2)}`);
        console.log(`  Egresos:  $${egresos.toFixed(2)}`);
        console.log(`  Balance:  $${(ingresos - egresos).toFixed(2)}`);

        if (dryRun) {
          console.log("\n(--dry-run) No se escribió nada en Firestore.");
          process.exit(0);
        }

        const password = process.env.SEED_USER_PASSWORD;
        if (!password) {
          console.error(
            "\n✗ Falta SEED_USER_PASSWORD en .env.local (o usá --dry-run para solo contar).\n",
          );
          process.exit(1);
        }
        const email = process.env.SEED_USER_EMAIL ?? "nicolas.conti@ranicgroup.com";
        await signInWithEmailAndPassword(auth, email, password);

        const now = Date.now();
        const CHUNK = 50;
        for (let i = 0; i < transactions.length; i += CHUNK) {
          const batch = writeBatch(db);
          for (const t of transactions.slice(i, i + CHUNK)) {
            batch.set(doc(collection(db, "transactions")), {
              ...t,
              createdAt: now,
              updatedAt: now,
            });
          }
          await batch.commit();
        }

        const total = (
          await getCountFromServer(collection(db, "transactions"))
        ).data().count;
        console.log(`\n✓ Import completo. transactions en Firestore: ${total}`);
        process.exit(0);
      }

      main().catch((err) => {
        console.error("✗ Error en el import:", err?.code ?? err);
        process.exit(1);
      });
      ```
- [ ] **Step 3:** Verificar con dry-run: `npm run import-transactions -- --dry-run`. Esperado:
      "Movimientos a importar: 43", con Ingresos/Egresos/Balance impresos — no van a coincidir
      con la caja de resumen vieja de la planilla (esa era una foto parcial de mediados de
      febrero, ver spec §5), así que no se compara contra un número fijo, solo se confirma que
      el conteo de filas es 43 y que no tira error.
- [ ] **Step 4:** Correr el import real: `npm run import-transactions`.
- [ ] **Step 5:** Verificar en el CRM (`npm run dev`, `/admin/finanzas`): los 43 movimientos
      aparecen en la tabla, las métricas calculan Ingresos/Egresos/Balance/Balance Operativo, y
      "Egresos por categoría" muestra montos en más de una categoría (no todo en "Otros" — si
      todo cae en "Otros", revisar las reglas de `inferExpenseCategory` antes de seguir).
- [ ] **Step 6:** Commit:
      ```bash
      git add package.json scripts/import-transactions.ts
      git commit -m "feat: add historical transaction import script"
      ```

---

## Task 9: Verificación final y PR

- [ ] **Step 1:** `npm run build` y `npm test` — ambos pasan sin errores.
- [ ] **Step 2:** `npm run dev`, revisar manualmente:
      - `/admin/finanzas`: las 4 tarjetas de métricas, la tabla de egresos por categoría, y la
        tabla de movimientos completa.
      - Crear, editar y borrar un movimiento de prueba — las métricas se actualizan en tiempo
        real.
      - Confirmar que un Ingreso con origen "Aporte de Socio" (ej. uno de los de Rafa) **no**
        suma al Balance Operativo pero sí al Balance normal.
      - El resto del CRM (`/admin/dashboard`, `/admin/proveedores`, etc.) sigue funcionando
        igual.
- [ ] **Step 3:** Push del branch y PR a `main`:
      ```bash
      git push -u origin crm-finanzas
      gh pr create --title "CRM: módulo de Finanzas (flujo de caja)" --body "Ver docs/superpowers/specs/2026-06-29-crm-finanzas-design.md y el plan correspondiente."
      ```
- [ ] **Step 4:** Esperar a que el preview de Vercel pase el build, avisar para revisión — no
      mergear sin aprobación explícita.

---

## Self-Review (cobertura del spec)

- Hallazgo de aportes de socio vs. ventas → modelo `incomeSource`, Balance Operativo en Task 6.
  ✅
- Modelo de datos (`Transaction`, colección `transactions`) → Task 1, 3. ✅
- Página `/admin/finanzas` con métricas, egresos por categoría y tabla de movimientos → Task 6.
  ✅
- Import de los 43 movimientos con inferencia de categoría → Task 2, 8. ✅
- Un solo ítem nuevo en el nav → Task 7. ✅
- `payer`/`method` en texto libre → Tasks 4, 5 (inputs de texto, no selects). ✅
- No se toca el sitio público ni se construye la parte de rentabilidad por producto → Global
  Constraints, ningún task la incluye. ✅
