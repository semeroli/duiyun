"use client";

/**
 * 多维解析区：手风琴式，仿展开折扇
 * 四个维度：平仄对应 / 词性对仗 / 意境呼应 / 典故出处
 * 默认只展开「平仄对应」—— 它是老师最先要讲的。
 */

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { CoupletAnalysis } from "@/lib/types";
import ToneMarks from "./ToneMarks";
import { Badge, gradeTone } from "./ui";

type Key = "tone" | "pos" | "conception" | "allusion";

const ORDER: Key[] = ["tone", "pos", "conception", "allusion"];

const TITLES: Record<Key, string> = {
  tone: "平仄对应",
  pos: "词性对仗",
  conception: "意境呼应",
  allusion: "典故出处",
};

const SUBTITLES: Record<Key, string> = {
  tone: "看上下联同位字是否平仄相反",
  pos: "逐段核对名词对名词、动词对动词",
  conception: "两句的气象是否合得来",
  allusion: "若有出典，注明来历",
};

export default function AnalysisPanels({ analysis }: { analysis: CoupletAnalysis | null }) {
  const [open, setOpen] = useState<Key | null>("tone");

  // 换了下联就回到「平仄对应」，避免停留在上一副的结论上
  useEffect(() => {
    setOpen("tone");
  }, [analysis]);

  if (!analysis) {
    return (
      <div className="paper-panel px-5 py-6 text-center">
        <p className="font-song text-sm tracking-widest text-inkFaint">
          对出下联后，这里会展开四个维度的解析
        </p>
      </div>
    );
  }

  const grades: Record<Key, { text: string; tone: "good" | "info" | "warn" | "neutral" | "red" }> = {
    tone: { text: analysis.tone.grade, tone: gradeTone(analysis.tone.grade) },
    pos: { text: analysis.pos.grade, tone: gradeTone(analysis.pos.grade) },
    conception: {
      text: analysis.conception.harmony,
      tone: analysis.conception.harmony === "呼应" ? "good" : analysis.conception.harmony === "待打磨" ? "warn" : "info",
    },
    allusion: { text: analysis.allusion.has ? "有出典" : "无典故", tone: analysis.allusion.has ? "red" : "neutral" },
  };

  return (
    <div className="space-y-2.5">
      {ORDER.map((key, idx) => {
        const isOpen = open === key;
        return (
          <section key={key} className="paper-panel overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : key)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accentSoft/40 md:px-5"
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line font-song text-[12px] text-inkFaint">
                {idx + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-song text-[15px] tracking-[.18em] text-ink">
                    {TITLES[key]}
                  </span>
                  <span className="hidden text-[11px] text-inkFaint sm:inline">{SUBTITLES[key]}</span>
                </span>
              </span>
              <Badge tone={grades[key].tone}>{grades[key].text}</Badge>
              <motion.span
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.22 }}
                className="shrink-0 text-inkFaint"
                aria-hidden
              >
                ▾
              </motion.span>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.34, ease: [0.22, 0.8, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-line px-4 py-4 md:px-5">
                    {key === "tone" && <ToneMarks tone={analysis.tone} />}
                    {key === "pos" && <PosTable analysis={analysis} />}
                    {key === "conception" && <Conception analysis={analysis} />}
                    {key === "allusion" && <Allusion analysis={analysis} />}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        );
      })}
    </div>
  );
}

/* ── 词性对仗 ───────────────────────────────────────────── */

function PosTable({ analysis }: { analysis: CoupletAnalysis }) {
  const { pos } = analysis;
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-[13px]">
          <thead>
            <tr className="text-left font-song text-[11px] tracking-[.2em] text-inkFaint">
              <th className="pb-2 pr-3 font-normal">上联</th>
              <th className="pb-2 pr-3 font-normal">词性</th>
              <th className="pb-2 pr-3 font-normal">下联</th>
              <th className="pb-2 pr-3 font-normal">词性</th>
              <th className="pb-2 font-normal">对仗</th>
            </tr>
          </thead>
          <tbody>
            {pos.pairs.map((p, i) => (
              <motion.tr
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.5), duration: 0.3 }}
                className="border-t border-line"
              >
                <td className="py-2 pr-3 font-song text-[15px] text-ink">{p.upperWord}</td>
                <td className="py-2 pr-3 text-inkFaint">{p.upperPos}</td>
                <td className="py-2 pr-3 font-song text-[15px] text-ink">{p.lowerWord || "—"}</td>
                <td className="py-2 pr-3 text-inkFaint">{p.lowerPos}</td>
                <td className="py-2">
                  {p.upperPos === "未知" || p.lowerPos === "未知" ? (
                    <span className="text-inkFaint">待定</span>
                  ) : p.ok ? (
                    <span className="text-emerald-600">✓ 相同</span>
                  ) : (
                    <span className="text-cinnabar">✗ 不同</span>
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[13px] leading-relaxed text-inkSoft">{pos.summary}</p>
    </div>
  );
}

/* ── 意境呼应 ───────────────────────────────────────────── */

function Conception({ analysis }: { analysis: CoupletAnalysis }) {
  const c = analysis.conception;
  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-[1.9] text-inkSoft">{c.summary}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <ImageBox label="上联意象" items={c.upperImages} />
        <ImageBox label="下联意象" items={c.lowerImages} />
        <ImageBox label="共同意象" items={c.sharedImages} accent />
      </div>
    </div>
  );
}

function ImageBox({ label, items, accent }: { label: string; items: string[]; accent?: boolean }) {
  return (
    <div className={`rounded-md border px-3 py-2.5 ${accent ? "border-cinnabar/35 bg-accentSoft" : "border-line"}`}>
      <div className="mb-1.5 font-song text-[11px] tracking-[.18em] text-inkFaint">{label}</div>
      {items.length ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((w) => (
            <span
              key={w}
              className={`rounded px-1.5 py-[2px] font-song text-[13px] ${
                accent ? "bg-cinnabar/12 text-cinnabar" : "bg-accentSoft text-inkSoft"
              }`}
            >
              {w}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-[12px] text-inkFaint">—</span>
      )}
    </div>
  );
}

/* ── 典故出处 ───────────────────────────────────────────── */

function Allusion({ analysis }: { analysis: CoupletAnalysis }) {
  const a = analysis.allusion;
  if (!a.has) {
    return (
      <div className="space-y-2">
        <p className="text-[13px] leading-relaxed text-inkSoft">
          此联未涉及典故，全凭白描取胜 —— 这也是对联最见功夫的一种写法。
        </p>
        <p className="text-[12px] leading-relaxed text-inkFaint">
          用典与不用典无高下之分：用典贵在妥帖，不用典贵在自然。若硬塞典故，反而伤气。
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-song text-[16px] tracking-[.14em] text-ink">{a.title}</span>
        {a.source && <span className="text-[12px] text-inkFaint">出典：{a.source}</span>}
      </div>
      {a.quote && (
        <blockquote className="border-l-2 border-cinnabar/50 bg-accentSoft/60 px-3 py-2 font-song text-[14px] leading-relaxed text-inkSoft">
          {a.quote}
        </blockquote>
      )}
      <p className="text-[13px] leading-[1.9] text-inkSoft">{a.explain}</p>
    </div>
  );
}
