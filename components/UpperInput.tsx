"use client";

/**
 * 上句输入区（卷轴样式）
 * 左右两端是卷轴轴头，底面叠一层竹帘纹理；题签竖排在右侧。
 */

import { motion } from "framer-motion";
import { Btn } from "./ui";
import { onlyHanzi } from "@/lib/hanzi";

const EXAMPLES = [
  "春风又绿江南岸",
  "两个黄鹂鸣翠柳",
  "海内存知己",
  "天增岁月人增寿",
  "青山不墨千秋画",
];

export default function UpperInput({
  value,
  onChange,
  onGenerate,
  onClear,
  loading,
}: {
  value: string;
  onChange: (v: string) => void;
  onGenerate: () => void;
  onClear: () => void;
  loading: boolean;
}) {
  const n = onlyHanzi(value).length;
  const tooShort = n > 0 && n < 2;

  return (
    <div className="relative">
      {/* 卷轴轴头 */}
      <div className="scroll-rod pointer-events-none absolute -left-1.5 bottom-3 top-3 w-3 rounded-full" />
      <div className="scroll-rod pointer-events-none absolute -right-1.5 bottom-3 top-3 w-3 rounded-full" />

      <div className="paper-panel relative overflow-hidden px-5 py-5 md:px-14 md:py-8">
        <div className="bamboo-veil pointer-events-none absolute inset-0 opacity-25" />

        {/* 右上方题签 */}
        <div className="pointer-events-none absolute right-2 top-3 hidden md:block">
          <div className="vertical-title rounded-b-md border border-line bg-accentSoft/70 px-1.5 py-2 font-song text-[12px] text-cinnabar">
            上联
          </div>
        </div>

        <div className="relative">
          <div className="mb-2 flex items-center gap-2 md:hidden">
            <span className="rounded border border-line bg-accentSoft/70 px-1.5 py-[2px] font-song text-[11px] text-cinnabar">
              上联
            </span>
          </div>

          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                if (!loading) onGenerate();
              }
            }}
            rows={2}
            maxLength={48}
            spellCheck={false}
            placeholder="请输入上联…"
            aria-label="上联输入框"
            className="w-full resize-none bg-transparent font-song text-[26px] leading-[1.75] tracking-[.16em] text-ink outline-none placeholder:text-inkFaint/55 md:text-[34px]"
          />

          <div className="divider-brush my-3" />

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="font-song text-[12px] tracking-widest text-inkFaint">
              共 <span className="text-cinnabar">{n}</span> 字
            </span>
            {tooShort && <span className="text-[12px] text-cinnabar">至少 2 个字才能成对</span>}
            {n >= 2 && n < 5 && <span className="text-[12px] text-inkFaint">少于五言，属短联</span>}
            {(n === 5 || n === 7) && (
              <span className="text-[12px] text-emerald-700">正是{n === 5 ? "五" : "七"}言，最见功力</span>
            )}
            {n > 7 && <span className="text-[12px] text-inkFaint">长联，考验铺陈</span>}

            <span className="ml-auto hidden text-[11px] text-inkFaint md:inline">
              Ctrl / ⌘ + Enter 快速成对
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <Btn
              variant="primary"
              size="lg"
              onClick={onGenerate}
              disabled={loading || n < 2}
              title="生成下联"
            >
              {loading ? "正在应对…" : "为我对句"}
            </Btn>
            <Btn variant="ghost" size="lg" onClick={onClear} disabled={loading || !value}>
              清空
            </Btn>
          </div>

          {/* 示例 */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="font-song text-[11px] tracking-widest text-inkFaint">试试这些</span>
            {EXAMPLES.map((ex, i) => (
              <motion.button
                key={ex}
                type="button"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.3 }}
                onClick={() => onChange(ex)}
                className="rounded-full border border-line px-3 py-1 font-song text-[12px] tracking-wide text-inkSoft transition-colors hover:border-cinnabar/50 hover:bg-accentSoft hover:text-cinnabar"
              >
                {ex}
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
