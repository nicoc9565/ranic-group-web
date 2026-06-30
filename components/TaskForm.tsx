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
