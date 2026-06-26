"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Nav } from "@/components/Nav";
import { displayName, useAuth } from "@/lib/auth";

export default function CrmLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  // Guard: sin sesión, volver al login.
  useEffect(() => {
    if (!loading && !user) router.replace("/admin");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone">
        <p className="font-mono text-sm text-ink-soft">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone">
      <Nav userName={displayName(user.email)} onLogout={logout} />
      <main className="pb-24 pt-14 md:pb-0 md:pl-60 md:pt-0">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>
    </div>
  );
}
