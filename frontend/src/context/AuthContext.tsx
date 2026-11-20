import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { api } from "../api/client";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: Record<string, unknown>) => Promise<User>;
  logout: () => void;
  /** Replace the signed-in user (after a profile update) or sign in with a token (after a password reset). */
  setSession: (u: User, token?: string) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the session on page reload.
  useEffect(() => {
    if (!localStorage.getItem("token")) return setLoading(false);
    api
      .get("/auth/me")
      .then((res) => setUser(res.data.user))
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, []);

  const save = (token: string, u: User) => {
    localStorage.setItem("token", token);
    setUser(u);
    return u;
  };

  const login = async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    return save(res.data.token, res.data.user);
  };

  const register = async (data: Record<string, unknown>) => {
    const res = await api.post("/auth/register", data);
    return save(res.data.token, res.data.user);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  const setSession = (u: User, token?: string) => {
    if (token) localStorage.setItem("token", token);
    setUser(u);
  };

  return <AuthContext.Provider value={{ user, loading, login, register, logout, setSession }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
