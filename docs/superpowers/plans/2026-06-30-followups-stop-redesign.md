# Follow-ups — Detener seguimiento + rediseño de fila — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un flag `followUpStopped` que saca un proveedor de Follow-ups/Dashboard sin borrar su historial, y rediseñar la fila de Follow-ups en dos bloques (info + barra de acciones) para que quepa un tercer botón sin romper el layout.

**Architecture:** Cambio de modelo (`Provider.followUpStopped`) + lógica pura (`lib/followup.ts`) + UI (fila de Follow-ups rediseñada, badge/botón en ProviderDetail). TDD para la lógica pura, verificación manual para la UI.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS v4, Firebase Firestore, Vitest.

## Global Constraints

- Idioma UI: **español**.
- Tokens: `olive`, `olive-deep`, `stone`, `ink`, `ink-soft`, `status-overdue`, `line`, `surface`.
- `rounded-card` para cards, `rounded-control` para inputs/botones.
- Iconos: SVG inline, `viewBox="0 0 24 24"`, `stroke="currentColor"`, `strokeWidth="1.8"`, `fill="none"`, siguiendo el estilo de `components/Nav.tsx`.
- No editar fechas manualmente — "Marcar como enviado" sigue usando la fecha de hoy.
- No tocar `lib/emails.ts`, `lib/emailsEs.ts`, Finanzas, Tareas del Dashboard.
- Commits en inglés, estilo `feat:`/`test:`.

---

### Task 1: Campo `followUpStopped` + lógica en lib/followup.ts (TDD)

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/followup.ts`
- Test: `lib/__tests__/followup.test.ts`

**Interfaces:**
- Consumes: nada nuevo
- Produces: `Provider.followUpStopped?: boolean`; `nextFollowUpDate(p)` devuelve `null` si `p.followUpStopped` es `true`

- [ ] **Step 1: Agregar el campo al tipo Provider**

En `lib/types.ts`, dentro de `export type Provider = { ... }`, agregar después de `followUpStep: number;`:

```ts
  /** true = se detuvo manualmente el seguimiento; no aparece en Follow-ups aunque haya secuencia activa. */
  followUpStopped?: boolean;
```

- [ ] **Step 2: Escribir el test que falla**

En `lib/__tests__/followup.test.ts`, agregar este test dentro del bloque `describe("nextFollowUpDate", ...)`, después del test `"contactMethod Email → calcula normalmente"`:

```ts
  test("followUpStopped → null aunque haya secuencia activa", () => {
    expect(
      nextFollowUpDate({ ...base, followUpStopped: true } as Provider),
    ).toBeNull();
  });
```

- [ ] **Step 3: Correr el test y verificar que falla**

```bash
npx vitest run lib/__tests__/followup.test.ts
```

Expected: el nuevo test FALLA (`nextFollowUpDate` todavía devuelve una fecha, no `null`).

- [ ] **Step 4: Implementar el chequeo en lib/followup.ts**

En `lib/followup.ts`, dentro de `nextFollowUpDate`, agregar la condición como primera línea del cuerpo de la función (antes del chequeo de `contactMethod`):

```ts
export function nextFollowUpDate(p: Provider): Date | null {
  if (p.followUpStopped) return null;
  // El Follow-up Track asume una secuencia de emails que Nico controla. Si el contacto fue
  // por Web o Llamada, no hay secuencia corriendo → no se calcula follow-up (spec §4).
  if (p.contactMethod !== "Email") return null;
  if (!p.firstContactDate) return null;
  const days = FOLLOWUP_DAYS[p.followUpStep + 1];
  if (days === undefined) return null;
  const d = new Date(`${p.firstContactDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

```bash
npx vitest run lib/__tests__/followup.test.ts
```

Expected: todos los tests del archivo PASAN (incluyendo el nuevo).

- [ ] **Step 6: Correr toda la suite para confirmar que no se rompió nada**

```bash
npx vitest run
```

Expected: todos los tests pasan (39 anteriores + 1 nuevo = 40).

- [ ] **Step 7: Commit**

```bash
git add lib/types.ts lib/followup.ts lib/__tests__/followup.test.ts
git commit -m "feat: add followUpStopped flag to stop follow-up sequence"
```

---

### Task 2: Rediseño de fila + botón "Detener seguimiento" en Follow-ups

**Files:**
- Modify: `app/admin/(crm)/follow-ups/page.tsx`

**Interfaces:**
- Consumes: `updateProvider` de `lib/providers.ts` (ya importado en el archivo); `Provider.followUpStopped` de Task 1
- Produces: nada que otras tasks consuman — es la capa de UI final de este flujo

**Contexto:** el archivo actual ya tiene este JSX por fila (ver `app/admin/(crm)/follow-ups/page.tsx`):

```tsx
              <div
                key={p.id}
                className={`flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-surface px-4 py-3 ${
                  status === "overdue" ? "border-l-2 border-l-status-overdue" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {p.company}
                  </p>
                  <p className="truncate font-mono text-xs text-ink-soft">
                    {p.contact}
                  </p>
                </div>

                <div className="hidden shrink-0 sm:block">
                  <FollowUpTrack followUpStep={p.followUpStep} status={status} />
                </div>

                <div className="shrink-0 text-right">
                  <p className={`text-xs font-semibold ${TEXT[status]}`}>
                    {LABEL[status]}
                  </p>
                  <p className="font-mono text-xs text-ink-soft">
                    Día {day} · {formatDate(next ? next.toISOString().slice(0, 10) : null)}
                  </p>
                </div>

                <Link
                  href={`/admin/emails?provider=${p.id}&type=${emailTypeForStep(p.followUpStep)}`}
                  className="shrink-0 rounded-control border border-olive px-3 py-2 text-sm font-medium text-olive transition-colors hover:bg-olive/10"
                >
                  Redactar email
                </Link>

                <button
                  type="button"
                  onClick={() => markSent(p)}
                  disabled={marking === p.id}
                  className="shrink-0 rounded-control bg-olive px-3 py-2 text-sm font-medium text-stone transition-colors hover:bg-olive-deep disabled:opacity-60"
                >
                  {marking === p.id ? "Guardando…" : "Marcar como enviado"}
                </button>
              </div>
```

(Nota: si el botón "Redactar email" todavía no existe en el archivo real porque PR #6 no llegó a este punto, agregalo igual con el `href` de arriba — `emailTypeForStep` y el import de `Link`/`EmailType` ya deberían estar en el archivo.)

- [ ] **Step 1: Agregar el ícono "stop" y el estado de loading para detener seguimiento**

Cerca del resto de los `const ... = { ... } as const;` al inicio del archivo (después de `TEXT`), agregar:

```ts
const StopIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M6.5 6.5l11 11" />
  </svg>
);
```

Dentro del componente `FollowUpsPage`, agregar un segundo estado junto a `marking`:

```ts
  const [stopping, setStopping] = useState<string | null>(null);
```

Y la función de acción, junto a `markSent`:

```ts
  async function stopFollowUp(p: Provider) {
    setStopping(p.id);
    try {
      await updateProvider(p.id, { followUpStopped: true });
    } finally {
      setStopping(null);
    }
  }
```

- [ ] **Step 2: Reemplazar el JSX de la fila por la versión de dos bloques**

Reemplazar todo el `<div key={p.id} ...> ... </div>` de la fila (el bloque pegado arriba) por:

```tsx
              <div
                key={p.id}
                className={`overflow-hidden rounded-card border border-line bg-surface ${
                  status === "overdue" ? "border-l-2 border-l-status-overdue" : ""
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {p.company}
                    </p>
                    <p className="truncate font-mono text-xs text-ink-soft">
                      {p.contact}
                    </p>
                  </div>

                  <div className="hidden shrink-0 sm:block">
                    <FollowUpTrack followUpStep={p.followUpStep} status={status} />
                  </div>

                  <div className="shrink-0 text-right">
                    <p className={`text-xs font-semibold ${TEXT[status]}`}>
                      {LABEL[status]}
                    </p>
                    <p className="font-mono text-xs text-ink-soft">
                      Día {day} · {formatDate(next ? next.toISOString().slice(0, 10) : null)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => stopFollowUp(p)}
                    disabled={stopping === p.id}
                    title="Detener seguimiento"
                    className="shrink-0 rounded-control p-1.5 text-ink-soft transition-colors hover:bg-status-overdue/10 hover:text-status-overdue disabled:opacity-50"
                  >
                    <span className="block h-4 w-4">
                      <StopIcon />
                    </span>
                  </button>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Link
                      href={`/admin/emails?provider=${p.id}&type=${emailTypeForStep(p.followUpStep)}`}
                      className="shrink-0 rounded-control border border-olive px-3 py-2 text-sm font-medium text-olive transition-colors hover:bg-olive/10"
                    >
                      Redactar email
                    </Link>

                    <button
                      type="button"
                      onClick={() => markSent(p)}
                      disabled={marking === p.id}
                      className="shrink-0 rounded-control bg-olive px-3 py-2 text-sm font-medium text-stone transition-colors hover:bg-olive-deep disabled:opacity-60"
                    >
                      {marking === p.id ? "Guardando…" : "Marcar como enviado"}
                    </button>
                  </div>
                </div>
              </div>
```

- [ ] **Step 3: Verificar que compila**

```bash
npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 4: Build de producción**

```bash
npm run build
```

Expected: build verde.

- [ ] **Step 5: Verificar en preview**

`npm run dev` → `http://localhost:3000/admin/follow-ups`.

Checklist manual:
- [ ] La fila se ve en dos bloques: info arriba, línea separadora, acciones abajo
- [ ] Al achicar la ventana del browser, los botones de acción no rompen el layout — siempre quedan en su propia franja
- [ ] El ícono de "Detener seguimiento" aparece a la izquierda de la barra de acciones, con tooltip al pasar el mouse
- [ ] Al hacer click en el ícono: el proveedor desaparece de la lista inmediatamente
- [ ] "Redactar email" y "Marcar como enviado" siguen funcionando igual que antes

- [ ] **Step 6: Commit**

```bash
git add "app/admin/(crm)/follow-ups/page.tsx"
git commit -m "feat: redesign follow-up row and add stop-tracking button"
```

---

### Task 3: Reanudar seguimiento desde ProviderDetail

**Files:**
- Modify: `components/ProviderDetail.tsx`

**Interfaces:**
- Consumes: `Provider.followUpStopped` de Task 1; necesita una función para reanudar — se agrega como nueva prop `onResumeFollowUp`
- Produces: prop `onResumeFollowUp: () => Promise<void> | void` que el caller (página de Proveedores) debe pasar

**Contexto:** `ProviderDetail` hoy recibe `onEdit`, `onAddNote`, `onDelete`, `onClose` como props desde quien lo renderiza (la página de Proveedores). Hay que sumar una prop más siguiendo el mismo patrón.

- [ ] **Step 1: Agregar la prop `onResumeFollowUp` a la firma del componente**

En `components/ProviderDetail.tsx`, modificar la firma de la función:

```tsx
export function ProviderDetail({
  provider,
  today,
  onClose,
  onEdit,
  onAddNote,
  onDelete,
  onResumeFollowUp,
}: {
  provider: Provider;
  today: Date;
  onClose: () => void;
  onEdit: () => void;
  onAddNote: (text: string) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onResumeFollowUp: () => Promise<void> | void;
}) {
```

- [ ] **Step 2: Agregar el badge y el botón dentro del bloque de Follow-up Track**

Reemplazar este bloque existente:

```tsx
        {/* Follow-up Track — solo para proveedores contactados por Email (spec §4) */}
        {provider.contactMethod === "Email" && (
          <div className="rounded-card border border-line bg-stone/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className={labelCls}>Secuencia de follow-up</p>
              <p className="font-mono text-xs text-ink-soft">
                {nextLabel(provider, today)}
              </p>
            </div>
            <FollowUpTrack
              followUpStep={provider.followUpStep}
              status={status}
              firstContactDate={provider.firstContactDate}
              showDates
            />
          </div>
        )}
```

Por:

```tsx
        {/* Follow-up Track — solo para proveedores contactados por Email (spec §4) */}
        {provider.contactMethod === "Email" && (
          <div className="rounded-card border border-line bg-stone/50 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className={labelCls}>Secuencia de follow-up</p>
                {provider.followUpStopped && (
                  <span className="rounded-full bg-ink-soft/15 px-2 py-0.5 text-xs text-ink-soft">
                    Seguimiento detenido
                  </span>
                )}
              </div>
              {provider.followUpStopped ? (
                <button
                  type="button"
                  onClick={() => onResumeFollowUp()}
                  className="text-xs font-medium text-olive hover:underline"
                >
                  Reanudar seguimiento
                </button>
              ) : (
                <p className="font-mono text-xs text-ink-soft">
                  {nextLabel(provider, today)}
                </p>
              )}
            </div>
            <FollowUpTrack
              followUpStep={provider.followUpStep}
              status={status}
              firstContactDate={provider.firstContactDate}
              showDates
            />
          </div>
        )}
```

- [ ] **Step 3: Actualizar el caller en la página de Proveedores**

Buscar dónde se renderiza `<ProviderDetail` en `app/admin/(crm)/proveedores/page.tsx` (props `onClose`, `onEdit`, `onAddNote`, `onDelete`) y agregar la prop nueva:

```tsx
          onResumeFollowUp={() =>
            updateProvider(selected.id, { followUpStopped: false })
          }
```

(`updateProvider` ya está importado en ese archivo porque se usa para `onEdit`/`onAddNote`. `selected` es la variable que ya usan los otros callbacks — usar el mismo nombre que usa el archivo real.)

- [ ] **Step 4: Verificar que compila**

```bash
npx tsc --noEmit
```

Expected: sin errores. Si `app/admin/(crm)/proveedores/page.tsx` usa otro nombre de variable para el proveedor seleccionado (no `selected`), ajustar el Step 3 a ese nombre real.

- [ ] **Step 5: Build de producción**

```bash
npm run build
```

Expected: build verde.

- [ ] **Step 6: Verificar en preview**

`npm run dev` → `http://localhost:3000/admin/follow-ups` → detener seguimiento de un proveedor → ir a `/admin/proveedores`, abrir el detalle de ese proveedor.

Checklist manual:
- [ ] Aparece el badge "Seguimiento detenido"
- [ ] Aparece el botón "Reanudar seguimiento" en vez de la fecha del próximo follow-up
- [ ] Al hacer click en "Reanudar seguimiento": el badge desaparece y vuelve a mostrarse la fecha del próximo follow-up
- [ ] El proveedor reaparece en `/admin/follow-ups` si corresponde según su fecha

- [ ] **Step 7: Commit**

```bash
git add components/ProviderDetail.tsx "app/admin/(crm)/proveedores/page.tsx"
git commit -m "feat: resume stopped follow-up from provider detail"
```

- [ ] **Step 8: Abrir PR**

```bash
gh pr create --title "feat: stop/resume follow-up tracking + row redesign" --body "$(cat <<'EOF'
## Summary
- `Provider.followUpStopped` (opcional) — al ser true, `nextFollowUpDate` devuelve null
- Fila de Follow-ups rediseñada en dos bloques (info + barra de acciones separada) para que quepan 3 acciones sin romper el layout en distintos anchos
- Botón ícono "Detener seguimiento" en la barra de acciones de cada fila
- ProviderDetail: badge "Seguimiento detenido" + botón "Reanudar seguimiento" cuando aplica

## Test plan
- [ ] npx vitest run → todos los tests pasan
- [ ] Detener seguimiento desde Follow-ups → el proveedor desaparece de la lista y del contador del Dashboard
- [ ] La fila no rompe el layout en mobile/desktop
- [ ] Reanudar desde ProviderDetail → vuelve a aparecer en Follow-ups si corresponde por fecha
- [ ] Redactar email / Marcar como enviado siguen funcionando igual

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
