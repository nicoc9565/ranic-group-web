"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  addBlacklistEntry,
  MIN_INCLUSION_LENGTH,
  removeBlacklistEntry,
  subscribeBlacklist,
  updateBlacklistEntry,
} from "@/lib/blacklist";
import type { BlacklistEntry } from "@/lib/types";

export default function BlacklistPage() {
  const [entries, setEntries] = useState<BlacklistEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  useEffect(
    () =>
      subscribeBlacklist((list) => {
        setEntries(list);
        setLoaded(true);
      }),
    [],
  );

  const sorted = useMemo(
    () => [...entries].sort((a, b) => a.name.localeCompare(b.name)),
    [entries],
  );

  const trimmed = draft.trim();
  const duplicate = entries.some(
    (e) => e.name.trim().toLowerCase() === trimmed.toLowerCase(),
  );

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!trimmed || duplicate || saving) return;
    setSaving(true);
    try {
      await addBlacklistEntry(trimmed);
      setDraft("");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(id: string) {
    const name = editDraft.trim();
    if (name) await updateBlacklistEntry(id, name);
    setEditId(null);
  }

  return (
    <>
      <PageHeader
        eyebrow="No contactar"
        title="Blacklist"
        actions={
          <span className="font-mono text-sm text-ink-soft">
            {entries.length} empresas
          </span>
        }
      />

      <div className="mb-4 rounded-card border border-status-overdue/30 bg-status-overdue/5 px-4 py-3">
        <p className="text-sm text-ink">
          Estas empresas <strong>no se contactan ni se recomiendan</strong>. Al crear o
          editar un proveedor con un nombre que coincida, el sistema te avisa.
        </p>
      </div>

      <form onSubmit={handleAdd} className="mb-4 flex flex-wrap items-start gap-2">
        <div className="min-w-[12rem] flex-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Nombre de la empresa a bloquear"
            className="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-olive"
          />
          {/* El aviso explica el comportamiento real del match, que no es obvio: una sigla
              corta solo bloquea el nombre exacto. */}
          {trimmed.length > 0 && trimmed.length < MIN_INCLUSION_LENGTH && (
            <p className="mt-1 text-xs text-ink-soft">
              Con menos de {MIN_INCLUSION_LENGTH} caracteres solo se bloquea el nombre
              exacto, para no marcar de más (con «Ace», «Grace Foods» no queda bloqueada).
            </p>
          )}
          {duplicate && (
            <p className="mt-1 text-xs text-status-overdue">Ya está en la lista.</p>
          )}
        </div>
        <button
          type="submit"
          disabled={!trimmed || duplicate || saving}
          className="rounded-control bg-olive px-3 py-2 text-sm font-medium text-stone transition-colors hover:bg-olive-deep disabled:opacity-50"
        >
          {saving ? "Agregando…" : "Agregar"}
        </button>
      </form>

      {!loaded ? (
        <p className="font-mono text-sm text-ink-soft">Cargando…</p>
      ) : sorted.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface px-4 py-10 text-center">
          <p className="text-sm text-ink">La blacklist está vacía.</p>
          <p className="mt-1 text-xs text-ink-soft">
            Agregá empresas con el campo de arriba, o corré el seed para cargar las 25
            iniciales.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {sorted.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-2.5 rounded-card border border-line bg-surface px-3 py-2.5"
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-overdue"
                aria-hidden
              />

              {editId === e.id ? (
                <>
                  <input
                    value={editDraft}
                    onChange={(ev) => setEditDraft(ev.target.value)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter") saveEdit(e.id);
                      if (ev.key === "Escape") setEditId(null);
                    }}
                    autoFocus
                    className="min-w-0 flex-1 rounded-control border border-line bg-cream px-2 py-1 text-sm text-ink outline-none focus:border-olive"
                  />
                  <button
                    type="button"
                    onClick={() => saveEdit(e.id)}
                    className="shrink-0 text-xs font-medium text-olive hover:text-olive-deep"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditId(null)}
                    className="shrink-0 text-xs text-ink-soft hover:text-ink"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{e.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditId(e.id);
                      setEditDraft(e.name);
                    }}
                    className="shrink-0 text-xs text-ink-soft transition-colors hover:text-ink"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => removeBlacklistEntry(e.id)}
                    title="Quitar de la blacklist"
                    className="shrink-0 text-xs text-ink-soft transition-colors hover:text-status-overdue"
                  >
                    Quitar
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
