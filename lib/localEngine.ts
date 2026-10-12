/**
 * 本地对联引擎（无 AI Key 时的主力）
 * ------------------------------------------------------------------
 * 两级策略，按可信度从高到低：
 *
 *   ① 名联库命中 —— 用户上联与库中条目贴合（精确相同 / 互为子串 /
 *      同字数且过半字位雷同），直接把库里的下联作为候选。质量最高，
 *      常常还能带出作者与出典。
 *
 *   ② 集句 —— 库里没有贴合条目时，从库中**所有真实句子**（名联的
 *      上句 + 下句，共约 180 句）里，挑平仄相对、词性相合的**整句**
 *      来当对句。集句本身就是对联的正规玩法（取古人成句成对），
 *      所以出来的每一句都是真句子：读得通、有出处、可供模仿。
 *      代价是语义未必呼应，界面用「集句」徽标 + 说明把这个前提讲清楚。
 *
 * 🔴 刻意不做的事：**把名联的句子当骨架、逐词替换成"对仗词"**。
 * 认真试过，结果是「菊岸风影浊似海」「病树前纸万木书」「石有山犀答真街」
 * 这类东西。病根不在选词不准（每个替换词在词表里都合法），而在
 * **骨架里没被替换的那些字（病树、前、万木）描述的是骨架自己的场景**，
 * 与用户的上联毫无关系 —— 逐词替换注定留下语义残骸。
 * 连"同类别才能替换"的约束也救不回来（只会变成「白树前头万木春」）。
 * 结论：宁可给一句"真句子"，也不给"机器拼出来但不成话"的句子。
 */

import { buildAnalysis } from "./analyze";
import { LIBRARY } from "./data/library";
import { lexiconSize } from "./pos";
import { onlyHanzi } from "./tone";
import {
  KIND_META,
  type CoupletAnalysis,
  type CoupletCandidate,
  type CoupletKind,
  type LibraryCouplet,
} from "./types";

export function normalizeUpper(raw: string): string {
  return onlyHanzi(raw);
}

function hashId(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function rotate<T>(arr: T[], seed: number): T[] {
  if (arr.length <= 1) return arr;
  const k = ((seed % arr.length) + arr.length) % arr.length;
  return [...arr.slice(k), ...arr.slice(0, k)];
}

/* ── ① 名联库打分 ───────────────────────────────────────── */

/**
 * 只按「对用户上联的贴合度」打分，**不含任何类型加分**。
 * 类型只用于排序优先级，绝不能参与「是否算命中」的判断 ——
 * 否则同类型的无关条目也会得分被选中，出现「7 字上联配 5 字下联」这种硬伤。
 */
function scoreLibrary(upper: string, entry: LibraryCouplet): number {
  if (entry.upper === upper) return 1000;
  if (entry.upper.includes(upper) || upper.includes(entry.upper)) {
    return 300 + Math.min(entry.upper.length, upper.length) * 2;
  }
  if (entry.upper.length === upper.length) {
    let same = 0;
    for (let i = 0; i < upper.length; i++) {
      if (upper[i] === entry.upper[i]) same += 1;
    }
    if (same >= Math.max(2, Math.ceil(upper.length / 2))) return 60 + same * 12;
  }
  return 0;
}

function sortByScore(list: { e: LibraryCouplet; s: number }[]) {
  return [...list].sort((a, b) => b.s - a.s || a.e.upper.length - b.e.upper.length);
}

/* ── ② 集句（借古人成句成对） ────────────────────────────── */

interface Sentence {
  line: string;
  /** 该句在原联里属上半还是下半 —— 出典要说清楚 */
  half: "上" | "下";
  from: LibraryCouplet;
}

let SENTENCE_CACHE: Sentence[] | null = null;

/** 句库 = 名联库里所有上句 + 所有下句（去重）。约 180 句，全是真句子。 */
function sentencePool(): Sentence[] {
  if (SENTENCE_CACHE) return SENTENCE_CACHE;
  const map = new Map<string, Sentence>();
  for (const e of LIBRARY) {
    if (!map.has(e.upper)) map.set(e.upper, { line: e.upper, half: "上", from: e });
    if (!map.has(e.lower)) map.set(e.lower, { line: e.lower, half: "下", from: e });
  }
  SENTENCE_CACHE = [...map.values()];
  return SENTENCE_CACHE;
}

/**
 * 分档门槛，先严后宽 —— 但**最宽一档也死守「平仄相对率 ≥ 0.6」**。
 * 平仄都不相对就不配叫对联，这是底线，宁可少给几条候选。
 * 词性门槛用来防「平仄满分但两句话根本不是一个语法结构」的怪配对
 * （实测过：「一蓑烟雨任平生 / 春色满园关不住」平仄 100%、词性只有 33%）。
 */
const JIJU_TIERS: { tone: number; pos: number }[] = [
  { tone: 0.7, pos: 0.6 },
  { tone: 0.65, pos: 0.45 },
  { tone: 0.6, pos: 0 },
];

interface Jiju {
  sentence: Sentence;
  score: number;
  analysis: CoupletAnalysis;
}

/**
 * 挑同字数、平仄相对、词性相合的**整句**。
 * 句库不大（同字数句通常 40~60 句），直接全量打分排序即可，不必做索引。
 *
 * `exclude` 必须把「名联库已经给出的下联」排除掉 —— 排除要是发生在轮换
 * **之后**，轮换就会空转一格（实测踩过：seed0 与 seed1 给出的三个候选完全一样，
 * 原因是池首那句正解被去重丢掉，rotate 白转了一圈）。
 */
function jijuCandidates(
  upper: string,
  want: number,
  seed: number,
  exclude: Set<string>
): Jiju[] {
  const len = upper.length;
  const pool = sentencePool().filter(
    (s) => s.line.length === len && s.line !== upper && !exclude.has(s.line)
  );
  if (!pool.length) return [];

  const scored = pool.map((s) => {
    const analysis = buildAnalysis(upper, s.line);
    return { s, analysis, score: analysis.tone.ratio * 1.5 + analysis.pos.ratio * 3 };
  });
  scored.sort((a, b) => b.score - a.score);

  const picked: Jiju[] = [];
  const seen = new Set<string>();
  // 池子留得比 count 大，让「换一换」真能翻出别的句子
  const cap = want + 9;
  for (const tier of JIJU_TIERS) {
    for (const x of scored) {
      if (picked.length >= cap) break;
      if (seen.has(x.s.line)) continue;
      if (x.analysis.tone.ratio < tier.tone) continue;
      if (x.analysis.pos.ratio < tier.pos) continue;
      seen.add(x.s.line);
      picked.push({ sentence: x.s, score: x.score, analysis: x.analysis });
    }
    if (picked.length >= cap) break;
  }
  return rotate(picked, seed);
}

/* ── 组装候选 ───────────────────────────────────────────── */

function fromLibrary(
  upper: string,
  entry: LibraryCouplet,
  requestedKind: CoupletKind
): CoupletCandidate {
  const base = entry.author ? `本地库收录 · ${entry.author}` : "本地库收录";
  const kindNote =
    entry.kind === requestedKind ? "" : `；此联本身属「${KIND_META[entry.kind].label}」`;
  return {
    id: `lib-${hashId(entry.upper + entry.lower)}`,
    upper,
    lower: entry.lower,
    kind: requestedKind,
    source: "local",
    analysis: buildAnalysis(upper, entry.lower, {
      conception: entry.conception,
      allusion: entry.allusion
        ? {
            has: true,
            title: entry.allusion.title,
            source: entry.allusion.source,
            explain: entry.allusion.explain,
            quote: entry.allusion.quote,
          }
        : undefined,
    }),
    note: base + kindNote,
    homophone: entry.homophone,
  };
}

function fromJiju(upper: string, s: Sentence, kind: CoupletKind, analysis: CoupletAnalysis): CoupletCandidate {
  const author = s.from.author ? `（${s.from.author}）` : "";
  return {
    id: `jju-${hashId(upper + s.line)}`,
    upper,
    lower: s.line,
    kind,
    source: "jiju",
    analysis,
    note:
      `集句 · 取自「${s.from.upper}」的${s.half}句${author}。` +
      "集句是对联的正规玩法（取古人成句成对），重格律与词性；语义未必与你这句呼应，可当格律范本参考。",
  };
}

/**
 * 生成候选下联。
 * @param seed 「换一换」时递增，用于在同类候选之间轮换
 */
export function generateLocal(
  upperRaw: string,
  kind: CoupletKind,
  count = 3,
  seed = 0
): CoupletCandidate[] {
  const upper = normalizeUpper(upperRaw);
  if (!upper) return [];

  // 命中条件只有两条：贴合度 > 0，且**上下联字数都与用户上联相等**。
  // 第二条是硬闸门 —— 缺了它就会把「铁肩担道义 / 妙手著文章」(5+5)
  // 配给 7 字上联，这是最容易出、也最丢人的一种错。
  const matched = LIBRARY.map((e) => ({ e, s: scoreLibrary(upper, e) })).filter(
    (x) => x.s > 0 && x.e.upper.length === upper.length && x.e.lower.length === upper.length
  );

  // 排序优先级：同类 → 异类；组内先「完全命中」，其余按 seed 轮换，
  // 保证「换一换」真能翻到不同的候选。
  const sameKind = sortByScore(matched.filter((x) => x.e.kind === kind));
  const otherKind = sortByScore(matched.filter((x) => x.e.kind !== kind));
  const ordered = [
    ...sameKind.filter((x) => x.s >= 1000),
    ...rotate(
      sameKind.filter((x) => x.s < 1000),
      seed
    ),
    ...otherKind.filter((x) => x.s >= 1000),
    ...rotate(
      otherKind.filter((x) => x.s < 1000),
      seed
    ),
  ];

  const out: CoupletCandidate[] = [];
  const seen = new Set<string>();
  for (const { e } of ordered) {
    if (out.length >= count) break;
    if (seen.has(e.lower)) continue;
    seen.add(e.lower);
    out.push(fromLibrary(upper, e, kind));
  }

  if (out.length < count) {
    for (const b of jijuCandidates(upper, count, seed, seen)) {
      if (out.length >= count) break;
      if (seen.has(b.sentence.line)) continue;
      seen.add(b.sentence.line);
      out.push(fromJiju(upper, b.sentence, kind, b.analysis));
    }
  }

  return out.slice(0, count);
}

/** 语料规模：界面上用来说清「为什么能离线跑」 */
export function localEngineStats(): { couplets: number; lines: number; words: number } {
  return { couplets: LIBRARY.length, lines: sentencePool().length, words: lexiconSize() };
}

/** 句库中最长的句子字数 —— 用户在旁边提示「超出这个长度就得靠 AI 了」 */
export function maxLineLength(): number {
  return sentencePool().reduce((m, s) => Math.max(m, s.line.length), 0);
}
