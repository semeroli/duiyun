"use client";

/**
 * 登录态（全站共享）
 * ==================================================================
 * 打开页面先问一次 /api/auth/me，拿到 user 就渲染昵称/后台入口。
 *
 * 为什么用 Context 而不是每个组件各自 fetch：
 *   落地页、博客、工作台三处都要显示「登录 / 昵称」，各拉一次就是三次请求，
 *   而且登出之后要靠刷新才能同步 —— 收在一处最省事。
 *
 * 🔴 接口不可用时**不报错、不阻断页面**：`user` 落成 null，
 *    页面照常渲染成「未登录」。账号体系坏了不能连累对联工具。
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface AuthUser {
  id: number;
  email: string;
  nickname: string;
  role: "user" | "admin";
  mustChangePassword: boolean;
}

interface AuthValue {
  user: AuthUser | null;
  /** 首次探测未完成前为 true，用来避免「先闪一下未登录」 */
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (email: string, password: string, nickname: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

interface ApiReply {
  ok: boolean;
  data?: { user?: AuthUser | null };
  error?: string;
}

/** 后端约定：写操作都回 { ok, data|error }；内容类型不对（SPA 兜底吞了 404）就算失败 */
async function post(url: string, body?: unknown): Promise<ApiReply> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
    });
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return { ok: false, error: "接口不可用" };
    return (await res.json()) as ApiReply;
  } catch {
    return { ok: false, error: "网络不太顺，稍后再试" };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) throw new Error("no api");
      const json = (await res.json()) as ApiReply;
      setUser(json.data?.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback<AuthValue["login"]>(async (email, password) => {
    const r = await post("/api/auth/login", { email, password });
    if (!r.ok) return { ok: false, error: r.error ?? "登录失败" };
    setUser(r.data?.user ?? null);
    return { ok: true };
  }, []);

  const register = useCallback<AuthValue["register"]>(async (email, password, nickname) => {
    const r = await post("/api/auth/register", { email, password, nickname });
    if (!r.ok) return { ok: false, error: r.error ?? "注册失败" };
    setUser(r.data?.user ?? null);
    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    await post("/api/auth/logout");
    setUser(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ user, loading, refresh, login, register, logout }),
    [user, loading, refresh, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) {
    // 没套 Provider 时不崩，退回一个「永远未登录」的实现
    return {
      user: null,
      loading: false,
      refresh: async () => {},
      login: async () => ({ ok: false, error: "页面没接好登录组件" }),
      register: async () => ({ ok: false, error: "页面没接好登录组件" }),
      logout: async () => {},
    };
  }
  return v;
}
