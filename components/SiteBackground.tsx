"use client";

/**
 * 站点背景（落地页 / 博客 / 账号页共用）
 * ------------------------------------------------------------------
 * 直接复用工作台那套「淡墨远山 + 云雾」的背景，只解决一个问题：
 * LandscapeBg 需要知道当前主题（夜读要压暗、春节要挂灯笼）。
 *
 * 这里不去各页面各自存一份主题状态 —— 那必然和顶栏、工作台里的
 * 主题状态打架。改成**盯着 <html data-theme> 这个属性**：
 * 谁改的都不重要，属性一变背景就跟着变。
 * 这样「三个地方都能换主题」也不会互相覆盖。
 */

import { useEffect, useState } from "react";
import { DEFAULT_THEME, type ThemeId } from "@/lib/themes";
import LandscapeBg from "./LandscapeBg";

const VALID: ThemeId[] = ["silk", "spring", "night"];

function readTheme(): ThemeId {
  if (typeof document === "undefined") return DEFAULT_THEME;
  const v = document.documentElement.getAttribute("data-theme");
  return (VALID as string[]).includes(v ?? "") ? (v as ThemeId) : DEFAULT_THEME;
}

export default function SiteBackground() {
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    setTheme(readTheme());
    const obs = new MutationObserver(() => setTheme(readTheme()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  return <LandscapeBg theme={theme} />;
}
