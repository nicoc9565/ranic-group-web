# Dashboard Tareas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar el Dashboard para que sea el "home base" del CRM: reemplazar la lista redundante de follow-ups con un módulo de tareas compartido, y reducir los follow-ups a un banner compacto.

**Architecture:** Nueva colección Firestore `tasks` con su capa de acceso en `lib/tasks.ts`, dos componentes nuevos (`TaskForm` y `TaskList`), y el dashboard rediseñado que los integra. No hay lógica pura nueva que requiera TDD — todo es UI + Firestore.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS v4, Firebase Firestore (onSnapshot), `lib/auth.tsx` → `useAuth()` + `displayName()`.

## Global Constraints

- Idioma UI: **español** en todos los labels, placeholders y mensajes.
- Tokens de color: `olive` (#556B2F), `olive-deep` (#3E4F1D), `stone` (#F3F4EF), `ink` (#1C1B17), `ink-soft` (#6B6A60), `line` (borde), `surface` (fondo de card).
- Clases de forma: `rounded-card` para cards/contenedores, `rounded-control` para inputs y botones pequeños.
- `font-eyebrow`: `text-[11px] uppercase tracking-[0.15em]` — usar para labels de sección.
- Nunca hardcodear colores hex — usar siempre los tokens Tailwind del proyecto.
- Firestore: todas las escrituras requieren `request.auth != null` (ya configurado en reglas).
- No modificar `lib/followup.ts`, `lib/types.ts`, `lib/providers.ts`, ni ninguna otra página que no sea el dashboard.
- El componente `FollowUpAlert` existente **no se elimina**, solo deja de usarse en el dashboard.
- Commits en inglés, estilo `feat:` / `chore:`.

---

### Task 1: Capa de datos — lib/tasks.ts

**Files:**
- Create: `lib/tasks.ts`

**Interfaces:**
- Consumes: `db` de `lib/firebase.ts`, Firestore SDK (`addDoc`, `collection`, `deleteDoc`, `doc`, `onSnapshot`, `orderBy`, `query`, `updateDoc`)
- Produces:
  - `Task` interface
  - `TaskInput` type
  - `subscribeTasks(cb: (tasks: Task[]) => void): () => void`
  - `addTask(input: TaskInput): Promise<void>`
  - `updateTask(id: string, patch: Partial<Task>): Promise<void>`
  - `deleteTask(id: string): Promise<void>`

- [ ] **Step 1: Crear lib/tasks.ts**

```ts
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export interface Task {
  id: string;
  title: string;
  note?: string;
  important: boolean;
  dueDate?: string;   // yyyy-mm-dd
  done: boolean;
  createdBy: string;  // displayName del usuario autenticado
  createdAt: string;  // ISO timestamp
  doneAt?: string;    // ISO timestamp, se setea al marcar done=true
}

export type TaskInput = Omit<Task, "id" | "done" | "createdAt" | "doneAt">;

const COL = "tasks";

export function subscribeTasks(cb: (tasks: Task[]) => void): () => void {
  const q = query(collection(db, COL), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Task, "id">),
      })),
    );
  });
}

export async function addTask(input: TaskInput): Promise<void> {
  await addDoc(collection(db, COL), {
    ...input,
    done: false,
    createdAt: new Date().toISOString(),
  });
}

export async function updateTask(id: string, patch: Partial<Task>): Promise<void> {
  await updateDoc(doc(db, COL, id), patch);
}

export async function deleteTask(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}
```

- [ ] **Step 2: Verificar que compila sin errores**

```bash
npx tsc --noEmit
```

Expected: sin errores relacionados a `lib/tasks.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/tasks.ts
git commit -m "feat: add tasks Firestore data layer"
```

---

### Task 2: Formulario inline — components/TaskForm.tsx

**Files:**
- Create: `components/TaskForm.tsx`

**Interfaces:**
- Consumes: `addTask`, `TaskInput` de `lib/tasks.ts`; `useAuth`, `displayName` de `lib/auth.tsx`
- Produces: `<TaskForm />` — componente sin props, maneja su propio estado open/closed

- [ ] **Step 1: Crear components/TaskForm.tsx**

```tsx
"use client";

import { useState } from "react";
import { displayName, useAuth } from "@/lib/auth";
import { addTask } from "@/lib/tasks";

const inputCls =
  "w-full rounded-control border border-line bg-stone px-3 py-2 text-sm text-ink outline-none focus:border-olive";
const labelCls =
  "mb-1 block text-[11px] font-eyebrow uppercase tracking-[0.15em] text-ink-soft";

export function TaskForm() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [important, setImportant] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setTitle("");
    setNote("");
    setImportant(false);
    setDueDate("");
    setOpen(false);
  }

  async function handleSave() {
    if (!title.trim() || !user) return;
    setSaving(true);
    try {
      await addTask({
        title: title.trim(),
        note: note.trim() || undefined,
        important,
        dueDate: dueDate || undefined,
        createdBy: displayName(user.email),
      });
      reset();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-control border border-dashed border-line px-3 py-2 text-sm text-ink-soft transition-colors hover:border-olive hover:text-olive"
      >
        + Agregar tarea
      </button>
    );
  }

  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="mb-3">
        <label className={labelCls} htmlFor="task-title">
          Tarea
        </label>
        <input
          id="task-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nueva tarea…"
          className={inputCls}
          autoFocus
        />
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="task-due">
            Fecha límite (opcional)
          </label>
          <input
            id="task-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="flex items-center gap-2 pt-5">
          <input
            id="task-important"
            type="checkbox"
            checked={important}
            onChange={(e) => setImportant(e.target.checked)}
            className="h-4 w-4 accent-olive"
          />
          <label htmlFor="task-important" className="text-sm text-ink">
            Marcar como importante
          </label>
        </div>
      </div>

      <div className="mb-4">
        <label className={labelCls} htmlFor="task-note">
          Nota (opcional)
        </label>
        <textarea
          id="task-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota…"
          rows={2}
          className={`${inputCls} resize-none`}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!title.trim() || saving}
          className="rounded-control bg-olive px-4 py-2 text-sm font-medium text-stone transition-colors hover:bg-olive-deep disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-control border border-line px-4 py-2 text-sm text-ink-soft transition-colors hover:border-olive hover:text-ink"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila sin errores**

```bash
npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/TaskForm.tsx
git commit -m "feat: add TaskForm inline component"
```

---

### Task 3: Lista de tareas — components/TaskList.tsx

**Files:**
- Create: `components/TaskList.tsx`

**Interfaces:**
- Consumes: `Task` de `lib/tasks.ts`; `updateTask`, `deleteTask` de `lib/tasks.ts`
- Produces: `<TaskList tasks={Task[]} />`

**Lógica de ordenamiento para pendientes:**
1. Importantes primero (`important === true`)
2. Dentro de cada grupo: con `dueDate` más próxima primero (ASC), sin `dueDate` al final
3. Sin fecha: por `createdAt` DESC

- [ ] **Step 1: Crear components/TaskList.tsx**

```tsx
"use client";

import { useState } from "react";
import { deleteTask, updateTask, type Task } from "@/lib/tasks";

function dueBadge(dueDate: string): { label: string; cls: string } {
  const today = new Date().toISOString().slice(0, 10);
  if (dueDate < today)
    return { label: dueDate, cls: "bg-red-100 text-red-700" };
  if (dueDate === today)
    return { label: "Hoy", cls: "bg-amber-100 text-amber-700" };
  return { label: dueDate, cls: "bg-stone text-ink-soft" };
}

function sortPending(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // Importantes primero
    if (a.important !== b.important) return a.important ? -1 : 1;
    // Con fecha antes que sin fecha
    if (!!a.dueDate !== !!b.dueDate) return a.dueDate ? -1 : 1;
    // Ambos con fecha: más próxima primero
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    // Ambos sin fecha: más reciente primero
    return b.createdAt.localeCompare(a.createdAt);
  });
}

function TaskRow({ task }: { task: Task }) {
  const [deleting, setDeleting] = useState(false);

  async function toggleDone() {
    const patch = task.done
      ? { done: false, doneAt: undefined }
      : { done: true, doneAt: new Date().toISOString() };
    await updateTask(task.id, patch);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteTask(task.id);
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div className="group flex items-start gap-3 rounded-card border border-line bg-surface px-4 py-3">
      <input
        type="checkbox"
        checked={task.done}
        onChange={toggleDone}
        className="mt-0.5 h-4 w-4 shrink-0 accent-olive"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {task.important && (
            <span className="text-olive" title="Importante">
              ★
            </span>
          )}
          <span
            className={`text-sm font-medium ${task.done ? "text-ink-soft line-through" : "text-ink"}`}
          >
            {task.title}
          </span>
          {task.dueDate && !task.done && (() => {
            const badge = dueBadge(task.dueDate);
            return (
              <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${badge.cls}`}>
                {badge.label}
              </span>
            );
          })()}
        </div>

        {task.note && (
          <p className="mt-1 text-xs text-ink-soft">{task.note}</p>
        )}

        <p className="mt-1 font-mono text-[10px] text-ink-soft/60">
          {task.createdBy}
        </p>
      </div>

      {!task.done && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="shrink-0 text-ink-soft opacity-0 transition-opacity hover:text-ink group-hover:opacity-100 disabled:opacity-50"
          title="Eliminar tarea"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export function TaskList({ tasks }: { tasks: Task[] }) {
  const [showDone, setShowDone] = useState(false);

  const pending = sortPending(tasks.filter((t) => !t.done));
  const done = tasks.filter((t) => t.done);

  if (tasks.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-surface px-4 py-8 text-center">
        <p className="text-sm text-ink">No hay tareas todavía.</p>
        <p className="mt-1 text-xs text-ink-soft">
          Agregá una tarea con el botón de arriba.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pending.map((t) => (
        <TaskRow key={t.id} task={t} />
      ))}

      {done.length > 0 && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="text-xs text-ink-soft hover:text-ink"
          >
            {showDone
              ? `Ocultar hechas (${done.length}) ▴`
              : `Ver hechas (${done.length}) ▾`}
          </button>

          {showDone && (
            <div className="mt-2 space-y-2">
              {done.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila sin errores**

```bash
npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/TaskList.tsx
git commit -m "feat: add TaskList component with pending/done sections"
```

---

### Task 4: Dashboard rediseñado

**Files:**
- Modify: `app/admin/(crm)/dashboard/page.tsx`

**Interfaces:**
- Consumes:
  - `subscribeTasks`, `Task` de `lib/tasks.ts`
  - `TaskForm` de `components/TaskForm.tsx`
  - `TaskList` de `components/TaskList.tsx`
  - `subscribeProviders` de `lib/providers.ts` (ya importado)
  - `followUpStatus` de `lib/followup.ts` (ya importado)
  - `MetricCard` de `components/MetricCard.tsx` (ya importado)
  - `PageHeader` de `components/PageHeader.tsx` (ya importado)
  - `Link` de `next/link` (nuevo import)
- Removes: import de `FollowUpAlert` (ya no se usa en el dashboard)

**Nota:** El archivo actual importa `FollowUpAlert` — ese import se elimina. El componente en sí NO se borra.

- [ ] **Step 1: Reemplazar el contenido de app/admin/(crm)/dashboard/page.tsx**

```tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { TaskForm } from "@/components/TaskForm";
import { TaskList } from "@/components/TaskList";
import { followUpStatus } from "@/lib/followup";
import { subscribeProviders } from "@/lib/providers";
import { subscribeTasks, type Task } from "@/lib/tasks";
import type { Provider } from "@/lib/types";

const IN_PROGRESS: Provider["status"][] = [
  "Contactado",
  "En Espera de Respuesta",
  "En Negociación",
];

export default function DashboardPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => subscribeProviders(setProviders), []);
  useEffect(
    () =>
      subscribeTasks((list) => {
        setTasks(list);
        setLoaded(true);
      }),
    [],
  );

  const today = useMemo(() => new Date(), []);

  const metrics = useMemo(() => {
    const aprobados = providers.filter((p) => p.status === "Aprobado").length;
    const enProceso = providers.filter((p) =>
      IN_PROGRESS.includes(p.status),
    ).length;
    const pendientesHoy = providers.filter((p) => {
      const s = followUpStatus(p, today);
      return s === "today" || s === "overdue";
    }).length;
    return { total: providers.length, aprobados, enProceso, pendientesHoy };
  }, [providers, today]);

  return (
    <>
      <PageHeader eyebrow="Resumen" title="Dashboard" />

      {/* Métricas */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Proveedores" value={metrics.total} />
        <MetricCard label="Aprobados" value={metrics.aprobados} accent />
        <MetricCard label="En proceso" value={metrics.enProceso} />
        <MetricCard label="Follow-ups hoy" value={metrics.pendientesHoy} accent />
      </section>

      {/* Tareas */}
      <section className="mt-8">
        <h2 className="mb-3 font-eyebrow text-[11px] uppercase tracking-[0.2em] text-ink-soft">
          Tareas
        </h2>

        {!loaded ? (
          <p className="font-mono text-sm text-ink-soft">Cargando…</p>
        ) : (
          <div className="space-y-3">
            <TaskForm />
            <TaskList tasks={tasks} />
          </div>
        )}
      </section>

      {/* Banner follow-ups compacto */}
      {metrics.pendientesHoy > 0 && (
        <section className="mt-6">
          <div className="flex items-center justify-between rounded-card border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-medium text-amber-800">
              Tenés {metrics.pendientesHoy} follow-up
              {metrics.pendientesHoy === 1 ? "" : "s"} vencido
              {metrics.pendientesHoy === 1 ? "" : "s"} o que vence
              {metrics.pendientesHoy === 1 ? "" : "n"} hoy
            </p>
            <Link
              href="/admin/follow-ups"
              className="text-sm font-medium text-amber-800 underline hover:text-amber-900"
            >
              Ver todos →
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verificar que compila sin errores**

```bash
npx tsc --noEmit
```

Expected: sin errores. Confirmar que `FollowUpAlert` ya no se importa en este archivo.

- [ ] **Step 3: Build de producción**

```bash
npm run build
```

Expected: sin errores de compilación ni warnings de tipos.

- [ ] **Step 4: Verificar en preview**

Correr `npm run dev` y abrir `http://localhost:3000/admin/dashboard`.

Checklist manual:
- [ ] Las 4 metric cards se muestran correctamente
- [ ] Aparece el botón "+ Agregar tarea"
- [ ] Al hacer click: se abre el formulario inline con campos título, fecha, importante, nota
- [ ] Al guardar una tarea: aparece en la lista sin recargar la página
- [ ] Marcar checkbox de una tarea: pasa a "Ver hechas"
- [ ] Desmarcar una tarea hecha: vuelve a pendientes
- [ ] El botón ✕ elimina la tarea (solo visible en hover, solo en tareas pendientes)
- [ ] Tarea marcada como importante: aparece primero con ★
- [ ] Tarea con fecha vencida: badge rojo; fecha de hoy: badge "Hoy" amarillo; futura: badge gris
- [ ] Si hay follow-ups vencidos/hoy: aparece el banner amarillo con "Ver todos →" que lleva a /admin/follow-ups
- [ ] Si no hay follow-ups urgentes: el banner no aparece

- [ ] **Step 5: Commit**

```bash
git add app/admin/(crm)/dashboard/page.tsx
git commit -m "feat: redesign dashboard with tasks module and compact follow-ups banner"
```

- [ ] **Step 6: Abrir PR**

```bash
gh pr create --title "feat: dashboard tasks module" --body "$(cat <<'EOF'
## Summary
- Nueva colección Firestore `tasks` con capa de acceso en `lib/tasks.ts`
- Componente `TaskForm` para agregar tareas inline (título, nota, fecha, importante)
- Componente `TaskList` con pendientes ordenados por importancia/fecha y sección colapsable de hechas
- Dashboard rediseñado: métricas → tareas → banner compacto de follow-ups urgentes
- `FollowUpAlert` removido del dashboard (componente intacto, sin eliminar)

## Test plan
- [ ] Agregar tarea solo con título → aparece en lista
- [ ] Agregar tarea con nota + fecha + importante → aparece primero con ★ y badge de fecha correcto
- [ ] Marcar como hecha → pasa a sección colapsable
- [ ] Desmarcar → vuelve a pendientes
- [ ] Eliminar tarea pendiente (hover ✕)
- [ ] Banner amarillo aparece solo cuando hay follow-ups vencidos/hoy
- [ ] "Ver todos →" navega a /admin/follow-ups

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
