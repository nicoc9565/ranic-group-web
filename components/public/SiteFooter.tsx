import Link from "next/link";
import { FoliageAccent } from "./Foliage";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-gradient-to-br from-olive-deep to-forest px-6 py-12">
      <FoliageAccent className="pointer-events-none absolute -right-8 -top-10 h-40 w-44" />
      <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
        <Logo variant="dark" />
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-cream/80">
          <Link href="/#about" className="transition-colors hover:text-cream">
            About
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-cream">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-cream">
            Terms
          </Link>
        </nav>
      </div>
      <p className="relative z-10 mx-auto mt-8 max-w-5xl font-mono text-xs text-cream/60">
        RANIC GROUP LLC · Summit, NJ · +1 (201) 572-1383 · © 2026
      </p>
    </footer>
  );
}
