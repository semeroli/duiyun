"use client";

/**
 * 下句展示区
 * - 逐字「落笔」浮现（带墨迹渗染感：blur → clear + 轻微位移）
 * - 「换一换」如翻书页：旧句 blur 退场，新句逐字落笔
 * - 空状态用一句古诗引导
 */

import { AnimatePresence, motion, type Variants } from "framer-motion";
import { SOURCE_META, sourceLabel, type CoupletCandidate } from "@/lib/types";
import InkLoader from "./InkLoader";
import { Badge, Btn } from "./ui";

const charVariants: Variants = {
  hidden: { opacity: 0, y: -10, filter: "blur(10px)" },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { delay: Math.min(i * 0.085, 1.6), duration: 0.44, ease: [0.2, 0.8, 0.3, 1] },
  }),
};

export default function LowerOutput({
  candidate,
  loading,
  onRefresh,
  onToggleFav,
  isFav,
  onOpenCard,
}: {
  candidate: CoupletCandidate | null;
  loading: boolean;
  onRefresh: () => void;
  onToggleFav: () => void;
  isFav: boolean;
  onOpenCard: () => void;
}) {
  return (
    <div className="relative">
      <div className="scroll-rod pointer-events-none absolute -left-1.5 bottom-3 top-3 w-3 rounded-full" />
      <div className="scroll-rod pointer-events-none absolute -right-1.5 bottom-3 top-3 w-3 rounded-full" />

      <div className="paper-panel relative overflow-hidden px-5 py-5 md:px-14 md:py-8">
        <div className="bamboo-veil pointer-events-none absolute inset-0 opacity-25" />
        <div
          className="pointer-events-none absolute inset-x-10 top-[34%] h-14 rounded-full blur-2xl"
          style={{ background: "var(--accent-soft)" }}
        />

        <div className="pointer-events-none absolute right-2 top-3 hidden md:block">
          <div className="vertical-title rounded-b-md border border-line bg-accentSoft/70 px-1.5 py-2 font-song text-[12px] text-cinnabar">
            下联
          </div>
        </div>

        <div className="relative min-h-[132px] md:min-h-[164px]">
          <div className="mb-2 flex items-center gap-2 md:hidden">
            <span className="rounded border border-line bg-accentSoft/70 px-1.5 py-[2px] font-song text-[11px] text-cinnabar">
              下联
            </span>
          </div>

          <AnimatePresence mode="wait">
            {loading && !candidate ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <InkLoader />
              </motion.div>
            ) : candidate ? (
              <motion.div
                key={candidate.id}
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, y: -10, filter: "blur(8px)" }}
                transition={{ duration: 0.24 }}
                className="flex flex-wrap items-end pt-1"
              >
                {Array.from(candidate.lower).map((ch, i) => (
                  <motion.span
                    key={`${candidate.id}-${i}`}
                    custom={i}
                    variants={charVariants}
                    initial="hidden"
                    animate="show"
                    className="font-song text-[34px] leading-[1.55] tracking-[.16em] text-ink md:text-[42px]"
                  >
                    {ch}
                  </motion.span>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-start gap-2 py-3"
              >
                <p className="font-song text-[26px] leading-relaxed tracking-[.14em] text-inkFaint/80 md:text-[30px]">
                  请赐上联，待我应对
                </p>
                <p className="text-[12px] leading-relaxed text-inkFaint">
                  输入上联后点「为我对句」，可连点「换一换」多比较几个思路。
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {candidate && (
          <>
            <div className="divider-brush my-3" />
            <div className="flex flex-wrap items-center gap-2.5">
              <Btn variant="outline" onClick={onRefresh} disabled={loading} title="再想几个下句">
                {loading ? "翻页中…" : "换一换"}
              </Btn>
              <Btn
                variant={isFav ? "primary" : "outline"}
                onClick={onToggleFav}
                title={isFav ? "取消收藏" : "收藏这一副"}
              >
                {isFav ? "已收藏" : "收藏"}
              </Btn>
              <Btn variant="seal" onClick={onOpenCard} title="生成分享卡片">
                📜 生成卡片分享
              </Btn>

              <div className="ml-auto flex items-center gap-2">
                <Badge tone={SOURCE_META[candidate.source]?.tone ?? "info"}>
                  {sourceLabel(candidate.source)}
                </Badge>
                <Badge tone={candidate.analysis.tone.lengthEqual ? "good" : "warn"}>
                  平仄 {candidate.analysis.tone.grade}
                </Badge>
              </div>
            </div>

            {(candidate.note || candidate.homophone || candidate.device) && (
              <div className="mt-3 space-y-1.5">
                {candidate.device && (
                  <p className="rounded border border-cinnabar/25 bg-accentSoft/60 px-2.5 py-1.5 text-[12px] leading-relaxed text-cinnabar">
                    机关：{candidate.device}
                  </p>
                )}
                {candidate.note && (
                  <p className="text-[12px] leading-relaxed text-inkFaint">{candidate.note}</p>
                )}
                {candidate.homophone && (
                  <p className="text-[12px] leading-relaxed text-cinnabar">
                    谐音点：{candidate.homophone}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
