"use client";

/**
 * 落地页 / 博客 / 账号页共用的顶部导航
 * ------------------------------------------------------------------
 * 与工作台的 NavBar 分开：那一根是「工具的控制条」（类型切换、音效、学习模式），
 * 这一根是「站点的导航条」（去首页 / 工作台 / 博客、登录）。
 * 两者共用同一套主题变量与视觉语言，所以看着是一家人。
 */

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from "@/lib/storage";
import { THEMES, type ThemeId } from "@/lib/themes";
import UserMenu from "./UserMenu";

export const NAV_LINKS = [
  { href: "/", label: "首页" },
  { href: "/studio", label: "对联工作台" },
  { href: "/blog", label: "对韵博客" },
];

/** 品牌标识：与 favicon 同一套视觉（朱红方印 + 金线 + 对字） */
export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect x="3" y="6" width="26" height="20" rx="4" fill="var(--cinnabar)" opacity=".92" />
      <rect
        x="6.5"
        y="9.5"
        width="19"
        height="13"
        rx="2.5"
        fill="none"
        stroke="var(--gold)"
        strokeWidth="1"
        opacity=".8"
      />
      <line x1="16" y1="2" x2="16" y2="6" stroke="var(--gold)" strokeWidth="1.4" />
      <text
        x="16"
        y="20.5"
        textAnchor="middle"
        fontSize="12"
        fill="var(--gold)"
        style={{ fontFamily: '"Noto Serif SC", serif', fontWeight: 700 }}
      >
        对
      </text>
    </svg>
  );
}

export default function SiteHeader() {
  const pathname = usePathname();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const S = settings ?? DEFAULT_SETTINGS;

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const setTheme = (t: ThemeId) => {
    const next = { ...S, theme: t };
    setSettings(next);
    document.documentElement.setAttribute("data-theme", t);
    saveSettings(next);
    setThemeOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[var(--panel)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 md:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark />
          <span className="leading-none">
            <span className="block font-song text-lg tracking-[.25em] text-ink">对韵</span>
            <span className="mt-[3px] block text-[12px] tracking-[.2em] text-inkFaint">智能对联生成器</span>
          </span>
        </Link>

        <nav className="ml-2 hidden items-center gap-0.5 md:flex">
          {NAV_LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 font-song text-[13px] tracking-wider transition-colors ${
                  active ? "bg-accentSoft text-cinnabarInk" : "text-inkSoft hover:bg-accentSoft hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {/* 主题 */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setThemeOpen((v) => !v)}
              aria-expanded={themeOpen}
              title="外观与主题"
              className={`rounded-md px-2.5 py-1.5 font-song text-[13px] transition-colors ${
                themeOpen ? "bg-accentSoft text-cinnabarInk" : "text-inkFaint hover:bg-accentSoft hover:text-ink"
              }`}
            >
              主题
            </button>
            <AnimatePresence>
              {themeOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setThemeOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.16 }}
                    className="absolute right-0 top-[calc(100%+8px)] z-20 w-56 paper-panel p-2 shadow-lift"
                  >
                    {THEMES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTheme(t.id)}
                        className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                          S.theme === t.id
                            ? "border-cinnabar/50 bg-accentSoft"
                            : "border-transparent hover:border-line hover:bg-accentSoft/60"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-song text-[13px] text-ink">{t.label}</span>
                          {S.theme === t.id && <span className="text-[12px] text-cinnabar">使用中</span>}
                        </div>
                        <div className="mt-0.5 text-[12px] text-inkFaint">{t.hint}</div>
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <UserMenu />
        </div>
      </div>

      {/* 窄屏：导航横排一行，可横向滑动 */}
      <div className="border-t border-line md:hidden">
        <div className="flex items-center gap-1 overflow-x-auto px-4 py-1.5">
          {NAV_LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`shrink-0 rounded-md px-2.5 py-1 font-song text-[12px] transition-colors ${
                  active ? "bg-accentSoft text-cinnabarInk" : "text-inkFaint"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
