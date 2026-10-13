"use client";

/**
 * 平仄可视化：○平 ●仄 ×未能判定
 * 上排上联、下排下联，同位次竖着看；不合的位置用朱砂短线标出。
 */

import { motion } from "framer-motion";
import { toneMark } from "@/lib/hanzi";
import type { ToneAnalysis, ToneChar } from "@/lib/types";

function Cell({ tc, side }: { tc: ToneChar | null; side: "up" | "lo" }) {
  if (!tc) {
    return (
      <div className="tone-chip is-unknown opacity-40">
        <span className="font-song text-lg leading-none">　</span>
        <span className="text-[12px] leading-none">—</span>
      </div>
    );
  }
  const cls = tc.tone === "ping" ? "is-ping" : tc.tone === "ze" ? "is-ze" : "is-unknown";
  return (
    <div className={`tone-chip ${cls}`}>
      <span className="font-song text-lg leading-none">{tc.char}</span>
      <span className="mt-[3px] text-[12px] leading-none">{toneMark(tc.tone)}</span>
      <span className="mt-[2px] text-[12px] leading-none text-inkFaint">
        {tc.pinyin || (side === "up" ? "" : "")}
      </span>
      {tc.byRuSheng && (
        <span
          className="mt-[2px] rounded-[2px] bg-cinnabar/12 px-[3px] text-[12px] leading-[15px] text-cinnabarInk"
          title="入声字：古韵属仄声，普通话已读作平声"
        >
          入
        </span>
      )}
    </div>
  );
}

export default function ToneMarks({ tone }: { tone: ToneAnalysis }) {
  const hasData = tone.pairs.length > 0;

  return (
    <div className="space-y-3">
      {/* 符号串：一眼看整体格律 */}
      <div className="space-y-1.5 rounded-md border border-line bg-panelSolid/40 px-3 py-2.5">
        <div className="flex items-baseline gap-2.5 overflow-x-auto">
          <span className="shrink-0 font-song text-[12px] tracking-[.2em] text-inkFaint">上联</span>
          <span className="font-song text-base tracking-[.32em] text-ink">
            {tone.upperMarks || "—"}
          </span>
        </div>
        <div className="flex items-baseline gap-2.5 overflow-x-auto">
          <span className="shrink-0 font-song text-[12px] tracking-[.2em] text-inkFaint">下联</span>
          <span className="font-song text-base tracking-[.32em] text-ink">
            {tone.lowerMarks || "—"}
          </span>
        </div>
      </div>

      {/* 逐位明细：○/● 弹入 */}
      {hasData ? (
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-min gap-x-1.5">
            {tone.pairs.map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.55, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{
                  delay: Math.min(i * 0.045, 0.6),
                  type: "spring",
                  stiffness: 520,
                  damping: 20,
                }}
                className="flex flex-col items-center"
              >
                <Cell tc={p.upper} side="up" />
                <span
                  className={`my-[3px] block h-[1px] w-7 rounded-full ${
                    p.ok === false ? "bg-cinnabar/70" : "bg-line"
                  }`}
                />
                <Cell tc={p.lower} side="lo" />
                <span
                  className={`mt-1 text-[12px] leading-none ${
                    p.ok === true
                      ? "text-okInk"
                      : p.ok === false
                        ? "text-cinnabar"
                        : "text-transparent"
                  }`}
                  aria-hidden={p.ok === null}
                >
                  {p.ok === true ? "✓" : p.ok === false ? "✗" : "·"}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-inkFaint">尚未生成下联，暂无对照。</p>
      )}

      {/* 图例 + 结论 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-inkFaint">
        <span className="inline-flex items-center gap-1">
          <span className="text-stoneblue">○</span>平声
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="text-cinnabar">●</span>仄声
        </span>
        <span className="inline-flex items-center gap-1">
          <span>×</span>轻声/多音，未判定
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="rounded-[2px] bg-cinnabar/12 px-[3px] text-cinnabarInk">入</span>入声字（古仄今平）
        </span>
      </div>

      <p className="text-[13px] leading-relaxed text-inkSoft">{tone.summary}</p>
    </div>
  );
}
