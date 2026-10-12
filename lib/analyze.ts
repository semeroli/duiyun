/**
 * 四维解析的组装层
 * ------------------------------------------------------------------
 * 分工原则：
 *   - 平仄：**永远**由本地算法计算（确定性、可复核），不接受模型给的符号。
 *   - 词性：优先用词典本地计算，保证上下联用同一把尺子。
 *   - 意境：AI 给的说明优先；降级时用意象类目自动生成一段可读文字。
 *   - 典故：AI 给的优先；没有则查本地 `data/allusions.ts` 关键词库。
 */

import { ALLUSIONS } from "./data/allusions";
import { comparePos, segment } from "./pos";
import { compareTone } from "./tone";
import type {
  AllusionAnalysis,
  ConceptionAnalysis,
  CoupletAnalysis,
  Harmony,
} from "./types";

export interface AnalyzeHints {
  conception?: string;
  allusion?: AllusionAnalysis;
  harmony?: Harmony;
  upperImages?: string[];
  lowerImages?: string[];
}

/** 能构成「意象」的类目（抽象的如「数字/方位/虚词」不算） */
const IMAGE_CATEGORIES = new Set([
  "天文",
  "地理",
  "时令",
  "动植物",
  "山水",
  "器物",
  "建筑",
  "饮食",
  "身体",
  "颜色",
  "情感",
  "人事",
]);

function imageEntries(text: string): { word: string; category: string }[] {
  const out: { word: string; category: string }[] = [];
  const seen = new Set<string>();
  for (const s of segment(text)) {
    if (!IMAGE_CATEGORIES.has(s.category)) continue;
    if (seen.has(s.category)) continue;
    seen.add(s.category);
    out.push({ word: s.word, category: s.category });
  }
  return out;
}

/** 本地典故检索：上联或下联里出现关键词即命中 */
export function findAllusion(text: string, max = 1): AllusionAnalysis {
  const hits: AllusionAnalysis[] = [];
  for (const a of ALLUSIONS) {
    if (a.keywords.some((k) => text.includes(k))) {
      hits.push({
        has: true,
        title: a.title,
        source: a.source,
        explain: a.explain,
        quote: a.quote,
      });
      if (hits.length >= max) break;
    }
  }
  return hits[0] ?? { has: false };
}

function buildConception(
  upper: string,
  lower: string,
  uImgs: { word: string; category: string }[],
  lImgs: { word: string; category: string }[],
  hints: AnalyzeHints
): ConceptionAnalysis {
  const shared = uImgs.filter((u) => lImgs.some((l) => l.category === u.category));

  let harmony: Harmony = "待打磨";
  if (shared.length >= 1) harmony = "呼应";
  else if (uImgs.length && lImgs.length) harmony = "相衬";
  if (hints.harmony) harmony = hints.harmony;

  const upperImages = uImgs.map((x) => x.word).slice(0, 6);
  const lowerImages = lImgs.map((x) => x.word).slice(0, 6);
  const sharedImages = Array.from(new Set(shared.map((x) => x.word))).slice(0, 6);

  let summary = (hints.conception ?? "").trim();
  if (!summary) {
    if (!upperImages.length && !lowerImages.length) {
      summary =
        "两句用词偏于叙述，意象不明显。若想加强呼应，可各嵌入一处具体物象（如月、雪、舟、灯）。";
    } else if (shared.length) {
      summary = `上下联同取「${shared
        .map((x) => x.word)
        .join("、")}」一路意象，${upper ? `上联以「${upperImages.join("")}」起笔` : "上联起笔"}，${
        lower ? `下联以「${lowerImages.join("")}」承接` : "下联承接"
      }，情境相生，读来如一气贯注。`;
    } else {
      summary = `上联取「${upperImages.join("、") || "叙述"}」之境，下联转「${
        lowerImages.join("、") || "议论"
      }」之思，一景一情，于对照中见呼应。`;
    }
  }

  return { summary, upperImages, lowerImages, sharedImages, harmony };
}

export function buildAnalysis(
  upperText: string,
  lowerText: string,
  hints: AnalyzeHints = {}
): CoupletAnalysis {
  const tone = compareTone(upperText, lowerText);
  const pos = comparePos(upperText, lowerText);

  const uImgs = hints.upperImages
    ? hints.upperImages.map((w) => ({ word: w, category: "人事" }))
    : imageEntries(upperText);
  const lImgs = hints.lowerImages
    ? hints.lowerImages.map((w) => ({ word: w, category: "人事" }))
    : imageEntries(lowerText);

  const conception = buildConception(upperText, lowerText, uImgs, lImgs, hints);

  let allusion: AllusionAnalysis = { has: false };
  if (hints.allusion && hints.allusion.has) {
    allusion = hints.allusion;
  } else {
    allusion = findAllusion(upperText + lowerText);
  }

  return { tone, pos, conception, allusion };
}
