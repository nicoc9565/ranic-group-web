"use client";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { auth } from "./firebase";

// Mapeo email → nombre para mostrar en la UI (no hay colección `users`).
// Las claves deben ir en minúsculas.
export const USER_NAMES: Record<string, string> = {
  "nicolas.conti@ranicgroup.com": "Nico",
  "info@ranicgroup.com": "César",
};

/** Nombre a mostrar para un email; si no está mapeado, usa el local-part del email. */
export function displayName(email: string | null | undefined): string {
  if (!email) return "";
  return USER_NAMES[email.toLowerCase()] ?? email.split("@")[0];
}

type AuthValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // La persistencia local de Firebase Auth mantiene la sesión hasta logout manual.
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
