/**
 * 平仄计算（确定性算法，不交给模型猜）
 * ------------------------------------------------------------------
 * 口径说明（教学用，界面上会原样告诉用户）：
 *   1. 今音取调：阴平(1)、阳平(2) → 平声 ○；上声(3)、去声(4) → 仄声 ●；
 *      轻声(0) 无法判定 → ×（不计入工整度分母）。
 *   2. 入声修正：中古入声字在普通话里已派入四声，「今读平声」的白、一、石、学……
 *      古韵仍属仄声，按 `data/ruSheng.ts` 改判为 ●。
 *   3. 多音字：pinyin-pro 取日常读音，个别字在对联语境下另有习惯读法，
 *      由 READING_OVERRIDE 兜底。
 */

import { pinyin } from "pinyin-pro";
import { RU_SHENG_CHARS } from "./data/ruSheng";
import { hanziList, isHanzi, onlyHanzi, toneMark } from "./hanzi";
import type { Tone, ToneAnalysis, ToneChar, ToneGrade, TonePair } from "./types";

// 这些纯字符串工具已下沉到 lib/hanzi.ts（首屏组件会直接用），此处再导出一次，
// 让 `lib/pos.ts` / `lib/localEngine.ts` 的旧引用保持可用。
export { hanziList, isHanzi, onlyHanzi, toneMark } from "./hanzi";

const RU_SET: Set<string> = new Set(RU_SHENG_CHARS);

/**
 * 对联语境下与日常读音不同的常见多音字。
 * 只放「确有分歧」的字，其余交给 pinyin-pro，避免过度干预。
 */
const READING_OVERRIDE: Record<string, Tone> = {
  看: "ze", // kàn，与「守看」之 kān 取常用义
  望: "ze",
  过: "ze",
  教: "ze",
  忘: "ze",
  胜: "ze",
  数: "ze",
  令: "ze",
  宿: "ze",
  骑: "ping", // 诗联中多作 qí
  长: "ping", // 多取 cháng
  相: "ping",
  应: "ping",
  思: "ping",
  中: "ping",
  重: "ze", // 多取 zhòng
  横: "ping",
  吹: "ping",
};

function toneFromSyllable(syllable: string): Tone {
  const m = /([0-9])$/.exec(syllable || "");
  if (!m) return "unknown";
  const d = Number(m[1]);
  if (d === 1 || d === 2) return "ping";
  if (d === 3 || d === 4) return "ze";
  return "unknown"; // 轻声
}

/** 整句取音（带上下文，多音字更准），长度对不上就逐字兜底 */
function readSyllables(chars: string[]): string[] {
  let arr: string[] = [];
  try {
    arr = pinyin(chars.join(""), { toneType: "num", type: "array" }) as unknown as string[];
  } catch {
    arr = [];
  }
  const kept = arr.filter((s) => isHanzi(s));
  if (kept.length === chars.length) return kept;
  return chars.map((c) => {
    try {
      return String(pinyin(c, { toneType: "num" }));
    } catch {
      return "";
    }
  });
}

/** 带调号拼音，用于教学展示（lǜ 而非 lü4） */
function readSymbols(chars: string[]): string[] {
  try {
    const arr = pinyin(chars.join(""), { toneType: "symbol", type: "array" }) as unknown as string[];
    const kept = arr.filter((s) => isHanzi(s));
    if (kept.length === chars.length) return kept;
  } catch {
    /* 落到逐字 */
  }
  return chars.map((c) => {
    try {
      return String(pinyin(c, { toneType: "symbol" }));
    } catch {
      return "";
    }
  });
}

/** 单句逐字平仄（带缓存：本地引擎逐词求平仄时会反复问同一句） */
const TONE_CACHE = new Map<string, ToneChar[]>();

export function analyzeTone(text: string): ToneChar[] {
  const key = text ?? "";
  const cached = TONE_CACHE.get(key);
  if (cached) return cached;

  const chars = hanziList(key);
  if (!chars.length) return [];
  const syl = readSyllables(chars);
  const sym = readSymbols(chars);
  const result = chars.map((c, i) => {
    let tone = toneFromSyllable(syl[i] ?? "");
    const ov = READING_OVERRIDE[c];
    if (ov) tone = ov;
    let byRuSheng: boolean | undefined;
    if (RU_SET.has(c)) {
      byRuSheng = true;
      if (tone === "ping") tone = "ze";
    }
    return { char: c, tone, pinyin: sym[i] ?? "", byRuSheng };
  });

  if (TONE_CACHE.size > 4000) TONE_CACHE.clear();
  TONE_CACHE.set(key, result);
  return result;
}

/** ○● 可视化串 */
export function marksOf(chars: ToneChar[]): string {
  return chars.map((c) => toneMark(c.tone)).join("");
}

/** 工整度分级（平仄与词性共用同一把尺子） */
export function gradeOf(ratio: number, total: number): ToneGrade {
  if (total <= 0) return "待推敲";
  if (ratio >= 0.78) return "工整";
  if (ratio >= 0.6) return "较工整";
  if (ratio >= 0.4) return "宽松";
  return "待推敲";
}

function lastKnown(chars: ToneChar[]): ToneChar | null {
  for (let i = chars.length - 1; i >= 0; i--) {
    if (chars[i].tone !== "unknown") return chars[i];
  }
  return null;
}

/** 上下联平仄对照 */
export function compareTone(upperText: string, lowerText: string): ToneAnalysis {
  const upperChars = analyzeTone(upperText);
  const lowerChars = analyzeTone(lowerText);
  const n = Math.max(upperChars.length, lowerChars.length);

  const pairs: TonePair[] = [];
  for (let i = 0; i < n; i++) {
    const a = upperChars[i] ?? null;
    const b = lowerChars[i] ?? null;
    const ok =
      a && b && a.tone !== "unknown" && b.tone !== "unknown" ? a.tone !== b.tone : null;
    pairs.push({ upper: a, lower: b, ok });
  }

  const matched = pairs.filter((p) => p.ok === true).length;
  const total = pairs.filter((p) => p.ok !== null).length;
  const ratio = total ? matched / total : 0;
  const lengthEqual = upperChars.length > 0 && upperChars.length === lowerChars.length;
  const grade: ToneGrade = lengthEqual ? gradeOf(ratio, total) : "待推敲";

  const parts: string[] = [];
  if (!upperChars.length || !lowerChars.length) {
    parts.push("尚缺上联或下联，无法对照。");
  } else if (!lengthEqual) {
    parts.push(
      `上下联字数不等（上 ${upperChars.length} 字、下 ${lowerChars.length} 字），而对联以字数相等为前提。`
    );
  } else {
    parts.push(`${total} 个可判定位置中有 ${matched} 处平仄相对`);
    const ue = lastKnown(upperChars);
    const le = lastKnown(lowerChars);
    if (ue && le) {
      // 先把两个声调取成独立常量：否则 TS 会因为上面 if 的联合收窄，
      // 误判下面分支「没有交集」而报编译错误（这里确实踩过）
      const ut: Tone = ue.tone;
      const lt: Tone = le.tone;
      if (ut === "ze" && lt === "ping") {
        parts.push(`末字上仄（${ue.char}）下平（${le.char}），收尾合律`);
      } else if (ut === "ping") {
        parts.push(`上联末字「${ue.char}」为平声，传统上联宜以仄声收尾`);
      } else if (lt === "ze") {
        parts.push(`下联末字「${le.char}」为仄声，下联宜以平声收尾`);
      } else if (ut === "unknown" || lt === "unknown") {
        parts.push("末字读音未能判定，未作收尾结论");
      } else {
        parts.push(`末字上仄下仄，两句同声收尾，宜改一处`);
      }
    }
    parts.push(`平仄工整度：${grade}。`);
  }

  return {
    upperChars,
    lowerChars,
    upperMarks: marksOf(upperChars),
    lowerMarks: marksOf(lowerChars),
    pairs,
    matched,
    total,
    ratio,
    grade,
    summary: parts.join("，").replace(/，。/g, "。"),
    lengthEqual,
  };
}

const WORD_TONE_CACHE = new Map<string, Tone>();

/** 判断某个词的古韵平仄倾向，供本地引擎挑选「平仄相反」的对仗词 */
export function wordTone(word: string): Tone {
  const cached = WORD_TONE_CACHE.get(word);
  if (cached) return cached;
  const chars = analyzeTone(word);
  const t: Tone = chars.length ? chars[chars.length - 1].tone : "unknown";
  if (WORD_TONE_CACHE.size > 4000) WORD_TONE_CACHE.clear();
  WORD_TONE_CACHE.set(word, t);
  return t;
}
