import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiLogin, apiMe, apiRegisterPassenger } from "./auth.api";
import type { MeUser, UserRole } from "./auth.types";
import { clearToken, getToken, setToken } from "../lib/storage";
import { setSavedPasswordForUser } from "../lib/credentials";
import { apiDriverUpsertLocation } from "../driver/driver.api";
import { preloadCoords } from "../utils/location";
import { apiRegisterPushToken } from "../notifications/notifications.api";
import { ensureAndroidChannels, getNativePushToken, setupNotificationHandlerOnce } from "../notifications/push";
import { apiGetPublicAppConfig, type PublicAppConfig } from "../config/config.api";

type AuthState = {
  bootstrapped: boolean;
  token: string | null;
  user: MeUser | null;
  appConfig: PublicAppConfig | null;
};

type AuthContextValue = AuthState & {
  login: (input: { user: string; password: string }) => Promise<void>;
  registerPassenger: (input: { email: string; password: string; fullName: string; phone: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider(props: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    bootstrapped: false,
    token: null,
    user: null,
    appConfig: null,
  });

  const pushRegisteredRef = useRef<{ userId: string; token: string } | null>(null);

  useEffect(() => {
    // Habilita banners + sonido también en foreground.
    setupNotificationHandlerOnce();
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await apiGetPublicAppConfig();
        if (!alive) return;
        setState((s) => ({ ...s, appConfig: res.appConfig ?? null }));
      } catch {
        // silencioso: si falla, la app igual funciona (sólo no muestra montos secundarios)
      }
    })();

    return () => {
      alive = false;
    };
  }, [state.token]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        await ensureAndroidChannels();
      } catch {
        // silencioso
      }

      const token = state.token;
      const userId = state.user?.id;
      if (!token || !userId) return;

      try {
        const native = await getNativePushToken();
        if (!alive || !native) return;

        // Evita re-registrar en loop si ya quedó guardado.
        if (pushRegisteredRef.current?.userId === userId && pushRegisteredRef.current?.token === native.token) {
          return;
        }

        await apiRegisterPushToken(token, { token: native.token, platform: native.platform });
        if (!alive) return;
        pushRegisteredRef.current = { userId, token: native.token };
      } catch {
        // silencioso: si falla, la app sigue funcionando
      }
    })();

    return () => {
      alive = false;
    };
  }, [state.token, state.user?.id]);

  useEffect(() => {
    let alive = true;
    const token = state.token;
    const role = state.user?.role;
    if (!token || !role) return;

    // Best-effort: precargar ubicación para UX más rápida.
    (async () => {
      const seq = await preloadCoords();
      if (!alive || !seq) return;

      const coords = seq.current ?? seq.fast;
      if (!coords) return;

      if (role === "DRIVER") {
        try {
          await apiDriverUpsertLocation(token, coords);
        } catch {
          // silencioso
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [state.token, state.user?.role]);

  useEffect(() => {
    let alive = true;

    (async () => {
      const token = await getToken();
      if (!alive) return;

      if (!token) {
        setState({ bootstrapped: true, token: null, user: null, appConfig: null });
        return;
      }

      try {
        const me = await apiMe(token);
        if (!alive) return;
        setState((s) => ({ ...s, bootstrapped: true, token, user: me.user }));
      } catch {
        await clearToken();
        if (!alive) return;
        setState({ bootstrapped: true, token: null, user: null, appConfig: null });
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    async function refreshMe() {
      if (!state.token) return;
      const me = await apiMe(state.token);
      setState((s) => ({ ...s, user: me.user }));
    }

    async function login(input: { user: string; password: string }) {
      const res = await apiLogin({ user: input.user, password: input.password });

      await setToken(res.token);
      if (res.user?.id) {
        try {
          await setSavedPasswordForUser({ userId: res.user.id, password: input.password });
        } catch {
          // silencioso
        }
      }
      setState((s) => ({ ...s, bootstrapped: true, token: res.token, user: res.user }));
    }

    async function registerPassenger(input: { email: string; password: string; fullName: string; phone: string }) {
      const res = await apiRegisterPassenger(input);
      await setToken(res.token);
      if (res.user?.id) {
        try {
          await setSavedPasswordForUser({ userId: res.user.id, password: input.password });
        } catch {
          // silencioso
        }
      }
      setState((s) => ({ ...s, bootstrapped: true, token: res.token, user: res.user }));
    }

    async function logout() {
      await clearToken();
      setState({ bootstrapped: true, token: null, user: null, appConfig: null });
    }

    return {
      ...state,
      login,
      registerPassenger,
      logout,
      refreshMe,
    };
  }, [state]);

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
