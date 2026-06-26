"use client";

import { FirebaseError } from "firebase/app";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

export default function AdminPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Con sesión activa, ir directo al dashboard.
  useEffect(() => {
    if (!loading && user) router.replace("/admin/dashboard");
  }, [loading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace("/admin/dashboard");
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : "";
      setError(
        code === "auth/invalid-credential" ||
          code === "auth/wrong-password" ||
          code === "auth/user-not-found"
          ? "Email o contraseña incorrectos."
          : "No se pudo iniciar sesión. Probá de nuevo.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone">
        <p className="font-mono text-sm text-ink-soft">Cargando…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-card border border-line bg-surface p-8 shadow-sm"
      >
        <p className="font-eyebrow text-[11px] uppercase tracking-[0.25em] text-ink-soft">
          Acceso · Operaciones
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-olive">
          RANIC GROUP
        </h1>
        <div className="mb-6 mt-3 h-px w-full bg-line" />

        <label
          className="mb-1 block font-eyebrow text-[11px] uppercase tracking-[0.15em] text-ink-soft"
          htmlFor="email"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-control border border-line bg-surface px-3 py-2 font-mono text-sm text-ink outline-none transition-colors focus:border-olive"
        />

        <label
          className="mb-1 block font-eyebrow text-[11px] uppercase tracking-[0.15em] text-ink-soft"
          htmlFor="password"
        >
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-control border border-line bg-surface px-3 py-2 font-mono text-sm text-ink outline-none transition-colors focus:border-olive"
        />

        {error && (
          <p className="mb-4 text-sm text-status-overdue">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-control bg-olive py-2.5 text-sm font-medium text-stone transition-colors hover:bg-olive-deep disabled:opacity-60"
        >
          {submitting ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </main>
  );
}
