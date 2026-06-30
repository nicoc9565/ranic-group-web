"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ProviderDetail } from "@/components/ProviderDetail";
import { ProviderForm, type ProviderFormValues } from "@/components/ProviderForm";
import { ProviderTable } from "@/components/ProviderTable";
import { subscribeBlacklist } from "@/lib/blacklist";
import { todayISO } from "@/lib/format";
import {
  addNote,
  addProvider,
  deleteProvider,
  subscribeProviders,
  updateProvider,
} from "@/lib/providers";
import {
  CATEGORIES,
  STATUSES,
  type BlacklistEntry,
  type Category,
  type Provider,
  type Status,
} from "@/lib/types";

const selectCls =
  "rounded-control border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-olive";

export default function ProveedoresPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "">("");
  const [categoryFilter, setCategoryFilter] = useState<Category | "">("");

  const [detailId, setDetailId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => subscribeProviders(setProviders), []);
  useEffect(() => subscribeBlacklist(setBlacklist), []);

  // Abrir el detalle si venimos con ?id=… (link desde el dashboard).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) setDetailId(id);
  }, []);

  const today = useMemo(() => new Date(), []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return providers
      .filter((p) => {
        if (statusFilter && p.status !== statusFilter) return false;
        if (categoryFilter && p.category !== categoryFilter) return false;
        if (
          q &&
          !p.company.toLowerCase().includes(q) &&
          !p.contact.toLowerCase().includes(q)
        )
          return false;
        return true;
      })
      .sort((a, b) => a.company.localeCompare(b.company));
  }, [providers, search, statusFilter, categoryFilter]);

  const detailProvider = detailId
    ? providers.find((p) => p.id === detailId) ?? null
    : null;
  const editingProvider = editId
    ? providers.find((p) => p.id === editId)
    : undefined;

  // Si el proveedor abierto en detalle se borró, cerrar el detalle.
  useEffect(() => {
    if (detailId && !providers.some((p) => p.id === detailId)) setDetailId(null);
  }, [detailId, providers]);

  function openNew() {
    setEditId(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditId(null);
  }

  async function handleSave(values: ProviderFormValues) {
    if (editId) {
      await updateProvider(editId, values);
    } else {
      await addProvider({
        ...values,
        firstContactDate: null,
        lastEmailDate: null,
        followUpStep: -1,
        notes: [],
      });
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Pipeline"
        title="Proveedores"
        actions={
          <button
            type="button"
            onClick={openNew}
            className="rounded-control bg-olive px-3 py-2 text-sm font-medium text-stone transition-colors hover:bg-olive-deep"
          >
            Nuevo proveedor
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por empresa o contacto…"
          className="min-w-[12rem] flex-1 rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-olive"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as Status | "")}
          className={selectCls}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as Category | "")}
          className={selectCls}
          aria-label="Filtrar por categoría"
        >
          <option value="">Todas las categorías</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <ProviderTable
        providers={filtered}
        today={today}
        onRowClick={(p) => setDetailId(p.id)}
      />

      <ProviderForm
        open={formOpen}
        onClose={closeForm}
        initial={editingProvider}
        blacklist={blacklist}
        onSave={handleSave}
      />

      {detailProvider && (
        <ProviderDetail
          provider={detailProvider}
          today={today}
          onClose={() => setDetailId(null)}
          onEdit={() => {
            setEditId(detailProvider.id);
            setDetailId(null);
            setFormOpen(true);
          }}
          onAddNote={(text) =>
            addNote(detailProvider.id, { date: todayISO(), text })
          }
          onDelete={async () => {
            await deleteProvider(detailProvider.id);
            setDetailId(null);
          }}
          onResumeFollowUp={() =>
            updateProvider(detailProvider.id, { followUpStopped: false })
          }
          onStartFollowUp={(patch) => updateProvider(detailProvider.id, patch)}
        />
      )}
    </>
  );
}
