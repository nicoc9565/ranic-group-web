# Finanzas — Ingresos por categoría — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar el cuadro "Ingresos por categoría" (Venta / Aporte de Socio / Reintegro) al lado de "Egresos por categoría" en `/admin/finanzas`.

**Architecture:** Mismo patrón de cálculo (`Map` con totales) ya usado para `byCategory`, en un `useMemo` nuevo. Layout de 2 columnas con CSS grid.

**Tech Stack:** Next.js, TypeScript, Tailwind CSS v4.

## Global Constraints

- Idioma UI: español.
- No tocar el modelo de datos (`IncomeSource`, `INCOME_SOURCES` ya existen en `lib/types.ts`).
- No tocar `TransactionForm.tsx` ni `TransactionTable.tsx`.

---

### Task 1: Cuadro "Ingresos por categoría"

**Files:**
- Modify: `app/admin/(crm)/finanzas/page.tsx`

**Interfaces:**
- Consumes: `INCOME_SOURCES` de `lib/types.ts` (agregar al import existente que ya trae `EXPENSE_CATEGORIES`)

**Contexto:** el archivo ya tiene este bloque (ver `app/admin/(crm)/finanzas/page.tsx`):

```tsx
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
```

Y este JSX:

```tsx
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
```

- [ ] **Step 1: Agregar el import de INCOME_SOURCES**

Cambiar:

```ts
import { EXPENSE_CATEGORIES, type Transaction } from "@/lib/types";
```

Por:

```ts
import { EXPENSE_CATEGORIES, INCOME_SOURCES, type Transaction } from "@/lib/types";
```

- [ ] **Step 2: Agregar el cálculo byIncomeSource**

Justo después del `useMemo` de `byCategory`, agregar:

```ts
  const byIncomeSource = useMemo(() => {
    const totals = new Map<string, number>();
    for (const src of INCOME_SOURCES) totals.set(src, 0);
    for (const t of transactions) {
      if (t.type === "Ingreso" && t.incomeSource) {
        totals.set(
          t.incomeSource,
          (totals.get(t.incomeSource) ?? 0) + t.amount,
        );
      }
    }
    return [...totals.entries()];
  }, [transactions]);
```

- [ ] **Step 3: Reemplazar la sección por el layout de 2 columnas**

Reemplazar el bloque `<section className="mt-8"> ... Egresos por categoría ... </section>` completo (mostrado arriba en el contexto) por:

```tsx
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
```

- [ ] **Step 4: Verificar que compila**

```bash
npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 5: Build de producción**

```bash
npm run build
```

Expected: build verde.

- [ ] **Step 6: Verificar en preview**

`npm run dev` → `http://localhost:3000/admin/finanzas`.

Checklist manual:
- [ ] "Egresos por categoría" e "Ingresos por categoría" aparecen lado a lado en desktop
- [ ] En mobile (ventana angosta), se apilan uno debajo del otro
- [ ] "Ingresos por categoría" muestra Venta, Aporte de Socio y Reintegro con sus totales correctos
- [ ] Los totales de Venta + Reintegro + Aporte de Socio suman el mismo total que la tarjeta "Ingresos" de arriba

- [ ] **Step 7: Commit**

```bash
git add "app/admin/(crm)/finanzas/page.tsx"
git commit -m "feat: add income-by-source breakdown next to expenses-by-category"
```

- [ ] **Step 8: Abrir PR**

```bash
gh pr create --title "feat: Ingresos por categoría breakdown in Finanzas" --body "$(cat <<'EOF'
## Summary
- Nuevo cuadro "Ingresos por categoría" (Venta / Aporte de Socio / Reintegro), mismo formato que "Egresos por categoría"
- Los dos cuadros quedan lado a lado en desktop, apilados en mobile

## Test plan
- [ ] Layout de 2 columnas en desktop, apilado en mobile
- [ ] Totales de Ingresos por categoría suman igual que la tarjeta "Ingresos"

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
