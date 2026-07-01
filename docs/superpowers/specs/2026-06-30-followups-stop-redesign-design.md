# Follow-ups — Detener seguimiento + rediseño de fila

## 1. Objetivo

Permitir sacar un proveedor de la lista de Follow-ups sin borrar el proveedor ni su historial, y rediseñar la fila de Follow-ups para que los botones de acción no rompan el layout al agregar una tercera acción.

## 2. Alcance

**Dentro de alcance:**
- Nuevo campo `followUpStopped` en `Provider`
- `lib/followup.ts`: `nextFollowUpDate` respeta `followUpStopped`
- Rediseño de la fila en `app/admin/(crm)/follow-ups/page.tsx`: info arriba, barra de acciones abajo separada por línea
- Botón ícono "Detener seguimiento" en la barra de acciones de Follow-ups
- En `ProviderDetail`: indicar si el seguimiento está detenido y permitir reanudarlo

**Fuera de alcance:**
- Edición manual de fechas de envío (Nico confirmó que no hace falta — "Marcar como enviado" sigue usando la fecha de hoy automáticamente)
- Eliminar el proveedor (ya existe esa acción en Proveedores, separada)
- Cambios a `lib/emails.ts`, `lib/emailsEs.ts`, Finanzas, Tareas del dashboard

## 3. Modelo de datos

`lib/types.ts` — agregar campo opcional a `Provider`:

```ts
followUpStopped?: boolean; // default false/undefined — true = no aparece en Follow-ups
```

No se migra el seed/import existentes: los proveedores sin el campo se tratan como `false` (seguimiento activo), igual que el patrón ya usado para otros campos opcionales del modelo.

## 4. Lógica — lib/followup.ts

`nextFollowUpDate(p)` agrega una condición más, antes de las existentes:

```ts
if (p.followUpStopped) return null;
```

Esto hace que `followUpStatus` devuelva `"none"` para esos proveedores, lo cual ya los excluye automáticamente de:
- La lista de `/admin/follow-ups` (filtra `s !== "none"`)
- El contador `pendientesHoy` del Dashboard
- El banner amarillo del Dashboard

## 5. Rediseño de fila — app/admin/(crm)/follow-ups/page.tsx

Cada fila pasa de "una línea flexible que rompe al agregar botones" a una card de dos bloques apilados:

```
┌──────────────────────────────────────────────────────┐
│ BiloBeauty                    ●──○──○──○   Vencido    │
│                                D1 D4 D7 D12 Día 1·16/01│
├──────────────────────────────────────────────────────┤
│ [⊘]                    Redactar email  Marcar enviado │
└──────────────────────────────────────────────────────┘
```

- **Bloque superior:** igual que ahora — company/contact a la izquierda, FollowUpTrack (oculto en mobile) y estado/fecha a la derecha.
- **Separador:** `border-t border-line` entre bloques.
- **Bloque inferior (barra de acciones):** siempre en su propia fila, `flex items-center justify-between`.
  - Izquierda: botón ícono "Detener seguimiento" — ícono "no entry" (círculo con línea), `text-ink-soft`, hover `text-status-overdue`, con `title="Detener seguimiento"` para accesibilidad/tooltip.
  - Derecha: "Redactar email" (outline) + "Marcar como enviado" (sólido), igual que ahora.

Este layout no cambia con el ancho de pantalla — la barra de acciones siempre está en su propia franja, eliminando el wrap inconsistente que se veía en el screenshot.

**Comportamiento del botón "Detener seguimiento":**
- Al hacer click: `updateProvider(p.id, { followUpStopped: true })`
- El proveedor desaparece de la lista inmediatamente (onSnapshot ya actualiza el filtro)
- No hay modal de confirmación — es reversible desde la ficha del proveedor (ver §6)

## 6. Reanudar seguimiento — components/ProviderDetail.tsx

Dentro del bloque "Secuencia de follow-up" (que ya solo se muestra para `contactMethod === "Email"`):

- Si `provider.followUpStopped === true`:
  - Mostrar un badge "Seguimiento detenido" (gris, junto al label existente)
  - Mostrar un botón "Reanudar seguimiento" que hace `updateProvider(id, { followUpStopped: false })`
  - El resto del bloque (track, próxima fecha) se sigue mostrando igual, ya que el historial no se borra

## 7. Tests

`lib/followup.ts` es lógica pura ya testeada. Agregar un test nuevo a `lib/__tests__/followup.test.ts` (si no existe el archivo, crear siguiendo el patrón de `lib/__tests__/financeCategory.test.ts`):

```ts
test("nextFollowUpDate devuelve null si followUpStopped es true", () => {
  const p = makeProvider({
    contactMethod: "Email",
    firstContactDate: "2026-01-01",
    followUpStep: 0,
    followUpStopped: true,
  });
  expect(nextFollowUpDate(p)).toBeNull();
});
```

(El helper `makeProvider` y la estructura exacta del archivo de test los define quien implemente, siguiendo el patrón de los tests existentes de `lib/__tests__/`.)

## 8. Archivos afectados

| Acción    | Archivo                                              |
|-----------|-------------------------------------------------------|
| Modificar | `lib/types.ts` — agregar `followUpStopped?: boolean`  |
| Modificar | `lib/followup.ts` — `nextFollowUpDate` respeta el flag |
| Modificar | `app/admin/(crm)/follow-ups/page.tsx` — rediseño de fila + botón ícono |
| Modificar | `components/ProviderDetail.tsx` — badge + botón reanudar |
| Crear/Modificar | `lib/__tests__/followup.test.ts` — test del flag |
| Sin tocar | `lib/emails.ts`, `lib/emailsEs.ts`, Finanzas, Tareas, Dashboard (solo se beneficia indirectamente del filtro) |
