export function PurchaseOrderCard() {
  return (
    <div className="animate-po-card-in rounded-card border border-kraft bg-kraft/40 p-6 font-mono text-sm text-ink shadow-sm">
      <p className="mb-3 text-xs uppercase tracking-[0.2em] text-ink-soft">
        Purchase Order
      </p>
      <div className="space-y-2 border-t border-ink/10 pt-3">
        <p>
          <span className="text-ink-soft">BUYER:</span> RANIC GROUP LLC
        </p>
        <p>
          <span className="text-ink-soft">TERMS:</span> NET 30
        </p>
        <p className="flex items-center gap-3">
          <span className="text-ink-soft">STATUS:</span>
          <span className="animate-stamp-in inline-block -rotate-6 rounded border-2 border-stamp px-3 py-1 font-display text-xs font-bold uppercase tracking-wider text-stamp">
            Aprobado
          </span>
        </p>
      </div>
    </div>
  );
}
