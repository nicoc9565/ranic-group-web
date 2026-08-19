"use client";

import { useMemo, useState } from "react";
import { generateEmail } from "@/lib/emails";
import { generateEmailEs } from "@/lib/emailsEs";
import { advanceFollowUp } from "@/lib/followup";
import { todayISO } from "@/lib/format";
import { EMAIL_TYPE_LABELS, type EmailType, type Provider } from "@/lib/types";

const selectCls =
  "w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-olive";
const labelCls =
  "mb-1 block font-eyebrow text-[11px] uppercase tracking-[0.15em] text-ink-soft";

const EMAIL_TYPES = Object.keys(EMAIL_TYPE_LABELS) as EmailType[];

/** Tipo de email sugerido según dónde está el proveedor en la secuencia. */
function suggestedType(p: Provider): EmailType {
  if (p.followUpStep === -1) return "first_short";
  if (p.followUpStep === 0) return "followup_4";
  if (p.followUpStep === 1) return "followup_7";
  return "last_attempt_12";
}

/**
 * Generador de emails de un proveedor concreto.
 *
 * Es lo que era /admin/emails sin el `<select>` de proveedor: elegir de una lista de 2500 no
 * tenía sentido, y el proveedor ya está en pantalla cuando abrís su ficha.
 *
 * El generador NO se elimina junto con la pantalla: el envío automático manda solo el primer
 * contacto, y los templates de catálogo, aprobación y aclaración son exactamente lo que hace
 * falta cuando un proveedor responde — que es el punto de toda la campaña.
 */
export function ProviderEmailComposer({
  provider,
  onMarkSent,
}: {
  provider: Provider;
  onMarkSent: (patch: Partial<Provider>) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [emailType, setEmailType] = useState<EmailType>(() => suggestedType(provider));
  const [copied, setCopied] = useState(false);
  const [marking, setMarking] = useState(false);
  const [marked, setMarked] = useState(false);
  const [showEs, setShowEs] = useState(false);

  const email = useMemo(
    () => generateEmail(emailType, provider),
    [emailType, provider],
  );
  const emailEs = useMemo(
    () => generateEmailEs(emailType, provider),
    [emailType, provider],
  );

  async function copy() {
    // Texto plano a propósito (regla de dominio): pegar HTML en Gmail arrastra formato.
    await navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function markSent() {
    setMarking(true);
    try {
      const patch = advanceFollowUp(provider, todayISO());
      // Primer contacto: pasar a "Contactado" si todavía no se había contactado.
      if (provider.followUpStep === -1) patch.status = "Contactado";
      await onMarkSent(patch);
      setMarked(true);
      setTimeout(() => setMarked(false), 1800);
    } finally {
      setMarking(false);
    }
  }

  return (
    <div className="rounded-card border border-line bg-stone/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="text-sm font-medium text-ink">Redactar email</span>
        <span className="font-mono text-xs text-ink-soft">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="border-t border-line p-3">
          <div>
            <label className={labelCls} htmlFor="composer-type">
              Tipo de email
            </label>
            <select
              id="composer-type"
              className={selectCls}
              value={emailType}
              onChange={(e) => setEmailType(e.target.value as EmailType)}
            >
              {EMAIL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EMAIL_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3">
            <label className={labelCls} htmlFor="composer-output">
              Email generado (inglés)
            </label>
            <textarea
              id="composer-output"
              readOnly
              value={email}
              rows={16}
              className="w-full resize-y rounded-card border border-line bg-surface p-3 font-mono text-[13px] leading-relaxed text-ink outline-none"
            />
          </div>

          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowEs((v) => !v)}
              className="text-sm text-olive hover:underline"
            >
              {showEs ? "Ocultar traducción" : "Ver traducción (referencia)"}
            </button>
            {showEs && (
              <div className="mt-2">
                <p className="mb-1 text-xs text-ink-soft">
                  Traducción de referencia — copiá y enviá siempre el texto en inglés de
                  arriba.
                </p>
                <textarea
                  readOnly
                  aria-label="Traducción de referencia en español"
                  value={emailEs}
                  rows={16}
                  className="w-full resize-y rounded-card border border-dashed border-line bg-stone/40 p-3 font-mono text-[13px] leading-relaxed text-ink-soft outline-none"
                />
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copy}
              className="rounded-control bg-olive px-4 py-2 text-sm font-medium text-stone transition-colors hover:bg-olive-deep"
            >
              {copied ? "Copiado ✓" : "Copiar email"}
            </button>
            <button
              type="button"
              onClick={markSent}
              disabled={marking}
              className="rounded-control border border-olive px-4 py-2 text-sm font-medium text-olive transition-colors hover:bg-olive-tint disabled:opacity-50"
            >
              {marking ? "Guardando…" : marked ? "Marcado ✓" : "Marcar como enviado"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
