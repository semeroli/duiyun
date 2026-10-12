"use client";

/**
 * 通用 UI 原子件
 * ------------------------------------------------------------------
 * 全站只用这几个原语拼装，保证圆角、描边、阴影、动效手感一致。
 * 颜色一律走 CSS 变量映射的 Tailwind 类，换主题零改动。
 */

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, type ReactNode } from "react";

/* ── 按钮 ───────────────────────────────────────────────── */

type BtnVariant = "primary" | "outline" | "ghost" | "seal";
type BtnSize = "sm" | "md" | "lg";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 font-song select-none whitespace-nowrap " +
  "transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-45 " +
  "focus-visible:outline-none active:translate-y-[1px]";

const BTN_SIZE: Record<BtnSize, string> = {
  sm: "h-8 px-3 text-[13px] rounded-md tracking-wide",
  md: "h-10 px-4 text-sm rounded-md tracking-wide",
  lg: "h-12 px-6 text-base rounded-md tracking-wider",
};

const BTN_VARIANT: Record<BtnVariant, string> = {
  primary:
    "bg-cinnabar text-white shadow-seal hover:brightness-110 hover:shadow-lift border border-transparent",
  outline:
    "border border-lineStrong text-ink bg-panelSolid/60 hover:bg-accentSoft hover:border-cinnabar/60",
  ghost: "text-inkSoft hover:text-ink hover:bg-accentSoft border border-transparent",
  seal: "bg-ink text-app border border-transparent hover:brightness-125",
};

export function Btn({
  children,
  onClick,
  variant = "outline",
  size = "md",
  disabled,
  title,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  size?: BtnSize;
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`${BTN_BASE} ${BTN_SIZE[size]} ${BTN_VARIANT[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/* ── 徽标 ───────────────────────────────────────────────── */

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "info" | "red";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "text-inkFaint border-line",
    good: "text-emerald-700 border-emerald-600/40 bg-emerald-500/8 dark:text-emerald-300",
    warn: "text-amber-700 border-amber-600/40 bg-amber-500/10",
    info: "text-stoneblue border-stoneblue/40 bg-stoneblue/8",
    red: "text-cinnabar border-cinnabar/40 bg-cinnabar/10",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[11px] font-song tracking-wide ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** 工整度 → 徽标颜色 */
export function gradeTone(grade: string): "good" | "info" | "warn" | "neutral" {
  if (grade === "工整") return "good";
  if (grade === "较工整") return "info";
  if (grade === "宽松") return "warn";
  return "neutral";
}

/* ── 抽屉 ───────────────────────────────────────────────── */

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  side = "right",
  children,
  widthClass = "w-full max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  side?: "left" | "right";
  children: ReactNode;
  widthClass?: string;
}) {
  useLockScroll(open);
  useEsc(open, onClose);
  const from = side === "right" ? "100%" : "-100%";

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            className="absolute inset-0 bg-[rgba(var(--shadow-rgb),.42)] backdrop-blur-[2px]"
          />
          <motion.aside
            initial={{ x: from, opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: from, opacity: 0.4 }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className={`absolute top-0 ${side === "right" ? "right-0" : "left-0"} h-full ${widthClass} paper-panel flex flex-col rounded-none border-y-0 ${side === "right" ? "border-r-0" : "border-l-0"}`}
          >
            <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <h2 className="font-song text-lg tracking-widest text-ink">{title}</h2>
                {subtitle && <p className="mt-1 text-xs text-inkFaint">{subtitle}</p>}
              </div>
              <Btn size="sm" variant="ghost" onClick={onClose} title="关闭">
                关闭
              </Btn>
            </header>
            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ── 弹窗 ───────────────────────────────────────────────── */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidthClass = "max-w-5xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  maxWidthClass?: string;
}) {
  useLockScroll(open);
  useEsc(open, onClose);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            className="absolute inset-0 bg-[rgba(var(--shadow-rgb),.5)] backdrop-blur-[3px]"
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`relative flex max-h-[92dvh] w-full ${maxWidthClass} flex-col overflow-hidden paper-panel shadow-lift`}
          >
            <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <h2 className="font-song text-lg tracking-widest text-ink">{title}</h2>
                {subtitle && <p className="mt-1 text-xs text-inkFaint">{subtitle}</p>}
              </div>
              <Btn size="sm" variant="ghost" onClick={onClose} title="关闭">
                关闭
              </Btn>
            </header>
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ── 面板 ───────────────────────────────────────────────── */

export function Panel({
  title,
  subtitle,
  right,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`paper-panel relative overflow-hidden ${className}`}>
      <div className="pointer-events-none absolute inset-0 bamboo-veil opacity-[.35]" />
      <div className="relative">
        {(title || right) && (
          <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
            <div className="flex items-baseline gap-2">
              {title && (
                <h3 className="font-song text-base tracking-[.2em] text-ink">{title}</h3>
              )}
              {subtitle && <span className="text-xs text-inkFaint">{subtitle}</span>}
            </div>
            {right}
          </header>
        )}
        <div className="px-5 py-4">{children}</div>
      </div>
    </section>
  );
}

/* ── 钩子 ───────────────────────────────────────────────── */

function useLockScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}

function useEsc(active: boolean, fn: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") fn();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, fn]);
}
