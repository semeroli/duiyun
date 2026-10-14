"use client";

/**
 * 顶部导航（工作台专用）：灯笼标识 + 类型切换 + 右侧工具
 * ------------------------------------------------------------------
 * 右侧依次是：对韵博客 / 音效 / 学习模式 / 收藏 / 主题 / 账号。
 * 「对韵博客」放在工具区最前面而不是塞进「主题」那种下拉里 ——
 * 它的目的是把人带去看文章，藏起来就没人点了。
 */

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { KIND_META, type CoupletKind } from "@/lib/types";
import { THEMES, type ThemeId } from "@/lib/themes";
import { Badge } from "./ui";
import UserMenu from "./UserMenu";

const KINDS: CoupletKind[] = ["classic", "homophone", "modern"];

export default function NavBar({
  kind,
  onKindChange,
  favCount,
  onOpenFavorites,
  learning,
  onToggleLearning,
  theme,
  onThemeChange,
  sound,
  onSoundChange,
}: {
  kind: CoupletKind;
  onKindChange: (k: CoupletKind) => void;
  favCount: number;
  onOpenFavorites: () => void;
  learning: boolean;
  onToggleLearning: () => void;
  theme: ThemeId;
  onThemeChange: (t: ThemeId) => void;
  sound: boolean;
  onSoundChange: (v: boolean) => void;
}) {
  const [settingOpen, setSettingOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[var(--panel)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 md:px-6">
        {/* 标识：点回落地页。工作台是「里屋」，得让人随时能退回「门厅」 */}
        <Link href="/" className="flex items-center gap-2.5" title="回到首页">
          <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
            <rect x="3" y="6" width="26" height="20" rx="4" fill="var(--cinnabar)" opacity=".92" />
            <rect x="6.5" y="9.5" width="19" height="13" rx="2.5" fill="none" stroke="var(--gold)" strokeWidth="1" opacity=".8" />
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
          <div className="leading-none">
            <div className="font-song text-lg tracking-[.25em] text-ink">对韵</div>
            <div className="mt-[3px] hidden text-[12px] tracking-[.2em] text-inkFaint sm:block">智能对联生成器</div>
          </div>
        </Link>

        {/* 类型切换 */}
        <nav className="order-last flex w-full items-center gap-1 rounded-md border border-line bg-panelSolid/50 p-1 md:order-none md:ml-4 md:w-auto">
          {KINDS.map((k) => {
            const active = kind === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => onKindChange(k)}
                className="relative flex-1 rounded-md px-3 py-1.5 font-song text-[13px] tracking-wider transition-colors md:flex-none"
              >
                {active && (
                  <motion.span
                    layoutId="kind-pill"
                    className="absolute inset-0 rounded-md border border-cinnabar/45 bg-accentSoft"
                    transition={{ type: "spring", stiffness: 430, damping: 33 }}
                  />
                )}
                <span className={active ? "relative text-cinnabarInk" : "relative text-inkSoft hover:text-ink"}>
                  {KIND_META[k].label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* 右侧工具 */}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
          <Link
            href="/blog"
            title="对韵博客：格律、典故与课堂用法"
            className="rounded-md border border-cinnabar/40 bg-accentSoft px-2.5 py-2 font-song text-[13px] text-cinnabarInk transition-colors hover:border-cinnabar/70"
          >
            对韵博客
          </Link>

          <div className="hidden items-center gap-1 md:flex">
          <button
            type="button"
            onClick={() => onSoundChange(!sound)}
            title={sound ? "关闭轻触音" : "开启轻触音（棋子落盘）"}
            aria-pressed={sound}
            className={`rounded-md px-2.5 py-2 text-[13px] font-song transition-colors ${
              sound ? "bg-accentSoft text-cinnabarInk" : "text-inkFaint hover:bg-accentSoft hover:text-ink"
            }`}
          >
            {sound ? "音效开" : "音效关"}
          </button>

          <button
            type="button"
            onClick={onToggleLearning}
            title="学习模式：侧栏显示平仄规则与词性对照表"
            aria-pressed={learning}
            className={`rounded-md px-2.5 py-2 text-[13px] font-song transition-colors ${
              learning ? "bg-accentSoft text-cinnabarInk" : "text-inkFaint hover:bg-accentSoft hover:text-ink"
            }`}
          >
            学习模式
          </button>

          <button
            type="button"
            onClick={onOpenFavorites}
            title="我的收藏"
            className="relative rounded-md px-2.5 py-2 text-[13px] font-song text-inkFaint transition-colors hover:bg-accentSoft hover:text-ink"
          >
            收藏
            {favCount > 0 && (
              <span className="ml-1 inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-cinnabar px-1 text-[12px] font-semibold text-white">
                {favCount}
              </span>
            )}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setSettingOpen((v) => !v)}
              title="外观与主题"
              aria-expanded={settingOpen}
              className={`rounded-md px-2.5 py-2 text-[13px] font-song transition-colors ${
                settingOpen ? "bg-accentSoft text-cinnabarInk" : "text-inkFaint hover:bg-accentSoft hover:text-ink"
              }`}
            >
              主题
            </button>

            <AnimatePresence>
              {settingOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSettingOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="absolute right-0 top-[calc(100%+8px)] z-20 w-60 paper-panel p-3 shadow-lift"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-song text-xs tracking-[.2em] text-inkFaint">外观主题</span>
                      <Badge tone="red">即刻生效</Badge>
                    </div>
                    <div className="space-y-1.5">
                      {THEMES.map((t) => {
                        const active = theme === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => onThemeChange(t.id)}
                            className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                              active
                                ? "border-cinnabar/50 bg-accentSoft"
                                : "border-line hover:border-lineStrong hover:bg-accentSoft/60"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-song text-sm text-ink">{t.label}</span>
                              {active && <span className="text-[12px] text-cinnabarInk">使用中</span>}
                            </div>
                            <div className="mt-0.5 text-[12px] text-inkFaint">{t.hint}</div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 border-t border-line pt-2.5">
                      <label className="flex cursor-pointer items-center justify-between">
                        <span className="font-song text-sm text-ink">轻触音效</span>
                        <input
                          type="checkbox"
                          checked={sound}
                          onChange={(e) => onSoundChange(e.target.checked)}
                          className="h-4 w-4 accent-[var(--cinnabar)]"
                        />
                      </label>
                      <p className="mt-1 text-[12px] leading-relaxed text-inkFaint">
                        现场合成的「棋子落盘」声，默认关闭。
                      </p>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
          </div>

          {/* 手机端：音效/学习/收藏/主题 收进「更多」，避免一行放不下换行成多行 */}
          <div className="relative md:hidden">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              title="更多工具与外观"
              className={`rounded-md px-2.5 py-2 font-song text-[13px] transition-colors ${
                moreOpen ? "bg-accentSoft text-cinnabarInk" : "text-inkFaint hover:bg-accentSoft hover:text-ink"
              }`}
            >
              更多
            </button>
            <AnimatePresence>
              {moreOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMoreOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.16 }}
                    className="absolute right-0 top-[calc(100%+8px)] z-20 w-52 paper-panel p-2 shadow-lift space-y-1"
                  >
                    <button
                      type="button"
                      onClick={() => onSoundChange(!sound)}
                      aria-pressed={sound}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors ${
                        sound ? "bg-accentSoft text-cinnabarInk" : "text-inkSoft hover:bg-accentSoft/60"
                      }`}
                    >
                      <span className="font-song text-[13px]">轻触音效</span>
                      <span className="text-[12px] text-inkFaint">{sound ? "开" : "关"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={onToggleLearning}
                      aria-pressed={learning}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors ${
                        learning ? "bg-accentSoft text-cinnabarInk" : "text-inkSoft hover:bg-accentSoft/60"
                      }`}
                    >
                      <span className="font-song text-[13px]">学习模式</span>
                      <span className="text-[12px] text-inkFaint">{learning ? "开" : "关"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={onOpenFavorites}
                      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-inkSoft transition-colors hover:bg-accentSoft/60"
                    >
                      <span className="font-song text-[13px]">收藏</span>
                      {favCount > 0 && (
                        <span className="inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-cinnabar px-1 text-[12px] font-semibold text-white">
                          {favCount}
                        </span>
                      )}
                    </button>
                    <div className="border-t border-line pt-1.5">
                      <div className="px-3 py-1 font-song text-xs tracking-[.2em] text-inkFaint">外观主题</div>
                      {THEMES.map((t) => {
                        const active = theme === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => onThemeChange(t.id)}
                            className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                              active
                                ? "border-cinnabar/50 bg-accentSoft"
                                : "border-line hover:border-lineStrong hover:bg-accentSoft/60"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-song text-sm text-ink">{t.label}</span>
                              {active && <span className="text-[12px] text-cinnabarInk">使用中</span>}
                            </div>
                            <div className="mt-0.5 text-[12px] text-inkFaint">{t.hint}</div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <UserMenu compact />
        </div>
      </div>

      {/* 当前类型的说明，一行小字 */}
      <div className="mx-auto max-w-6xl px-4 pb-2 md:px-6">
        <p className="text-[12px] leading-relaxed text-inkFaint">{KIND_META[kind].hint}</p>
      </div>
    </header>
  );
}
