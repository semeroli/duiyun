/**
 * 词性对仗计算
 * ------------------------------------------------------------------
 * 分词策略：用 `data/lexicon.ts` 作为词典，从左到右「最长匹配」（最多 3 字）。
 * 词典命中的词带词性（名词/动词/形容词…），未命中的单字记为「未知」并
 * 在计算工整度时排除（不冤枉用户）。
 *
 * 对齐策略：按「字位」对齐而非按词数对齐 —— 因为上下联字数相等，
 * 字位对齐天然正确；上联每个词段取其在句中占据的字位区间，去下联同区间
 * 取对应字串，这样即便两句分词边界不同也能给出可读的对照表。
 */

import { LEXICON } from "./data/lexicon";
import { LEXICON_EXTRA } from "./data/lexicon2";
import { LEXICON_EXTRA2 } from "./data/lexicon3";
import { gradeOf, onlyHanzi, wordTone } from "./tone";
import type { PosAnalysis, PosPair, ToneGrade } from "./types";

export const UNKNOWN_POS = "未知";
export const MAX_WORD_LEN = 3;

export interface LexEntry {
  word: string;
  pos: string;
  category: string;
  /** 可对仗的词（与词典数据同源，本地引擎据此配对） */
  opposites: string[];
}

export interface Seg extends LexEntry {
  /** 该词段在整句「汉字数组」中的起始下标 */
  start: number;
}

/**
 * 合并顺序即优先级：主表 → 扩充卷 → 补遗卷。
 * 前面的先落位，后面的只补空缺 —— 这样以后改主表不会被悄悄覆盖。
 */
const ALL_ENTRIES = [...LEXICON, ...LEXICON_EXTRA, ...LEXICON_EXTRA2];

const BY_WORD = new Map<string, LexEntry>();
for (const e of ALL_ENTRIES) {
  if (!BY_WORD.has(e.word)) {
    BY_WORD.set(e.word, {
      word: e.word,
      pos: e.pos,
      category: e.category,
      opposites: e.opposites,
    });
  }
}

export function getLexiconEntry(word: string): LexEntry | undefined {
  return BY_WORD.get(word);
}

export function lexiconSize(): number {
  return BY_WORD.size;
}

/** 按「长度 + 词性」取候选词。
 *  结果做缓存：词表已上千条，每次线性扫描太慢。
 *
 *  ⚠️ 现在**没有任何生产逻辑在用它**：本地引擎曾经拿它当「找不到手写对仗词时的
 *  兜底池」，结果从上千条同词性词里随机抓词，产出的全是「水曾海识信是径」这类
 *  不成话的东西（详见 lib/localEngine.ts 顶部注释）。保留它只为测试台统计用，
 *  新代码别再拿它当生成词源。 */
const LEN_POS_CACHE = new Map<string, LexEntry[]>();

export function lexiconByLenPos(len: number, pos: string): LexEntry[] {
  const key = `${len}|${pos}`;
  const hit = LEN_POS_CACHE.get(key);
  if (hit) return hit;
  const out: LexEntry[] = [];
  for (const e of BY_WORD.values()) {
    if (e.word.length === len && e.pos === pos) out.push(e);
  }
  LEN_POS_CACHE.set(key, out);
  return out;
}

/** 最长匹配分词 */
export function segment(text: string): Seg[] {
  const chars = Array.from(onlyHanzi(text));
  const out: Seg[] = [];
  let i = 0;
  while (i < chars.length) {
    let hit: LexEntry | undefined;
    let len = 0;
    const maxLen = Math.min(MAX_WORD_LEN, chars.length - i);
    for (let L = maxLen; L >= 1; L--) {
      const w = chars.slice(i, i + L).join("");
      const e = BY_WORD.get(w);
      if (e) {
        hit = e;
        len = L;
        break;
      }
    }
    if (hit) {
      out.push({ ...hit, start: i });
      i += len;
    } else {
      out.push({
        word: chars[i],
        pos: UNKNOWN_POS,
        category: UNKNOWN_POS,
        opposites: [],
        start: i,
      });
      i += 1;
    }
  }
  return out;
}

function perCharPos(segs: Seg[], len: number): string[] {
  const arr: string[] = new Array(len).fill(UNKNOWN_POS);
  for (const s of segs) {
    for (let k = 0; k < s.word.length; k++) {
      if (s.start + k < len) arr[s.start + k] = s.pos;
    }
  }
  return arr;
}

function mode(list: string[]): string {
  const count = new Map<string, number>();
  for (const x of list) count.set(x, (count.get(x) ?? 0) + 1);
  let best = UNKNOWN_POS;
  let bestN = 0;
  for (const [k, v] of count) {
    if (v > bestN) {
      best = k;
      bestN = v;
    }
  }
  return best;
}

function gradeOfPos(ratio: number, total: number): ToneGrade {
  return gradeOf(ratio * 0.95, total);
}

export function comparePos(upperText: string, lowerText: string): PosAnalysis {
  const uSegs = segment(upperText);
  const lSegs = segment(lowerText);
  const uChars = Array.from(onlyHanzi(upperText));
  const lChars = Array.from(onlyHanzi(lowerText));
  const lPos = perCharPos(lSegs, lChars.length);

  const pairs: PosPair[] = uSegs.map((s) => {
    const lowerWord = lChars.slice(s.start, s.start + s.word.length).join("");
    const posSlice = lPos.slice(s.start, s.start + s.word.length);
    const known = posSlice.filter((p) => p !== UNKNOWN_POS);
    const lowerPos = known.length ? mode(known) : UNKNOWN_POS;
    const ok =
      s.pos !== UNKNOWN_POS && lowerPos !== UNKNOWN_POS && s.pos === lowerPos;
    return { upperWord: s.word, upperPos: s.pos, lowerWord, lowerPos, ok };
  });

  const comparable = pairs.filter((p) => p.upperPos !== UNKNOWN_POS && p.lowerPos !== UNKNOWN_POS);
  const matched = comparable.filter((p) => p.ok).length;
  const total = comparable.length;
  const ratio = total ? matched / total : 0;
  const grade: ToneGrade = total ? gradeOfPos(ratio, total) : "待推敲";

  const bad = comparable.filter((p) => !p.ok);
  const parts: string[] = [];
  if (!uChars.length || !lChars.length) {
    parts.push("尚缺上联或下联，无法对照。");
  } else if (!total) {
    parts.push("句中用词多不在常用对仗词表内，未能逐段判定词性。");
  } else {
    parts.push(`共 ${pairs.length} 个词段，其中 ${matched} 段与下联词性相同`);
    if (bad.length) {
      parts.push(
        `${bad
          .slice(0, 3)
          .map((p) => `「${p.upperWord}」(${p.upperPos}) 宜对「${p.lowerPos}」，实为「${p.lowerWord}」`)
          .join("；")}`
      );
    } else {
      parts.push("逐段词性一一对应");
    }
    parts.push(`词性工整度：${grade}。`);
  }

  return {
    upperWords: uSegs.map((s) => ({ word: s.word, pos: s.pos })),
    lowerWords: lSegs.map((s) => ({ word: s.word, pos: s.pos })),
    pairs,
    matched,
    total,
    ratio,
    grade,
    summary: parts.join("，").replace(/，。/g, "。"),
  };
}

/** 两个词是否平仄相反（本地引擎选对仗词时优先用） */
export function toneOpposes(a: string, b: string): boolean {
  const ta = wordTone(a);
  const tb = wordTone(b);
  if (ta === "unknown" || tb === "unknown") return false;
  return ta !== tb;
}

export type { Seg as PosSegment };
