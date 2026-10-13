"use client";

/**
 * 对联知识小贴士（新手模式）
 * 按类目筛选 + 逐条折叠，都是能直接拿去上课讲的话。
 */

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { TIPS } from "@/lib/data/tips";
import type { TipCategory } from "@/lib/types";
import { Drawer } from "./ui";

const CATS: (TipCategory | "全部")[] = ["全部", "入门", "平仄", "对仗", "意境", "避忌"];

export default function TipsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [cat, setCat] = useState<TipCategory | "全部">("全部");
  const [openId, setOpenId] = useState<string | null>(TIPS[0]?.id ?? null);

  const list = useMemo(
    () => (cat === "全部" ? TIPS : TIPS.filter((t) => t.category === cat)),
    [cat]
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="对联知识小贴士"
      subtitle={`共 ${TIPS.length} 条 · 平仄、对仗、意境、避忌，拿来就能讲`}
      widthClass="w-full max-w-lg"
    >
      <div className="mb-4 flex flex-wrap gap-1.5">
        {CATS.map((c) => {
          const active = cat === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={`rounded-full border px-3 py-1 font-song text-[12px] tracking-wide transition-colors ${
                active
                  ? "border-cinnabar/50 bg-accentSoft text-cinnabarInk"
                  : "border-line text-inkSoft hover:border-lineStrong hover:bg-accentSoft/60"
              }`}
            >
              {c}
              {c !== "全部" && (
                <span className="ml-1 text-[12px] text-inkFaint">
                  {TIPS.filter((t) => t.category === c).length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        {list.map((t) => {
          const isOpen = openId === t.id;
          return (
            <div key={t.id} className="overflow-hidden rounded-md border border-line">
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : t.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left transition-colors hover:bg-accentSoft/50"
              >
                <span className="shrink-0 rounded border border-line px-1.5 py-[1px] font-song text-[12px] text-inkFaint">
                  {t.category}
                </span>
                <span className="min-w-0 flex-1 font-song text-[14px] leading-snug text-ink">
                  {t.title}
                </span>
                <motion.span
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="shrink-0 text-inkFaint"
                  aria-hidden
                >
                  ▾
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 0.8, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="border-t border-line px-3.5 py-3 text-[13px] leading-[1.95] text-inkSoft">
                      {t.body}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </Drawer>
  );
}
