# Dashboard Rediseño — Tareas + Follow-ups compacto

## 1. Objetivo

Convertir el Dashboard en el "home base" real del CRM: reemplazar la lista de follow-ups redundante con un módulo de tareas compartido entre Nico y Rafa, y reducir la sección de follow-ups a un banner compacto que avisa sin duplicar la página Follow-ups.

## 2. Alcance

**Dentro de alcance:**
- Nueva colección Firestore `tasks`
- `lib/tasks.ts` — capa de acceso a datos (subscribe, add, update, delete)
- Rediseño de `app/admin/(crm)/dashboard/page.tsx`
- Nuevo componente `components/TaskList.tsx`
- Nuevo componente `components/TaskForm.tsx` (formulario inline de agregar)

**Fuera de alcance:**
- No se agrega ítem al nav (las tareas viven solo en el Dashboard)
- No se modifica `/admin/follow-ups`, `/admin/proveedores`, ni ninguna otra página
- No hay notificaciones push ni email por tareas vencidas
- No hay asignación de tarea a un usuario específico (cualquiera puede hacer cualquier tarea)

## 3. Modelo de datos — colección `tasks`

```ts
interface Task {
  id: string;           // auto-generado por Firestore
  title: string;        // obligatorio
  note?: string;        // opcional
  important: boolean;   // default false
  dueDate?: string;     // opcional, yyyy-mm-dd
  done: boolean;        // default false
  createdBy: string;    // displayName del usuario autenticado al momento de crear
  createdAt: string;    // ISO timestamp (new Date().toISOString())
  doneAt?: string;      // ISO timestamp, se setea al marcar done=true
}
```

`createdBy` usa la misma función `displayName(user.email)` que ya existe en `lib/auth.tsx` — devuelve "Nico" o "César" (o la parte antes del @ si el email no matchea).

Nota: Rafa no tiene acceso al CRM actualmente. `createdBy` reflejará quién de los usuarios activos (Nico / César) creó la tarea. Si en el futuro se agrega a Rafa, funciona igual.

## 4. lib/tasks.ts

Mismo patrón que `lib/providers.ts` y `lib/transactions.ts`:

```ts
export interface TaskInput {
  title: string;
  note?: string;
  important: boolean;
  dueDate?: string;
  createdBy: string;
}

export function subscribeTasks(cb: (tasks: Task[]) => void): () => void
export async function addTask(input: TaskInput): Promise<void>
export async function updateTask(id: string, patch: Partial<Task>): Promise<void>
export async function deleteTask(id: string): Promise<void>
```

`subscribeTasks` ordena por `createdAt` descendente (las más recientes primero).

## 5. Layout del Dashboard rediseñado

```
┌─────────────────────────────────────────────┐
│  [Proveedores]  [Aprobados]  [En proceso]   │
│  [Follow-ups hoy]                           │  ← 4 metric cards (sin cambios)
├─────────────────────────────────────────────┤
│  TAREAS                          [+ Agregar]│  ← sección principal
│  ┌─────────────────────────────────────────┐│
│  │ [ ] ★ Hablar con proveedor X  vence 30/6││  ← tarea importante con fecha
│  │     Nota: preguntar por descuento       ││
│  │ [ ]   Verificar ventas de la semana     ││
│  │ [ ]   Renovar suscripción Helium10      ││
│  └─────────────────────────────────────────┘│
│  Ver hechas (3) ▾                           │  ← colapsable
├─────────────────────────────────────────────┤
│  ⚠ 5 follow-ups vencidos o que vencen hoy  │  ← banner compacto
│                              [Ver todos →]  │
└─────────────────────────────────────────────┘
```

Si no hay follow-ups urgentes, el banner no se muestra.

## 6. Comportamiento — TaskForm (agregar tarea)

- Botón "+ Agregar" abre un formulario inline (no modal) debajo del header de la sección.
- Campos:
  - `title`: input de texto, obligatorio, placeholder "Nueva tarea…"
  - `important`: checkbox o toggle "Importante"
  - `dueDate`: date input, opcional, label "Fecha límite (opcional)"
  - `note`: textarea, opcional, placeholder "Nota…"
- Botones: "Guardar" (disabled si title vacío) y "Cancelar"
- Al guardar: llama `addTask()`, cierra el formulario, la tarea aparece en la lista.
- `createdBy` se toma del usuario autenticado en el momento de guardar.

## 7. Comportamiento — TaskList

**Orden de tareas pendientes:**
1. Importantes primero (`important === true`)
2. Dentro de importantes: con fecha más próxima primero, sin fecha al final
3. No importantes con fecha: por fecha asc
4. No importantes sin fecha: por createdAt desc

**Cada fila de tarea pendiente:**
- Checkbox → al hacer click, marca `done=true` y setea `doneAt`
- Estrella ★ si `important === true` (color olive)
- Título
- Badge de fecha si `dueDate` existe (rojo si vencida, amarillo si vence hoy, gris si futura)
- Nombre del creador (`createdBy`) en texto pequeño
- Nota expandida debajo del título si existe (texto pequeño, color ink-soft)
- Botón eliminar (ícono ✕, pequeño, solo visible en hover)

**Tareas hechas:**
- Colapsadas debajo con toggle "Ver hechas (N) ▾ / Ocultar hechas ▴"
- Misma estructura de fila pero con título tachado y opacidad reducida
- Checkbox permite desmarcar (vuelve a pendiente, borra `doneAt`)
- No se pueden eliminar desde la UI por ahora (simplificación)

## 8. Banner de follow-ups compacto

Reemplaza la lista completa de `FollowUpAlert`. Condiciones:

- `pendientesHoy === 0` → no se muestra nada (o mensaje verde "Nada pendiente")
- `pendientesHoy > 0` → banner con fondo amber/warning:
  - Texto: "Tenés {N} follow-up{s} vencido{s} o que vence{n} hoy"
  - Link: "Ver todos →" → `/admin/follow-ups`

El componente `FollowUpAlert` existente **no se elimina** (puede usarse en otros contextos futuros), simplemente deja de usarse en el dashboard.

## 9. Seguridad

Reglas de Firestore: `tasks` requiere `request.auth != null` (mismo patrón que todas las colecciones). Solo usuarios autenticados pueden leer/escribir.

## 10. Tests

No hay lógica pura nueva que testear con Vitest (el ordenamiento es UI, no una función pura exportada). La verificación es manual en preview.

## 11. Archivos afectados

| Acción   | Archivo                                              |
|----------|------------------------------------------------------|
| Crear    | `lib/tasks.ts`                                       |
| Crear    | `components/TaskList.tsx`                            |
| Crear    | `components/TaskForm.tsx`                            |
| Modificar| `app/admin/(crm)/dashboard/page.tsx`                 |
| Sin tocar| `components/FollowUpAlert.tsx`                       |
| Sin tocar| `lib/followup.ts`, `lib/types.ts`, `lib/providers.ts`|
| Sin tocar| Cualquier otra página o componente                   |
