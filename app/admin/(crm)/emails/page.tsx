import { Suspense } from "react";
import { EmailsPageContent } from "./EmailsPageContent";

export default function EmailsPage() {
  return (
    <Suspense
      fallback={<p className="font-mono text-sm text-ink-soft">Cargando…</p>}
    >
      <EmailsPageContent />
    </Suspense>
  );
}
