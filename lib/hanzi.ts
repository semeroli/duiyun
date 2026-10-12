/**
 * 汉字工具（零依赖，可以安全地进首屏包）
 * ------------------------------------------------------------------
 * 刻意与 `lib/tone.ts` 分开：tone.ts 依赖 pinyin-pro（较大），
 * 而组件里其实只需要「只留汉字」「平仄符号」这类纯字符串操作。
 * 拆开之后 pinyin-pro 只会在「本地引擎 / 收藏重算」时按需加载，
 * 首屏 JS 能少 100 KB 以上。
 */

import type { Tone } from "./types";

const HANZI_RE = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;

export function isHanzi(ch: string): boolean {
  return HANZI_RE.test(ch);
}

/** 只保留汉字，去掉标点/空格/字母/数字 */
export function onlyHanzi(text: string): string {
  return Array.from(text || "")
    .filter(isHanzi)
    .join("");
}

/** 拆成单字数组 */
export function hanziList(text: string): string[] {
  return Array.from(onlyHanzi(text));
}

/** 平 → ○；仄 → ●；未能判定 → × */
export function toneMark(t: Tone): string {
  return t === "ping" ? "○" : t === "ze" ? "●" : "×";
}
