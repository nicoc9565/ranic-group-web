"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavItem = { href: string; label: string; icon: ReactNode };

// Iconos line-art compactos (operations console). 20x20, currentColor.
const icons = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  providers: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="M3.3 7 12 12l8.7-5M12 22V12" />
    </svg>
  ),
  followups: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
      <path d="M7 12h3M14 12h3" />
    </svg>
  ),
  emails: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  ),
  blacklist: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </svg>
  ),
  expo: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M3 7a2 2 0 0 1 2-2h9l7 7-9 9-9-9V7Z" />
      <circle cx="8" cy="10" r="1.3" />
    </svg>
  ),
  finanzas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
};

const NAV: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: icons.dashboard },
  { href: "/admin/proveedores", label: "Proveedores", icon: icons.providers },
  { href: "/admin/follow-ups", label: "Follow-ups", icon: icons.followups },
  { href: "/admin/emails", label: "Emails", icon: icons.emails },
  { href: "/admin/blacklist", label: "Blacklist", icon: icons.blacklist },
  { href: "/admin/expo-west", label: "Expo West", icon: icons.expo },
  { href: "/admin/finanzas", label: "Finanzas", icon: icons.finanzas },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav({
  userName,
  onLogout,
}: {
  userName: string;
  onLogout: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Sidebar — desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-olive-deep text-olive-tint md:flex">
        <div className="px-5 py-5">
          <p className="font-eyebrow text-[10px] uppercase tracking-[0.3em] text-olive-tint/60">
            CRM · Operaciones
          </p>
          <p className="mt-1 font-display text-lg font-bold tracking-tight text-white">
            RANIC GROUP
          </p>
        </div>

        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-control border-l-2 px-3 py-2 text-sm transition-colors ${
                  active
                    ? "border-white bg-olive text-white"
                    : "border-transparent text-olive-tint/85 hover:bg-olive/50 hover:text-white"
                }`}
              >
                <span className="h-5 w-5 shrink-0">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-5 py-4">
          <p className="font-eyebrow text-[10px] uppercase tracking-[0.2em] text-olive-tint/60">
            Sesión
          </p>
          <p className="mt-0.5 truncate font-mono text-sm text-white">{userName}</p>
          <button
            type="button"
            onClick={onLogout}
            className="mt-2 text-xs text-olive-tint/80 underline-offset-2 hover:text-white hover:underline"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Top bar — mobile */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-olive-deep px-4 text-white md:hidden">
        <p className="font-display text-base font-bold tracking-tight">RANIC GROUP</p>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-olive-tint/85">{userName}</span>
          <button
            type="button"
            onClick={onLogout}
            className="text-xs text-olive-tint/80 hover:text-white"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Bottom nav — mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-7 border-t border-line bg-olive-deep text-olive-tint md:hidden">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2 text-[10px] transition-colors ${
                active ? "text-white" : "text-olive-tint/70 hover:text-white"
              }`}
            >
              <span className="h-5 w-5">{item.icon}</span>
              <span className="leading-none">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
