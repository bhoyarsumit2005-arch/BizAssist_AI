import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import api from "../services/api";

const AuthContext = createContext(null);

const readStored = (key) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStored("bizassist:user"));
  const [business, setBusiness] = useState(() => readStored("bizassist:business"));
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("bizassist:user");
    localStorage.removeItem("bizassist:business");
    setUser(null);
    setBusiness(null);
  }, []);

  const persistSession = useCallback((payload) => {
    if (payload.token) localStorage.setItem("token", payload.token);
    if (payload.user) {
      localStorage.setItem("bizassist:user", JSON.stringify(payload.user));
      setUser(payload.user);
    }
    if (payload.business !== undefined) {
      if (payload.business) {
        localStorage.setItem("bizassist:business", JSON.stringify(payload.business));
      } else {
        localStorage.removeItem("bizassist:business");
      }
      setBusiness(payload.business);
    }
  }, []);

  // Re-validate the stored token on load instead of trusting a stale profile.
  useEffect(() => {
    let active = true;
    const token = localStorage.getItem("token");

    if (!token) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    api
      .get("/auth/me")
      .then(({ data }) => {
        if (!active) return;
        if (data?.user) {
          localStorage.setItem("bizassist:user", JSON.stringify(data.user));
          setUser(data.user);
        }
        if (data?.business !== undefined) {
          if (data.business) {
            localStorage.setItem("bizassist:business", JSON.stringify(data.business));
          } else {
            localStorage.removeItem("bizassist:business");
          }
          setBusiness(data.business);
        }
      })
      .catch(() => {
        if (active) clearSession();
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [clearSession]);

  useEffect(() => {
    const onUnauthorized = () => clearSession();
    window.addEventListener("bizassist:unauthorized", onUnauthorized);
    return () => window.removeEventListener("bizassist:unauthorized", onUnauthorized);
  }, [clearSession]);

  const login = useCallback(
    async (email, password) => {
      const { data } = await api.post("/auth/login", { email, password });
      persistSession(data);
      return data;
    },
    [persistSession]
  );

  const register = useCallback(
    async (payload) => {
      const { data } = await api.post("/auth/register", payload);
      persistSession(data);
      return data;
    },
    [persistSession]
  );

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user,
      business,
      loading,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout
    }),
    [user, business, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside an AuthProvider");
  return context;
}

export default AuthContext;
