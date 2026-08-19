"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ProviderDetail } from "@/components/ProviderDetail";
import { ProviderForm, type ProviderFormValues } from "@/components/ProviderForm";
import { ProviderTable } from "@/components/ProviderTable";
import {
  addBlacklistEntry,
  removeBlacklistEntry,
  subscribeBlacklist,
} from "@/lib/blacklist";
import { CONTACT_STAGE_LABELS, type ContactStage } from "@/lib/contactStage";
import { todayISO } from "@/lib/format";
import {
  addNote,
  addProvider,
  deleteProvider,
  setBlacklisted,
  updateProvider,
} from "@/lib/providers";
import { blacklistPatch } from "@/lib/outreachPatches";
import {
  ALL_STAGES,
  countByStage,
  fetchProviderById,
  fetchProviderPage,
} from "@/lib/providersQuery";
import {
  CATEGORIES,
  type BlacklistEntry,
  type Category,
  type Provider,
} from "@/lib/types";
import type { DocumentSnapshot } from "firebase/firestore";

const selectCls =
  "rounded-control border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-olive";

export default function ProveedoresPage() {
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);

  const [stage, setStage] = useState<ContactStage>("sin-contactar");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Category | "">("");

  const [rows, setRows] = useState<Provider[]>([]);
  const [cursor, setCursor] = useState<DocumentSnapshot | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [counts, setCounts] = useState<{
    total: number;
    byStage: Record<ContactStage, number>;
  } | null>(null);

  const [detailId, setDetailId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("id"),
  );
  const [fetchedDetail, setFetchedDetail] = useState<Provider | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);

  useEffect(() => subscribeBlacklist(setBlacklist), []);

  // Los contadores se piden una vez al montar: son 8 agregaciones, del orden de 20 lecturas.
  useEffect(() => {
    let cancelled = false;
    countByStage(today, categoryFilter).then((c) => {
      if (!cancelled) setCounts(c);
    });
    return () => {
      cancelled = true;
    };
  }, [today, categoryFilter]);

  // Debounce de la busqueda: sin esto cada tecla dispara una query a Firestore.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Primera pagina de la etapa activa. Cambiar de etapa o de busqueda resetea el cursor.
  //
  // `loading` se DERIVA de comparar la consulta pedida contra la ultima que respondio, en vez de
  // ser un estado que se prende a mano al entrar al effect. Ademas de evitar el setState
  // sincrono, no puede quedarse colgado en true si una respuesta se descarta por cancelled.
  const queryKey = `${stage}|${debouncedSearch}|${categoryFilter}`;
  const loading = loadedKey !== queryKey;

  useEffect(() => {
    let cancelled = false;
    fetchProviderPage({
      stage,
      search: debouncedSearch,
      category: categoryFilter,
      today,
    }).then((page) => {
      if (cancelled) return;
      setRows(page.rows);
      setCursor(page.cursor);
      setLoadedKey(`${stage}|${debouncedSearch}|${categoryFilter}`);
    });
    return () => {
      cancelled = true;
    };
  }, [stage, debouncedSearch, categoryFilter, today]);

  const loadingMore = useRef(false);
  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore.current) return;
    loadingMore.current = true;
    try {
      const page = await fetchProviderPage({
        stage,
        search: debouncedSearch,
        category: categoryFilter,
        today,
        cursor,
      });
      setRows((prev) => [...prev, ...page.rows]);
      setCursor(page.cursor);
    } finally {
      loadingMore.current = false;
    }
  }, [cursor, stage, debouncedSearch, categoryFilter, today]);

  // El proveedor abierto se DERIVA, no se sincroniza con un effect: si esta en la pagina cargada
  // se usa esa copia (que se refresca sola al recargar), y si no, la que se trajo por id.
  const detailProvider = detailId
    ? (rows.find((p) => p.id === detailId) ??
      (fetchedDetail?.id === detailId ? fetchedDetail : null))
    : null;

  // Viniendo de ?id= el proveedor puede no estar en la pagina cargada: se trae puntualmente.
  useEffect(() => {
    if (!detailId || rows.some((p) => p.id === detailId)) return;
    let cancelled = false;
    fetchProviderById(detailId).then((p) => {
      if (!cancelled) setFetchedDetail(p);
    });
    return () => {
      cancelled = true;
    };
  }, [detailId, rows]);

  const editingProvider = editId ? rows.find((p) => p.id === editId) : undefined;

  function openNew() {
    setEditId(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditId(null);
  }

  /** Tras escribir, la fila puede cambiar de etapa: se recargan pagina y contadores. */
  const refresh = useCallback(async () => {
    const [page, c] = await Promise.all([
      fetchProviderPage({
        stage,
        search: debouncedSearch,
        category: categoryFilter,
        today,
      }),
      countByStage(today, categoryFilter),
    ]);
    setRows(page.rows);
    setCursor(page.cursor);
    setCounts(c);
  }, [stage, debouncedSearch, categoryFilter, today]);

  /**
   * Blacklistear: el proveedor MÁS la entrada en la colección `blacklist`, que es la que dispara
   * el aviso al cargar otro proveedor con ese nombre. Sin la entrada, blacklistear a uno no
   * protege del duplicado.
   *
   * Los campos del proveedor los escribe setBlacklisted, que es el único camino: acá no se toca
   * `blacklisted` a mano.
   */
  async function toggleBlacklist(p: Provider, blacklisted: boolean) {
    await setBlacklisted(p.id, blacklisted);

    const match = blacklist.find(
      (b) => b.name.trim().toLowerCase() === p.company.trim().toLowerCase(),
    );
    if (blacklisted && !match) await addBlacklistEntry(p.company);
    if (!blacklisted && match) await removeBlacklistEntry(match.id);

    await refresh();
  }

  /**
   * Guardar desde el formulario.
   *
   * `blacklisted` se saca del patch general y va por setBlacklisted: marcar son cuatro campos, no
   * uno, y el checkbox escribiéndolo solo dejaba al proveedor invisible en la pantalla y vivo
   * para el cron de envío al mismo tiempo.
   */
  async function handleSave(values: ProviderFormValues) {
    const { blacklisted, ...rest } = values;
    if (editId) {
      await updateProvider(editId, rest);
      const antes = rows.find((p) => p.id === editId)?.blacklisted ?? false;
      if (blacklisted !== antes) await setBlacklisted(editId, blacklisted);
    } else {
      await addProvider({
        ...rest,
        ...blacklistPatch(blacklisted),
        firstContactDate: null,
        lastEmailDate: null,
        followUpStep: -1,
        notes: [],
      });
    }
    await refresh();
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

      {/* Contadores por etapa. Suman el total porque las etapas son mutuamente excluyentes:
          computeBucket devuelve exactamente una. */}
      <div className="mb-4 flex flex-wrap gap-2">
        <StageChip label="Total" value={counts?.total} active={false} />
        {ALL_STAGES.map((s) => (
          <StageChip
            key={s}
            label={CONTACT_STAGE_LABELS[s]}
            value={counts?.byStage[s]}
            active={stage === s}
            onClick={() => setStage(s)}
          />
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por empresa (empieza con)"
          className="min-w-[12rem] flex-1 rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-olive"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as Category | "")}
          className={selectCls}
          aria-label="Filtrar por categoria"
        >
          <option value="">Todas las categorias</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="font-mono text-sm text-ink-soft">Cargando...</p>
      ) : (
        <>
          <ProviderTable
            providers={rows}
            today={today}
            onRowClick={(p) => setDetailId(p.id)}
          />

          {cursor && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={loadMore}
                className="rounded-control border border-olive px-4 py-2 text-sm font-medium text-olive transition-colors hover:bg-olive/10"
              >
                Cargar mas ({rows.length} de {counts?.byStage[stage] ?? "..."})
              </button>
            </div>
          )}
        </>
      )}

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
            await refresh();
          }}
          onResumeFollowUp={async () => {
            await updateProvider(detailProvider.id, { followUpStopped: false });
            await refresh();
          }}
          onStartFollowUp={async (patch) => {
            await updateProvider(detailProvider.id, patch);
            await refresh();
          }}
          onToggleOptOut={async (optedOut) => {
            await updateProvider(detailProvider.id, { optedOut });
            await refresh();
          }}
          onToggleBlacklist={(blacklisted) =>
            toggleBlacklist(detailProvider, blacklisted)
          }
          onMarkEmailSent={async (patch) => {
            await updateProvider(detailProvider.id, patch);
            await refresh();
          }}
        />
      )}
    </>
  );
}

function StageChip({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number | undefined;
  active: boolean;
  onClick?: () => void;
}) {
  const base = "rounded-control border px-3 py-1.5 text-left transition-colors";
  const cls = onClick
    ? active
      ? "border-olive bg-olive/10"
      : "border-line bg-surface hover:border-olive"
    : "border-line bg-stone/40 cursor-default";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`${base} ${cls}`}
    >
      <span className="block font-eyebrow text-[10px] uppercase tracking-[0.15em] text-ink-soft">
        {label}
      </span>
      <span className="block font-display text-lg font-bold tabular-nums text-ink">
        {value ?? "—"}
      </span>
    </button>
  );
}
