# Iniciar seguimiento manual — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un botón "Iniciar seguimiento" en la ficha del proveedor que arranca el tracking de follow-up manualmente, y un flag `followUpForced` que permite trackear proveedores con Método de Contacto Llamada/Web cuando Nico lo pide explícitamente.

**Architecture:** Cambio de modelo (`Provider.followUpForced`) + lógica pura (`lib/followup.ts`, ya cubierta por tests existentes) + UI en `ProviderDetail` con una nueva prop callback.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS v4, Firebase Firestore, Vitest.

## Global Constraints

- Idioma UI: **español**.
- Tokens: `olive`, `stone`, `ink`, `ink-soft`, `line`, `surface`.
- No tocar `app/admin/(crm)/follow-ups/page.tsx` ni `app/admin/(crm)/emails/EmailsPageContent.tsx` — ya filtran correctamente vía `followUpStatus`/`nextFollowUpDate`, no necesitan cambios.
- No edición manual de fechas de envío.
- Commits en inglés, estilo `feat:`/`test:`.

---

### Task 1: Campo `followUpForced` + lógica en lib/followup.ts (TDD)

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/followup.ts`
- Test: `lib/__tests__/followup.test.ts`

**Interfaces:**
- Produces: `Provider.followUpForced?: boolean`; `nextFollowUpDate(p)` permite tracking si `contactMethod === "Email"` o `followUpForced === true`

- [ ] **Step 1: Agregar el campo al tipo Provider**

En `lib/types.ts`, dentro de `export type Provider = { ... }`, agregar después de `followUpStopped?: boolean;` (agregado en el plan anterior `2026-06-30-followups-stop-redesign.md`):

```ts
  /** true = fuerza el tracking de follow-up aunque contactMethod no sea "Email". */
  followUpForced?: boolean;
```

- [ ] **Step 2: Escribir los tests que fallan**

En `lib/__tests__/followup.test.ts`, agregar estos dos tests dentro de `describe("nextFollowUpDate", ...)`, después del test `"followUpStopped → null aunque haya secuencia activa"` (agregado en el plan anterior):

```ts
  test("followUpForced permite tracking aunque contactMethod no sea Email", () => {
    expect(
      nextFollowUpDate({
        ...base,
        contactMethod: "Llamada",
        followUpForced: true,
      } as Provider)?.toISOString().slice(0, 10),
    ).toBe("2026-06-05");
  });
  test("sin followUpForced, contactMethod distinto de Email sigue devolviendo null", () => {
    expect(
      nextFollowUpDate({ ...base, contactMethod: "Web" } as Provider),
    ).toBeNull();
  });
```

- [ ] **Step 3: Correr los tests y verificar que el primero falla**

```bash
npx vitest run lib/__tests__/followup.test.ts
```

Expected: `"followUpForced permite tracking aunque contactMethod no sea Email"` FALLA (hoy `nextFollowUpDate` devuelve `null` para `contactMethod: "Llamada"` sin importar `followUpForced`). El segundo test ya pasa con el código actual (es una verificación de que no se rompe el comportamiento existente).

- [ ] **Step 4: Implementar el cambio en lib/followup.ts**

En `lib/followup.ts`, dentro de `nextFollowUpDate`, cambiar esta línea:

```ts
  if (p.contactMethod !== "Email") return null;
```

Por:

```ts
  if (p.contactMethod !== "Email" && !p.followUpForced) return null;
```

(Esta línea queda después del chequeo de `followUpStopped` agregado en el plan anterior, antes del chequeo de `firstContactDate`.)

- [ ] **Step 5: Correr los tests y verificar que pasan**

```bash
npx vitest run lib/__tests__/followup.test.ts
```

Expected: todos los tests del archivo PASAN.

- [ ] **Step 6: Correr toda la suite**

```bash
npx vitest run
```

Expected: todos los tests pasan (40 anteriores + 2 nuevos = 42).

- [ ] **Step 7: Commit**

```bash
git add lib/types.ts lib/followup.ts lib/__tests__/followup.test.ts
git commit -m "feat: add followUpForced flag to track non-Email providers manually"
```

---

### Task 2: Botón "Iniciar seguimiento" en ProviderDetail

**Files:**
- Modify: `components/ProviderDetail.tsx`
- Modify: `app/admin/(crm)/proveedores/page.tsx`

**Interfaces:**
- Consumes: `Provider.followUpForced` de Task 1; `followUpStatus`, `nextFollowUpDate` de `lib/followup.ts` (ya importados); `todayISO` de `lib/format.ts`
- Produces: nueva prop `onStartFollowUp: (patch: Partial<Provider>) => Promise<void> | void` en `ProviderDetail`

**Contexto:** el bloque actual en `components/ProviderDetail.tsx` (después del plan anterior que agregó el badge/botón de "Reanudar seguimiento") se ve así:

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

- [ ] **Step 1: Agregar la prop `onStartFollowUp` a la firma del componente**

Modificar la firma de la función (junto a `onResumeFollowUp` ya existente):

```tsx
export function ProviderDetail({
  provider,
  today,
  onClose,
  onEdit,
  onAddNote,
  onDelete,
  onResumeFollowUp,
  onStartFollowUp,
}: {
  provider: Provider;
  today: Date;
  onClose: () => void;
  onEdit: () => void;
  onAddNote: (text: string) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onResumeFollowUp: () => Promise<void> | void;
  onStartFollowUp: (patch: Partial<Provider>) => Promise<void> | void;
}) {
```

- [ ] **Step 2: Agregar el helper `trackingActive` y la función `startFollowUp`**

Dentro del componente, junto a la declaración de `status` (`const status = followUpStatus(provider, today);`), agregar:

```ts
  const trackingActive =
    (provider.contactMethod === "Email" || provider.followUpForced) &&
    !!provider.firstContactDate;

  function startFollowUp() {
    const patch: Partial<Provider> = { followUpForced: true };
    if (!provider.firstContactDate) {
      patch.firstContactDate = todayISO();
      patch.followUpStep = 0;
    }
    return onStartFollowUp(patch);
  }
```

Agregar el import de `todayISO`:

```ts
import { formatDate, todayISO } from "@/lib/format";
```

(Reemplaza el import actual `import { formatDate } from "@/lib/format";`.)

- [ ] **Step 3: Reemplazar el bloque del Follow-up Track**

Reemplazar el bloque completo (incluyendo el `{provider.contactMethod === "Email" && ( ... )}` que lo envuelve) por:

```tsx
        {/* Follow-up Track — se muestra siempre; el tracking en sí solo corre si está activo */}
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
            ) : trackingActive ? (
              <p className="font-mono text-xs text-ink-soft">
                {nextLabel(provider, today)}
              </p>
            ) : (
              <button
                type="button"
                onClick={startFollowUp}
                className="text-xs font-medium text-olive hover:underline"
              >
                Iniciar seguimiento
              </button>
            )}
          </div>
          <FollowUpTrack
            followUpStep={provider.followUpStep}
            status={status}
            firstContactDate={provider.firstContactDate}
            showDates
          />
        </div>
```

- [ ] **Step 4: Cablear la prop en la página de Proveedores**

En `app/admin/(crm)/proveedores/page.tsx`, dentro del `<ProviderDetail ... />`, agregar junto a `onResumeFollowUp`:

```tsx
          onStartFollowUp={(patch) => updateProvider(detailProvider.id, patch)}
```

- [ ] **Step 5: Verificar que compila**

```bash
npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 6: Build de producción**

```bash
npm run build
```

Expected: build verde.

- [ ] **Step 7: Verificar en preview**

`npm run dev` → `http://localhost:3000/admin/proveedores`.

Checklist manual:
- [ ] Abrir un proveedor con `contactMethod: "Email"` que nunca fue contactado (firstContactDate vacío, track "Sin contactar") → aparece el botón "Iniciar seguimiento"
- [ ] Click en "Iniciar seguimiento" → el track pasa a mostrar el día 1 marcado y el proveedor aparece en `/admin/follow-ups`
- [ ] Abrir un proveedor con `contactMethod: "Llamada"` o `"Web"` → también aparece el bloque de Secuencia de follow-up (antes no se mostraba) con el botón "Iniciar seguimiento"
- [ ] Click en ese botón → el proveedor empieza a aparecer en `/admin/follow-ups` igual que uno de Email
- [ ] Un proveedor con tracking ya activo sigue mostrando la fecha del próximo paso (sin el botón)
- [ ] Un proveedor con seguimiento detenido sigue mostrando el badge + "Reanudar seguimiento" (sin cambios)

- [ ] **Step 8: Commit**

```bash
git add components/ProviderDetail.tsx "app/admin/(crm)/proveedores/page.tsx"
git commit -m "feat: add manual start-follow-up button to provider detail"
```

- [ ] **Step 9: Abrir PR**

```bash
gh pr create --title "feat: manual follow-up start for any provider" --body "$(cat <<'EOF'
## Summary
- `Provider.followUpForced` (opcional) — permite que `nextFollowUpDate` trackee proveedores con Método de Contacto distinto de Email
- ProviderDetail muestra siempre el bloque "Secuencia de follow-up" (antes solo para contactMethod === Email)
- Botón "Iniciar seguimiento": si el proveedor nunca fue contactado, fija firstContactDate=hoy y followUpStep=0; si ya tenía fecha pero no estaba trackeado (Llamada/Web), solo activa followUpForced

## Test plan
- [ ] npx vitest run → 42/42 tests pasan
- [ ] Proveedor Email sin contactar → botón "Iniciar seguimiento" → aparece en Follow-ups
- [ ] Proveedor Llamada/Web → botón "Iniciar seguimiento" → aparece en Follow-ups igual que uno de Email
- [ ] Proveedor con tracking activo → sin cambios visuales
- [ ] Proveedor detenido → badge + Reanudar sin cambios

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
