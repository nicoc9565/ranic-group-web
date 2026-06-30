"use client";

import { useState } from "react";
import { deleteTask, updateTask, type Task } from "@/lib/tasks";

function dueBadge(dueDate: string): { label: string; cls: string } {
  const today = new Date().toISOString().slice(0, 10);
  if (dueDate < today) return { label: dueDate, cls: "bg-red-100 text-red-700" };
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
          {task.dueDate &&
            !task.done &&
            (() => {
              const badge = dueBadge(task.dueDate);
              return (
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${badge.cls}`}
                >
                  {badge.label}
                </span>
              );
            })()}
        </div>

        {task.note && <p className="mt-1 text-xs text-ink-soft">{task.note}</p>}

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
