"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { advanceFollowUp } from "@/lib/followup";
import { generateEmail } from "@/lib/emails";
import { generateEmailEs } from "@/lib/emailsEs";
import { todayISO } from "@/lib/format";
import { subscribeProviders, updateProvider } from "@/lib/providers";
import {
  EMAIL_TYPE_LABELS,
  type EmailType,
  type Provider,
} from "@/lib/types";

const selectCls =
  "w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-olive";
const labelCls =
  "mb-1 block font-eyebrow text-[11px] uppercase tracking-[0.15em] text-ink-soft";

const EMAIL_TYPES = Object.keys(EMAIL_TYPE_LABELS) as EmailType[];

export default function EmailsPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerId, setProviderId] = useState("");
  const [emailType, setEmailType] = useState<EmailType>("first_short");
  const [copied, setCopied] = useState(false);
  const [marking, setMarking] = useState(false);
  const [marked, setMarked] = useState(false);
  const [showEs, setShowEs] = useState(false);

  useEffect(() => subscribeProviders(setProviders), []);

  const provider = useMemo(
    () => providers.find((p) => p.id === providerId),
    [providers, providerId],
  );

  const email = useMemo(
    () => (provider ? generateEmail(emailType, provider) : ""),
    [provider, emailType],
  );

  const emailEs = useMemo(
    () => (provider ? generateEmailEs(emailType, provider) : ""),
    [provider, emailType],
  );

  async function copy() {
    if (!email) return;
    await navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function markSent() {
    if (!provider) return;
    setMarking(true);
    try {
      const patch = advanceFollowUp(provider, todayISO());
      // Primer contacto: pasar a "Contactado" si todavía no se había contactado.
      if (provider.followUpStep === -1) patch.status = "Contactado";
      await updateProvider(provider.id, patch);
      setMarked(true);
      setTimeout(() => setMarked(false), 1800);
    } finally {
      setMarking(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Generador" title="Emails" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="provider">
            Proveedor
          </label>
          <select
            id="provider"
            className={selectCls}
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
          >
            <option value="">Elegí un proveedor…</option>
            {[...providers]
              .sort((a, b) => a.company.localeCompare(b.company))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.company}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className={labelCls} htmlFor="type">
            Tipo de email
          </label>
          <select
            id="type"
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
      </div>

      <div className="mt-4">
        <label className={labelCls} htmlFor="email-output">
          Email generado (inglés)
        </label>
        <textarea
          id="email-output"
          readOnly
          value={email || "Elegí un proveedor para generar el email."}
          rows={18}
          className="w-full resize-y rounded-card border border-line bg-surface p-4 font-mono text-[13px] leading-relaxed text-ink outline-none"
        />
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={() => setShowEs((v) => !v)}
          disabled={!email}
          className="text-sm text-olive hover:underline disabled:no-underline disabled:opacity-50"
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
              value={emailEs || "Elegí un proveedor para ver la traducción."}
              rows={18}
              className="w-full resize-y rounded-card border border-dashed border-line bg-stone/40 p-4 font-mono text-[13px] leading-relaxed text-ink-soft outline-none"
            />
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copy}
          disabled={!email}
          className="rounded-control bg-olive px-4 py-2 text-sm font-medium text-stone transition-colors hover:bg-olive-deep disabled:opacity-50"
        >
          {copied ? "Copiado ✓" : "Copiar email"}
        </button>
        <button
          type="button"
          onClick={markSent}
          disabled={!provider || marking}
          className="rounded-control border border-olive px-4 py-2 text-sm font-medium text-olive transition-colors hover:bg-olive-tint disabled:opacity-50"
        >
          {marking ? "Guardando…" : marked ? "Marcado ✓" : "Marcar como enviado"}
        </button>
      </div>
    </>
  );
}
