import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { AppState } from "react-native";
import { uid } from "./domain";
import { type Command } from "./commands";
import { cache, readToken, saveToken, removeToken } from "./storage";
import { request, discordLogin, type StateResponse } from "./api";
import type { Identity, Snapshot } from "./types";
type Model = {
  snapshot: Snapshot | null;
  user: Identity | null;
  busy: boolean;
  offline: boolean;
  error: string;
  refresh: () => Promise<void>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  execute: (c: Command) => Promise<string>;
  call: <T>(path: string, body?: unknown) => Promise<T>;
};
const Context = createContext<Model | null>(null);
export const useTeam = () => {
  const c = useContext(Context);
  if (!c) throw new Error("Missing provider");
  return c;
};
export function TeamProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [user, setUser] = useState<Identity | null>(null),
    [busy, setBusy] = useState(true),
    [offline, setOffline] = useState(false),
    [error, setError] = useState("");
  const pending = useRef(new Map<string, string>());
  const device = useRef<string | null>(null);
  const token = useRef<string | null>(null),
    editing = useRef(false),
    mounted = useRef(true);
  const refresh = useCallback(async () => {
    if (!token.current) return;
    try {
      const data = await request<StateResponse>(
        "/api/mobile/state",
        token.current,
      );
      if (!mounted.current) return;
      const identity = {
        id: data.user.id,
        name: data.user.globalName || data.user.username,
        isAdmin: data.user.isAdmin,
      };
      setSnapshot(data.snapshot);
      setUser(identity);
      setOffline(false);
      setError("");
      await cache.write({ snapshot: data.snapshot, user: identity });
    } catch (e) {
      if (mounted.current) {
        setOffline(true);
        setError(e instanceof Error ? e.message : "تعذر الاتصال");
      }
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    (async () => {
      const stored = await readToken();
      token.current = stored;
      if (stored) {
        const raw = await cache.read();
        if (raw) {
          try {
            const v = JSON.parse(raw);
            setSnapshot(v.snapshot);
            setUser(v.user);
          } catch {
            await cache.clear();
          }
        }
        await refresh();
      }
      setBusy(false);
    })().catch(() => {
      setBusy(false);
      setError("تعذر قراءة الجلسة المحفوظة");
    });
    const timer = setInterval(() => {
      if (AppState.currentState === "active" && !editing.current)
        void refresh();
    }, 30000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && !editing.current) void refresh();
    });
    return () => {
      mounted.current = false;
      clearInterval(timer);
      sub.remove();
    };
  }, [refresh]);
  const login = async () => {
    setBusy(true);
    try {
      const data = await discordLogin();
      await saveToken(data.token);
      token.current = data.token;
      await refresh();
    } finally {
      setBusy(false);
    }
  };
  const logout = async () => {
    if (device.current && token.current) {
      try {
        await request("/api/mobile/devices", token.current, {
          token: device.current,
          remove: true,
        });
      } catch {}
    }
    device.current = null;
    pending.current.clear();
    token.current = null;
    await removeToken();
    await cache.clear();
    setUser(null);
    setSnapshot(null);
    setError("");
    setOffline(false);
  };
  const execute = async (command: Command) => {
    if (!snapshot || !user) throw new Error("سجل الدخول أولًا");
    if (editing.current) throw new Error("انتظر اكتمال العملية الحالية");
    editing.current = true;
    try {
      if (!token.current) throw new Error("انتهت الجلسة");
      if (offline)
        throw new Error(
          "اتصل بالإنترنت لحفظ التغييرات؛ البيانات المعروضة نسخة محفوظة",
        );
      const key = JSON.stringify(command);
      const id = pending.current.get(key) || uid();
      pending.current.set(key, id);
      const result = await request<{ message: string }>(
        "/api/mobile/command",
        token.current,
        { ...command, id },
      );
      pending.current.delete(key);
      await refresh();
      return result.message;
    } finally {
      editing.current = false;
    }
  };
  const call = async <T,>(path: string, body?: unknown): Promise<T> => {
    if (!token.current)
      throw new Error("هذا القسم يحتاج اتصالًا فعليًا ببيانات الفريق");
    const result = await request<T>(path, token.current, body);
    if (
      path === "/api/mobile/devices" &&
      body &&
      typeof body === "object" &&
      "token" in body
    )
      device.current = String(body.token);
    return result;
  };
  return (
    <Context.Provider
      value={{
        snapshot,
        user,
        busy,
        offline,
        error,
        refresh,
        login,
        logout,
        execute,
        call,
      }}
    >
      {children}
    </Context.Provider>
  );
}
