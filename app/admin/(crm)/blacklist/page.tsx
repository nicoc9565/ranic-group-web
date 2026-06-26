"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { subscribeBlacklist } from "@/lib/blacklist";
import type { BlacklistEntry } from "@/lib/types";

export default function BlacklistPage() {
  const [entries, setEntries] = useState<BlacklistEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

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

      {!loaded ? (
        <p className="font-mono text-sm text-ink-soft">Cargando…</p>
      ) : sorted.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-surface px-4 py-10 text-center">
          <p className="text-sm text-ink">La blacklist está vacía.</p>
          <p className="mt-1 text-xs text-ink-soft">
            Corré el seed para cargar las 25 empresas.
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
              <span className="text-sm text-ink">{e.name}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
