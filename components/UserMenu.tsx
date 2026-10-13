"use client";

/**
 * 右上角的账号区
 * ------------------------------------------------------------------
 * 未登录：显示「登录 / 注册」两个链接。
 * 已登录：显示昵称，点开是「工作台 / 博客 / 管理后台（仅管理员）/ 登出」。
 *
 * 刻意做成「一问就好」的形态 —— 用户不用去猜自己是不是登录了。
 */

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";

export default function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  // 换页时自动收起，免得菜单跟着飘到下一页
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // 点外面关掉
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (loading) {
    // 占位块，避免「先闪一下未登录再跳成昵称」
    return <span className="h-8 w-16 animate-pulse rounded-md bg-accentSoft" aria-hidden />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-1.5">
        <Link
          href="/login"
          className="rounded-md px-2.5 py-1.5 font-song text-[13px] text-inkSoft transition-colors hover:bg-accentSoft hover:text-ink"
        >
          登录
        </Link>
        <Link
          href="/register"
          className="rounded-md border border-cinnabar/45 bg-accentSoft px-2.5 py-1.5 font-song text-[13px] text-cinnabarInk transition-colors hover:border-cinnabar/70"
        >
          注册
        </Link>
      </div>
    );
  }

  const items: { href: string; label: string }[] = [
    { href: "/studio", label: "对联工作台" },
    { href: "/blog", label: "对韵博客" },
  ];
  if (user.role === "admin") items.push({ href: "/admin", label: "管理后台" });

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-song text-[13px] transition-colors ${
          open ? "bg-accentSoft text-cinnabarInk" : "text-inkSoft hover:bg-accentSoft hover:text-ink"
        }`}
      >
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-cinnabar text-[12px] font-semibold text-white">
          {user.nickname.slice(0, 1)}
        </span>
        <span className="max-w-[7rem] truncate">{user.nickname}</span>
        {user.role === "admin" && !compact && (
          <span className="rounded-full border border-gold/50 px-1.5 text-[12px] text-goldInk">管理</span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 top-[calc(100%+8px)] z-30 w-52 paper-panel p-2 shadow-lift"
          >
            <div className="px-2 py-1.5">
              <div className="truncate font-song text-[13px] text-ink">{user.nickname}</div>
              <div className="truncate text-[12px] text-inkFaint">{user.email}</div>
            </div>
            <div className="my-1 divider-brush" />
            {items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className="block rounded-md px-2 py-2 font-song text-[13px] text-inkSoft transition-colors hover:bg-accentSoft hover:text-ink"
              >
                {it.label}
              </Link>
            ))}
            {user.mustChangePassword && (
              <p className="mx-2 mt-1 rounded border border-warnInk/40 bg-warnInk/10 px-2 py-1.5 text-[12px] leading-relaxed text-warnInk">
                建议尽快改密码（管理员重置过）。
              </p>
            )}
            <div className="my-1 divider-brush" />
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await logout();
                setBusy(false);
                setOpen(false);
                router.refresh();
              }}
              className="block w-full rounded-md px-2 py-2 text-left font-song text-[13px] text-inkFaint transition-colors hover:bg-accentSoft hover:text-cinnabarInk disabled:opacity-50"
            >
              {busy ? "正在登出…" : "登出"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
