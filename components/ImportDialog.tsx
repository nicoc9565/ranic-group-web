"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "./Modal";

type Phase = "idle" | "preview" | "writing" | "done";

export function ImportDialog<T>({
  open,
  onClose,
  title,
  accept,
  parse,
  renderPreview,
  canConfirm,
  checkDuplicate,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  accept: string;
  parse: (text: string) => T;
  renderPreview: (parsed: T) => ReactNode;
  canConfirm: (parsed: T) => boolean;
  checkDuplicate: (parsed: T) => Promise<boolean>;
  onConfirm: (parsed: T, replace: boolean) => Promise<void>;
}) {
  const [parsed, setParsed] = useState<T | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [replace, setReplace] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");

  function reset() {
    setParsed(null);
    setDuplicate(false);
    setReplace(false);
    setError(null);
    setPhase("idle");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFile(file: File) {
    setError(null);
    try {
      const text = await file.text();
      const result = parse(text);
      setParsed(result);
      setPhase("preview");
      setDuplicate(await checkDuplicate(result));
    } catch {
      setParsed(null);
      setPhase("idle");
      setError("No se pudo leer el archivo. ¿Es el informe correcto?");
    }
  }

  async function handleConfirm() {
    if (!parsed) return;
    setPhase("writing");
    setError(null);
    try {
      await onConfirm(parsed, replace);
      setPhase("done");
    } catch {
      setPhase("preview");
      setError("No se pudo guardar. Probá de nuevo.");
    }
  }

  const confirmDisabled =
    !parsed || !canConfirm(parsed) || (duplicate && !replace) || phase === "writing";

  return (
    <Modal open={open} onClose={handleClose} title={title}>
      {phase === "done" ? (
        <div className="space-y-4">
          <p className="text-sm text-ink">✓ Importación completa.</p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-control bg-olive px-4 py-2 text-sm font-medium text-stone transition-colors hover:bg-olive-deep"
            >
              Listo
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <input
            type="file"
            accept={accept}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
            className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-control file:border-0 file:bg-olive file:px-3 file:py-2 file:text-sm file:font-medium file:text-stone hover:file:bg-olive-deep"
          />

          {error && <p className="text-sm text-status-overdue">{error}</p>}

          {parsed && (
            <>
              <div className="rounded-card border border-line bg-surface p-4 text-sm">
                {renderPreview(parsed)}
              </div>

              {!canConfirm(parsed) && (
                <p className="text-sm text-status-overdue">
                  Los números no reconcilian con el total del archivo. No se puede importar.
                </p>
              )}

              {duplicate && (
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={replace}
                    onChange={(e) => setReplace(e.target.checked)}
                  />
                  Ya está importado. Reemplazar lo anterior.
                </label>
              )}

              <div className="flex justify-end gap-2 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-control px-4 py-2 text-sm text-ink-soft hover:text-ink"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={confirmDisabled}
                  className="rounded-control bg-olive px-4 py-2 text-sm font-medium text-stone transition-colors hover:bg-olive-deep disabled:opacity-60"
                >
                  {phase === "writing" ? "Importando…" : "Confirmar importación"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
