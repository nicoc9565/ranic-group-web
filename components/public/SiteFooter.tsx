import Link from "next/link";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="bg-olive-deep px-6 py-10">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
        <Logo variant="dark" />
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-stone/80">
          <a href="#about" className="transition-colors hover:text-stone">
            About
          </a>
          <Link href="/privacy" className="transition-colors hover:text-stone">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-stone">
            Terms
          </Link>
        </nav>
      </div>
      <p className="mx-auto mt-6 max-w-5xl font-mono text-xs text-stone/60">
        RANIC GROUP LLC · Summit, NJ · +1 (201) 572-1383 · © 2026
      </p>
    </footer>
  );
}
