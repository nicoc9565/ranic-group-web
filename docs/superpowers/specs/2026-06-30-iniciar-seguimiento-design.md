# Iniciar seguimiento manual desde ProviderDetail

## 1. Objetivo

Permitir arrancar el tracking de follow-up de un proveedor directamente desde su ficha (ProviderDetail), sin depender de pasar primero por "Marcar como enviado" en Emails. También permite forzar el tracking para proveedores cuyo Método de Contacto es Llamada o Web (hoy excluidos por diseño).

## 2. Contexto / causa raíz

El campo "Estado" del proveedor (Contactado, En Negociación, etc.) es independiente de las fechas que mueven el follow-up (`firstContactDate`, `followUpStep`). Editar el Estado a mano nunca inició el seguimiento — solo lo hace `advanceFollowUp`, invocado hoy únicamente desde "Marcar como enviado" en Emails. Esto generó confusión: proveedores marcados como "Contactado" seguían mostrando "Sin contactar" en el track.

Además, `nextFollowUpDate` excluye por diseño a los proveedores con `contactMethod !== "Email"` (regla de Fase 3: el follow-up asume una secuencia de emails). Nico quiere poder optar manualmente por trackear igual a un proveedor contactado por Llamada o Web.

## 3. Alcance

**Dentro de alcance:**
- Nuevo campo `followUpForced` en `Provider`
- `lib/followup.ts`: `nextFollowUpDate` permite tracking si `contactMethod === "Email"` **o** `followUpForced === true`
- Botón "Iniciar seguimiento" en `ProviderDetail`, visible cuando el tracking no está activo
- El bloque "Secuencia de follow-up" deja de estar gateado solo a `contactMethod === "Email"` — se muestra siempre, con distintos estados

**Fuera de alcance:**
- Cambios a Emails, Follow-ups (la página ya filtra correctamente usando `followUpStatus`/`nextFollowUpDate`, no necesita tocarse)
- Edición manual de fechas de envío (ya descartado en el diseño anterior)

## 4. Modelo de datos

`lib/types.ts` — agregar campo opcional a `Provider`, junto a `followUpStopped`:

```ts
/** true = fuerza el tracking de follow-up aunque contactMethod no sea "Email". */
followUpForced?: boolean;
```

## 5. Lógica — lib/followup.ts

`nextFollowUpDate(p)` cambia la condición de gate de método de contacto:

```ts
// Antes:
if (p.contactMethod !== "Email") return null;

// Después:
if (p.contactMethod !== "Email" && !p.followUpForced) return null;
```

El orden de chequeos queda: `followUpStopped` → gate de método/forced → `firstContactDate` → secuencia agotada. Sin cambios en el resto de la función.

## 6. UI — components/ProviderDetail.tsx

El bloque "Secuencia de follow-up" deja de estar condicionado a `provider.contactMethod === "Email"` y pasa a mostrarse **siempre**, con tres estados posibles:

**Estado A — Detenido** (`provider.followUpStopped === true`): sin cambios respecto a lo ya implementado (badge + "Reanudar seguimiento").

**Estado B — Activo** (tracking pasa el gate: `(contactMethod === "Email" || followUpForced) && firstContactDate` y no detenido): sin cambios — track normal con fechas.

**Estado C — Inactivo** (no detenido, pero no pasa el gate o no tiene `firstContactDate` todavía — incluye el caso de "Sin contactar" y el caso de contactMethod Llamada/Web sin forzar): mostrar el track en gris (apagado) + botón **"Iniciar seguimiento"**.

**Comportamiento del botón "Iniciar seguimiento":**

```ts
function startFollowUp() {
  const patch: Partial<Provider> = { followUpForced: true };
  if (!provider.firstContactDate) {
    patch.firstContactDate = todayISO();
    patch.followUpStep = 0;
  }
  return onStartFollowUp(patch); // ver prop nueva abajo
}
```

- Si el proveedor nunca fue contactado (`firstContactDate` null): fija la fecha de hoy como primer contacto y arranca en el paso 0 (día 1 ya "enviado" conceptualmente — mismo comportamiento que el primer "Marcar como enviado" en Emails).
- Si ya tenía `firstContactDate` (por ejemplo, contactMethod Llamada/Web con historial pero sin tracking activo): solo agrega `followUpForced: true`, sin tocar `followUpStep` ni fechas existentes.
- Siempre setea `followUpForced: true` (no tiene efecto negativo en proveedores de Email — es una condición OR).

**Nueva prop en ProviderDetail:**

```ts
onStartFollowUp: (patch: Partial<Provider>) => Promise<void> | void;
```

El caller (`app/admin/(crm)/proveedores/page.tsx`) la implementa como:

```ts
onStartFollowUp={(patch) => updateProvider(detailProvider.id, patch)}
```

## 7. Tests

Agregar a `lib/__tests__/followup.test.ts`, dentro de `describe("nextFollowUpDate", ...)`:

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

## 8. Archivos afectados

| Acción    | Archivo                                              |
|-----------|-------------------------------------------------------|
| Modificar | `lib/types.ts` — agregar `followUpForced?: boolean`   |
| Modificar | `lib/followup.ts` — gate de `nextFollowUpDate`        |
| Modificar | `components/ProviderDetail.tsx` — estados del bloque + botón + prop `onStartFollowUp` |
| Modificar | `app/admin/(crm)/proveedores/page.tsx` — cablear `onStartFollowUp` |
| Modificar | `lib/__tests__/followup.test.ts` — 2 tests nuevos     |
| Sin tocar | `app/admin/(crm)/follow-ups/page.tsx`, `app/admin/(crm)/emails/EmailsPageContent.tsx`, Finanzas, Tareas |
