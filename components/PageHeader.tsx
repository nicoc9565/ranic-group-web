import type { ReactNode } from "react";

/** Encabezado de sección: eyebrow (etiqueta de almacén) + título display, con slot de acciones. */
export function PageHeader({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: string;
  title: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="font-eyebrow text-[11px] uppercase tracking-[0.2em] text-ink-soft">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">
          {title}
        </h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
