"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { bulkMarkContacted, subscribeExpo } from "@/lib/expo";
import { formatDate } from "@/lib/format";
import type { ExpoProspect } from "@/lib/types";

const EXPO_CATEGORIES = [
  "Cosmetics & Personal Care",
  "Pet Products",
  "Home Products",
];

const selectCls =
  "rounded-control border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-olive";

const CSV_HEADERS: (keyof ExpoProspect)[] = [
  "company",
  "brands",
  "category",
  "city",
  "state",
  "website",
  "email",
  "mailSent",
  "dateSent",
  "response",
  "notes",
];

function toCSV(rows: ExpoProspect[]): string {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [CSV_HEADERS.join(",")];
  for (const r of rows) lines.push(CSV_HEADERS.map((h) => esc(r[h])).join(","));
  return lines.join("\r\n");
}

export default function ExpoWestPage() {
  const [prospects, setProspects] = useState<ExpoProspect[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [marking, setMarking] = useState(false);

  useEffect(
    () =>
      subscribeExpo((list) => {
        setProspects(list);
        setLoaded(true);
      }),
    [],
  );

  const filtered = useMemo(() => {
    return prospects
      .filter((p) => !categoryFilter || p.category === categoryFilter)
      .sort((a, b) => a.company.localeCompare(b.company));
  }, [prospects, categoryFilter]);

  // Limpiar selección de ids que ya no están en la lista filtrada.
  const filteredIds = useMemo(() => new Set(filtered.map((p) => p.id)), [filtered]);
  const selectedInView = useMemo(
    () => [...selected].filter((id) => filteredIds.has(id)),
    [selected, filteredIds],
  );
  const allSelected = filtered.length > 0 && selectedInView.length === filtered.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(filtered.map((p) => p.id)));
  }

  async function markContacted() {
    if (selectedInView.length === 0) return;
    setMarking(true);
    try {
      await bulkMarkContacted(selectedInView);
      setSelected(new Set());
    } finally {
      setMarking(false);
    }
  }

  function exportCSV() {
    const blob = new Blob([toCSV(filtered)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "expo-west-prospectos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        eyebrow="Prospectos 2026"
        title="Expo West"
        actions={
          <button
            type="button"
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="rounded-control border border-olive px-3 py-2 text-sm font-medium text-olive transition-colors hover:bg-olive-tint disabled:opacity-50"
          >
            Exportar CSV
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className={selectCls}
          aria-label="Filtrar por categoría"
        >
          <option value="">Todas las categorías</option>
          {EXPO_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="font-mono text-sm text-ink-soft">
          {filtered.length} prospectos
        </span>
        {selectedInView.length > 0 && (
          <button
            type="button"
            onClick={markContacted}
            disabled={marking}
            className="ml-auto rounded-control bg-olive px-3 py-2 text-sm font-medium text-stone transition-colors hover:bg-olive-deep disabled:opacity-60"
          >
            {marking
              ? "Guardando…"
              : `Marcar como contactado (${selectedInView.length})`}
          </button>
        )}
      </div>

      {!loaded ? (
        <p className="font-mono text-sm text-ink-soft">Cargando…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface px-4 py-10 text-center">
          <p className="text-sm text-ink">No hay prospectos.</p>
          <p className="mt-1 text-xs text-ink-soft">
            Corré el import (npm run import-expo) para cargar los ~112 de Expo West.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Seleccionar todos"
                    className="h-4 w-4 accent-olive"
                  />
                </th>
                {[
                  "Empresa",
                  "Marcas",
                  "Categoría",
                  "Ciudad",
                  "Estado",
                  "Contactado",
                  "Fecha",
                ].map((h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap px-3 py-2.5 font-eyebrow text-[10px] uppercase tracking-[0.15em] text-ink-soft"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className={`border-b border-line last:border-0 transition-colors hover:bg-olive-tint/60 ${
                    selected.has(p.id) ? "bg-olive-tint/50" : ""
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                      aria-label={`Seleccionar ${p.company}`}
                      className="h-4 w-4 accent-olive"
                    />
                  </td>
                  <td className="px-3 py-2.5 font-medium text-ink">{p.company}</td>
                  <td className="max-w-[12rem] truncate px-3 py-2.5 text-ink-soft">
                    {p.brands || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-ink-soft">
                    {p.category}
                  </td>
                  <td className="px-3 py-2.5 text-ink-soft">{p.city || "—"}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-ink-soft">
                    {p.state || "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    {p.mailSent ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-olive-tint px-2 py-0.5 text-xs text-olive-deep">
                        <span className="h-1.5 w-1.5 rounded-full bg-status-ontrack" />
                        Sí
                      </span>
                    ) : (
                      <span className="text-xs text-ink-soft">No</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-ink-soft">
                    {formatDate(p.dateSent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
