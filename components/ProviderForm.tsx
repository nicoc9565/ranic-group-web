"use client";

import { useEffect, useState } from "react";
import { isBlacklisted } from "@/lib/blacklist";
import {
  CATEGORIES,
  STATUSES,
  type BlacklistEntry,
  type Category,
  type Provider,
  type Status,
} from "@/lib/types";
import { Modal } from "./Modal";

export type ProviderFormValues = {
  company: string;
  contact: string;
  email: string;
  category: Category;
  status: Status;
  website: string;
  blacklisted: boolean;
};

const inputCls =
  "w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-olive";
const labelCls =
  "mb-1 block font-eyebrow text-[11px] uppercase tracking-[0.15em] text-ink-soft";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emptyValues(): ProviderFormValues {
  return {
    company: "",
    contact: "",
    email: "",
    category: CATEGORIES[0],
    status: STATUSES[0],
    website: "",
    blacklisted: false,
  };
}

export function ProviderForm({
  open,
  onClose,
  initial,
  blacklist,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Provider;
  blacklist: BlacklistEntry[];
  onSave: (values: ProviderFormValues) => Promise<void> | void;
}) {
  const [values, setValues] = useState<ProviderFormValues>(emptyValues);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Sincronizar el form al abrir / cambiar el proveedor en edición.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setValues(
      initial
        ? {
            company: initial.company,
            contact: initial.contact,
            email: initial.email,
            category: initial.category,
            status: initial.status,
            website: initial.website,
            blacklisted: initial.blacklisted,
          }
        : emptyValues(),
    );
  }, [open, initial]);

  const blacklistHit =
    values.company.trim().length > 0 && isBlacklisted(values.company, blacklist);

  function set<K extends keyof ProviderFormValues>(
    key: K,
    val: ProviderFormValues[K],
  ) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!values.company.trim()) return setError("La empresa es obligatoria.");
    if (!EMAIL_RE.test(values.email.trim()))
      return setError("Ingresá un email válido.");
    setSaving(true);
    try {
      await onSave({
        ...values,
        company: values.company.trim(),
        contact: values.contact.trim(),
        email: values.email.trim(),
        website: values.website.trim(),
      });
      onClose();
    } catch {
      setError("No se pudo guardar. Probá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Editar proveedor" : "Nuevo proveedor"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls} htmlFor="company">
            Empresa
          </label>
          <input
            id="company"
            className={inputCls}
            value={values.company}
            onChange={(e) => set("company", e.target.value)}
            required
          />
          {blacklistHit && (
            <p className="mt-1.5 rounded-control bg-status-overdue/10 px-2 py-1 text-xs text-status-overdue">
              ⚠ El nombre coincide con la blacklist. No se debería contactar ni
              recomendar.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="contact">
              Contacto
            </label>
            <input
              id="contact"
              className={inputCls}
              value={values.contact}
              onChange={(e) => set("contact", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className={`${inputCls} font-mono`}
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="category">
              Categoría
            </label>
            <select
              id="category"
              className={inputCls}
              value={values.category}
              onChange={(e) => set("category", e.target.value as Category)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="status">
              Estado
            </label>
            <select
              id="status"
              className={inputCls}
              value={values.status}
              onChange={(e) => set("status", e.target.value as Status)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="website">
            Website
          </label>
          <input
            id="website"
            className={`${inputCls} font-mono`}
            value={values.website}
            onChange={(e) => set("website", e.target.value)}
            placeholder="https://…"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={values.blacklisted}
            onChange={(e) => set("blacklisted", e.target.checked)}
            className="h-4 w-4 accent-olive"
          />
          Marcar como blacklisteado (no recomendar)
        </label>

        {error && <p className="text-sm text-status-overdue">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-control px-4 py-2 text-sm text-ink-soft hover:text-ink"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-control bg-olive px-4 py-2 text-sm font-medium text-stone transition-colors hover:bg-olive-deep disabled:opacity-60"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
