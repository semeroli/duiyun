"use client";

/**
 * 学习模式侧栏：平仄规则 + 词性对照表
 * 桌面端固定在右侧，移动端落到正文下方。
 */

import { POS_TABLE, TONE_RULES } from "@/lib/data/tips";
import { Panel } from "./ui";

export default function LearningSidebar() {
  return (
    <div className="space-y-3">
      <Panel title="平仄规则" subtitle={`${TONE_RULES.length} 条`}>
        <ol className="space-y-3">
          {TONE_RULES.map((r, i) => (
            <li key={r.title} className="flex gap-2.5">
              <span className="mt-[3px] grid h-5 w-5 shrink-0 place-items-center rounded-full border border-line font-song text-[12px] text-inkFaint">
                {i + 1}
              </span>
              <div className="min-w-0">
                <div className="font-song text-[13px] tracking-wide text-ink">{r.title}</div>
                <p className="mt-1 text-[12px] leading-[1.85] text-inkSoft">{r.desc}</p>
                {r.example && (
                  <p className="mt-1 rounded border border-line bg-panelSolid/60 px-2 py-1 font-song text-[12px] tracking-wider text-inkSoft">
                    {r.example}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="词性对照表" subtitle="对仗的基本盘">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[260px] border-collapse text-[12px]">
            <thead>
              <tr className="text-left font-song text-[12px] tracking-[.16em] text-inkFaint">
                <th className="pb-2 pr-2 font-normal">词性</th>
                <th className="pb-2 pr-2 font-normal">说明</th>
                <th className="pb-2 font-normal">例词</th>
              </tr>
            </thead>
            <tbody>
              {POS_TABLE.map((row) => (
                <tr key={row.pos} className="border-t border-line align-top">
                  <td className="whitespace-nowrap py-2 pr-2 font-song text-[13px] text-ink">
                    {row.pos}
                  </td>
                  <td className="py-2 pr-2 leading-relaxed text-inkSoft">{row.desc}</td>
                  <td className="py-2 leading-relaxed text-inkFaint">
                    {row.examples.join("、")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 rounded-md border border-line bg-panelSolid/50 px-3 py-2 text-[12px] leading-relaxed text-inkFaint">
          口诀：名词对名词、动词对动词、形容词对形容词；数目对数目、颜色对颜色、方位对方位。
          实词对实词、虚词对虚词，切忌虚实混对。
        </p>
      </Panel>
    </div>
  );
}
