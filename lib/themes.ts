/**
 * 主题定义
 */

export type ThemeId = "silk" | "night" | "spring";

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  hint: string;
  /** 供 CSS 选择器使用：[data-theme="..."] */
  attr: string;
}

export const THEMES: ThemeMeta[] = [
  { id: "silk", label: "素雅宣纸", hint: "默认 · 文人书房", attr: "silk" },
  { id: "spring", label: "春节喜庆", hint: "红金配色 · 写春联", attr: "spring" },
  { id: "night", label: "夜读暗色", hint: "深褐底 · 金字", attr: "night" },
];

export const DEFAULT_THEME: ThemeId = "silk";

/** 卡片导出比例（分享场景） */
export interface CardRatio {
  id: string;
  label: string;
  hint: string;
  width: number;
  height: number;
}

export const CARD_RATIOS: CardRatio[] = [
  { id: "square", label: "朋友圈 1:1", hint: "方形 · 稳妥", width: 1080, height: 1080 },
  { id: "poster", label: "小红书 3:4", hint: "竖版 · 信息量足", width: 1080, height: 1440 },
  { id: "wide", label: "横版 4:3", hint: "课件 · 投影好用", width: 1440, height: 1080 },
];
