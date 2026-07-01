"use client";

import { useState } from "react";
import { FOLLOWUP_DAYS, followUpStatus, nextFollowUpDate } from "@/lib/followup";
import { formatDate, todayISO } from "@/lib/format";
import type { Provider } from "@/lib/types";
import { FollowUpTrack } from "./FollowUpTrack";
import { Modal } from "./Modal";
import { StatusBadge } from "./StatusBadge";

const labelCls = "font-eyebrow text-[10px] uppercase tracking-[0.18em] text-ink-soft";

function nextLabel(p: Provider): string {
  if (!p.firstContactDate) return "Sin contactar";
  if (p.followUpStep >= 3) return "Secuencia agotada";
  const next = nextFollowUpDate(p);
  const day = FOLLOWUP_DAYS[p.followUpStep + 1];
  return next ? `Día ${day} · ${formatDate(next.toISOString().slice(0, 10))}` : "—";
}

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
  const [noteText, setNoteText] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const status = followUpStatus(provider, today);
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

  const notes = [...provider.notes].sort((a, b) => a.date.localeCompare(b.date));

  async function handleAddNote() {
    const text = noteText.trim();
    if (!text) return;
    setAdding(true);
    try {
      await onAddNote(text);
      setNoteText("");
    } finally {
      setAdding(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={provider.company}>
      <div className="space-y-5">
        {/* Cabecera: estado + categoría */}
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={provider.status} />
          <span className="rounded-full bg-stone px-2 py-0.5 text-xs text-ink-soft">
            {provider.category}
          </span>
          {provider.blacklisted && (
            <span className="rounded-full bg-status-overdue/10 px-2 py-0.5 text-xs text-status-overdue">
              Blacklisteado
            </span>
          )}
        </div>

        {/* Datos de contacto */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className={labelCls}>Contacto</p>
            <p className="text-sm text-ink">{provider.contact || "—"}</p>
          </div>
          <div>
            <p className={labelCls}>Email</p>
            <p className="break-all font-mono text-sm text-ink">{provider.email}</p>
          </div>
          <div>
            <p className={labelCls}>Teléfono</p>
            <p className="font-mono text-sm text-ink">{provider.phone || "—"}</p>
          </div>
          <div>
            <p className={labelCls}>Método de Contacto</p>
            <p className="text-sm text-ink">{provider.contactMethod}</p>
          </div>
          <div>
            <p className={labelCls}>Score</p>
            <p className="font-mono text-sm text-ink">{provider.score}/5</p>
          </div>
          <div className="sm:col-span-2">
            <p className={labelCls}>Dirección</p>
            <p className="text-sm text-ink">{provider.address || "—"}</p>
          </div>
          <div className="sm:col-span-2">
            <p className={labelCls}>Website</p>
            {provider.website ? (
              <a
                href={provider.website}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all font-mono text-sm text-olive hover:underline"
              >
                {provider.website}
              </a>
            ) : (
              <p className="font-mono text-sm text-ink-soft">—</p>
            )}
          </div>
        </div>

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
                {nextLabel(provider)}
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

        {/* Notas — log cronológico solo-append */}
        <div>
          <p className={`${labelCls} mb-2`}>Notas</p>
          {notes.length === 0 ? (
            <p className="text-sm text-ink-soft">Sin notas todavía.</p>
          ) : (
            <ul className="space-y-2">
              {notes.map((n, i) => (
                <li
                  key={`${n.date}-${i}`}
                  className="rounded-control border border-line bg-surface px-3 py-2"
                >
                  <p className="font-mono text-[11px] text-ink-soft">
                    {formatDate(n.date)}
                  </p>
                  <p className="mt-0.5 text-sm text-ink">{n.text}</p>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex gap-2">
            <input
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddNote();
                }
              }}
              placeholder="Agregar una nota…"
              className="flex-1 rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-olive"
            />
            <button
              type="button"
              onClick={handleAddNote}
              disabled={adding || !noteText.trim()}
              className="rounded-control bg-olive px-3 py-2 text-sm font-medium text-stone hover:bg-olive-deep disabled:opacity-50"
            >
              Agregar
            </button>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-between border-t border-line pt-4">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-status-overdue">¿Eliminar?</span>
              <button
                type="button"
                onClick={onDelete}
                className="rounded-control bg-status-overdue px-3 py-1.5 text-xs font-medium text-white"
              >
                Sí, eliminar
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-ink-soft hover:text-ink"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-sm text-status-overdue hover:underline"
            >
              Eliminar
            </button>
          )}

          <button
            type="button"
            onClick={onEdit}
            className="rounded-control border border-olive px-4 py-2 text-sm font-medium text-olive hover:bg-olive-tint"
          >
            Editar
          </button>
        </div>
      </div>
    </Modal>
  );
}
