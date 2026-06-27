import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-line px-6 py-8">
      <p className="mx-auto max-w-5xl text-center font-mono text-xs text-ink-soft">
        RANIC GROUP LLC · Summit, NJ · +1 (201) 572-1383 ·{" "}
        <Link href="/privacy" className="underline hover:text-ink">
          Privacidad
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="underline hover:text-ink">
          Términos
        </Link>
      </p>
    </footer>
  );
}
