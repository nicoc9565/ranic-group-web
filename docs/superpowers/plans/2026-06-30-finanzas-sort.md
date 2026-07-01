# Finanzas — Ordenar movimientos por columna — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Headers clickeables en la tabla de Movimientos de Finanzas, con indicador de columna/dirección activa.

**Architecture:** Estado de orden movido de la página al componente `TransactionTable`; sin cambios al modelo de datos.

**Tech Stack:** Next.js, TypeScript, Tailwind CSS v4.

## Global Constraints

- Idioma UI: español.
- Tokens: `ink`, `ink-soft`, `line`, `surface`, `olive-tint`.
- No persistir preferencia de orden (vuelve a Fecha desc al recargar).

---

### Task 1: Ordenar por columna en TransactionTable

**Files:**
- Modify: `components/TransactionTable.tsx`
- Modify: `app/admin/(crm)/finanzas/page.tsx`

**Interfaces:**
- Consumes: `Transaction` de `lib/types.ts` (sin cambios)
- Produces: `<TransactionTable transactions={Transaction[]} onRowClick={...} />` ahora ordena internamente — el caller le pasa la lista **sin ordenar**

- [ ] **Step 1: Reescribir components/TransactionTable.tsx con estado de orden**

```tsx
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
```

- [ ] **Step 2: Dejar de pre-ordenar en app/admin/(crm)/finanzas/page.tsx**

Eliminar el bloque `sorted` (ya no hace falta — el componente ordena internamente):

```ts
  const sorted = useMemo(
    () => [...transactions].sort((a, b) => b.date.localeCompare(a.date)),
    [transactions],
  );
```

Y cambiar el uso en el JSX, de:

```tsx
          <TransactionTable transactions={sorted} onRowClick={handleRowClick} />
```

A:

```tsx
          <TransactionTable transactions={transactions} onRowClick={handleRowClick} />
```

- [ ] **Step 3: Verificar que compila**

```bash
npx tsc --noEmit
```

Expected: sin errores. Confirmar que no quedó ningún uso colgante de la variable `sorted` eliminada.

- [ ] **Step 4: Build de producción**

```bash
npm run build
```

Expected: build verde.

- [ ] **Step 5: Verificar en preview**

`npm run dev` → `http://localhost:3000/admin/finanzas`.

Checklist manual:
- [ ] Al cargar la página, el orden por defecto es Fecha descendente (igual que antes)
- [ ] Click en "Fecha" invierte a ascendente, con flecha ▲; click de nuevo vuelve a ▼
- [ ] Click en "Monto" ordena de mayor a menor por defecto
- [ ] Click en "Tipo", "Descripción", "Categoría" o "Quién" ordena A→Z por defecto
- [ ] Solo una columna muestra la flecha a la vez

- [ ] **Step 6: Commit**

```bash
git add components/TransactionTable.tsx "app/admin/(crm)/finanzas/page.tsx"
git commit -m "feat: add sortable columns to transactions table"
```

- [ ] **Step 7: Abrir PR**

```bash
gh pr create --title "feat: sortable columns in Finanzas movements table" --body "$(cat <<'EOF'
## Summary
- Headers clickeables en la tabla de Movimientos de Finanzas (Fecha, Tipo, Descripción, Categoría, Quién, Monto)
- Click ordena por esa columna; click de nuevo invierte la dirección; flecha indica columna/dirección activa
- Orden por defecto sin cambios: Fecha descendente

## Test plan
- [ ] Orden por defecto: Fecha desc
- [ ] Click en cada columna ordena correctamente en ambas direcciones
- [ ] Solo una flecha visible a la vez

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
