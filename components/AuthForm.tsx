"use client";

/**
 * 登录 / 注册表单（两处共用一份代码）
 * ------------------------------------------------------------------
 * mode="login" | "register"，只有字段数量和文案不同。
 *
 * 几个刻意的做法：
 *   - 用 `<form onSubmit>` 而不是给按钮挂 onClick：这样浏览器自带的
 *     「密码管理器 / 回车提交 / 自动填充」全部正常，手机上体验差别很大。
 *   - 密码框一律 `autoComplete` 标对，密码管理器才能正确识别登录/新密码。
 *   - 提交中禁用按钮并显示进度，避免连点造成重复注册。
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAuth } from "./AuthProvider";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const isLogin = mode === "login";
  const { login, register } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    const r = isLogin ? await login(email, password) : await register(email, password, nickname);
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? "失败了，稍后再试");
      return;
    }
    // 登录前想去哪就回哪；没指定就去工作台
    const next = params.get("next");
    const dest = next && next.startsWith("/") ? next : "/studio";
    router.push(dest);
    router.refresh();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 0.8, 0.3, 1] }}
      className="paper-panel relative w-full max-w-[420px] overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-0 bamboo-veil opacity-[.3]" />
      <div className="relative px-6 py-7 sm:px-8">
        <h1 className="font-song text-2xl tracking-[.14em] text-ink">
          {isLogin ? "登录对韵" : "注册对韵"}
        </h1>
        <p className="mt-2 text-[12px] leading-relaxed text-inkFaint">
          {isLogin
            ? "登录后收藏与生成历史会存到云端，换手机换电脑都在。"
            : "用邮箱注册，一分钟就好。不注册也能直接用对联工具。"}
        </p>

        <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
          {!isLogin && (
            <Field label="昵称" hint="可不填，默认取邮箱前缀">
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                autoComplete="nickname"
                placeholder="如：王老师"
                className={INPUT}
              />
            </Field>
          )}

          <Field label="邮箱">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              className={INPUT}
            />
          </Field>

          <Field
            label="密码"
            hint={isLogin ? undefined : "至少 8 位，需含字母和数字"}
          >
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isLogin ? "current-password" : "new-password"}
                placeholder="••••••••"
                className={`${INPUT} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-[12px] text-inkFaint transition-colors hover:bg-accentSoft hover:text-ink"
              >
                {showPw ? "隐藏" : "显示"}
              </button>
            </div>
          </Field>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-cinnabar/40 bg-accentSoft px-3 py-2 text-[12px] leading-relaxed text-cinnabarInk"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="h-11 w-full rounded-md bg-cinnabar font-song text-[15px] tracking-wider text-white shadow-seal transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {busy ? "请稍候…" : isLogin ? "登录" : "注册并登录"}
          </button>
        </form>

        <div className="mt-5 flex items-center gap-3">
          <span className="h-[1px] flex-1 bg-line" />
          <span className="text-[12px] text-inkFaint">
            {isLogin ? "还没有账号？" : "已经有账号了？"}
          </span>
          <span className="h-[1px] flex-1 bg-line" />
        </div>

        <div className="mt-3.5 flex gap-2">
          <Link
            href={isLogin ? "/register" : "/login"}
            className="h-10 flex-1 rounded-md border border-lineStrong bg-panelSolid/60 text-center font-song text-[13px] leading-10 tracking-wide text-ink transition-colors hover:border-cinnabar/60 hover:bg-accentSoft"
          >
            {isLogin ? "去注册" : "去登录"}
          </Link>
          <Link
            href="/studio"
            className="h-10 flex-1 rounded-md border border-transparent text-center font-song text-[13px] leading-10 tracking-wide text-inkFaint transition-colors hover:bg-accentSoft hover:text-ink"
          >
            先不登录，直接用
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

const INPUT =
  "h-11 w-full rounded-md border border-lineInput bg-panelSolid px-3 font-kai text-[14px] text-ink transition-colors placeholder:text-inkFaint/70 focus:border-cinnabar/60";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between">
        <span className="font-song text-[13px] tracking-wider text-inkSoft">{label}</span>
        {hint && <span className="text-[12px] text-inkFaint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
