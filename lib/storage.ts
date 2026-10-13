/**
 * 本地存储（收藏 / 设置）
 * ------------------------------------------------------------------
 * 刻意不引入数据库：收藏是私人物品，放浏览器即可；
 * 所有读取都有 try/catch，隐私模式下也不会崩。
 */

import { DEFAULT_THEME, type ThemeId } from "./themes";
import type { AllusionAnalysis, CoupletKind, CoupletSource } from "./types";

const SETTINGS_KEY = "duiyun:settings:v1";
const FAVORITES_KEY = "duiyun:favorites:v1";

export interface Settings {
  theme: ThemeId;
  sound: boolean;
  learning: boolean;
}

/**
 * 收藏项。
 * 刻意把「意境说明 / 典故」一起存下来 —— 不然从收藏里重新载入时，
 * AI 写过的那段解析就丢了，只能退回本地模板文案。
 * 平仄与词性不存：它们是确定性计算，载入时重算一次即可，还能顺带修正旧数据。
 */
export interface FavoriteItem {
  id: string;
  upper: string;
  lower: string;
  kind: CoupletKind;
  note?: string;
  homophone?: string;
  /** 机关对的机关说明（拆字 / 组字 / 同旁等），与 note 一并存下来 */
  device?: string;
  /** 公认「绝对」的说明，载入收藏时也要一起还原 */
  unsolved?: string;
  conception?: string;
  allusion?: AllusionAnalysis;
  source?: CoupletSource;
  at: number;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: DEFAULT_THEME,
  sound: false, // 默认静音
  learning: false,
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadSettings(): Settings {
  if (!canUseStorage()) return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      theme: (["silk", "night", "spring"] as const).includes(parsed.theme as ThemeId)
        ? (parsed.theme as ThemeId)
        : DEFAULT_SETTINGS.theme,
      sound: parsed.sound === true,
      learning: parsed.learning === true,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* 忽略 */
  }
}

export function loadFavorites(): FavoriteItem[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is FavoriteItem =>
        !!x && typeof x.upper === "string" && typeof x.lower === "string"
    );
  } catch {
    return [];
  }
}

export function saveFavorites(list: FavoriteItem[]): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(list.slice(0, 300)));
  } catch {
    /* 忽略 */
  }
}
