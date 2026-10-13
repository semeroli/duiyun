// 色板求解器：给定前景/背景与目标对比度，找出「改动最小」的那个色值
// 跑法：node _audit/solve.mjs
function hex2rgb(h) {
  h = h.trim();
  if (h.startsWith("rgb")) {
    const p = h.match(/([\d.]+)/g).map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  let s = h.slice(1);
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
const toHex = (a) => "#" + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
function over(fg, bg) {
  const f = hex2rgb(fg), b = hex2rgb(bg);
  const a = f.length > 3 ? f[3] : 1;
  return [f[0] * a + b[0] * (1 - a), f[1] * a + b[1] * (1 - a), f[2] * a + b[2] * (1 - a)];
}
function lum(rgb) {
  const c = rgb.slice(0, 3).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
const R = (fg, bg) => ratio(hex2rgb(fg), hex2rgb(bg));

/** 沿「朝黑或朝白」方向等比例推进，找出刚好达标的 t（0=原色，1=纯黑/纯白） */
function solve(fg, bg, target, dir) {
  const base = hex2rgb(fg);
  const end = dir === "dark" ? [0, 0, 0] : [255, 255, 255];
  let lo = 0, hi = 1, best = null;
  for (let i = 0; i < 60; i++) {
    const t = (lo + hi) / 2;
    const c = [0, 1, 2].map((k) => base[k] + (end[k] - base[k]) * t);
    const r = R(toHex(c), bg);
    if (r >= target) { best = c; hi = t; } else lo = t;
  }
  return best ? toHex(best) : null;
}

/** 半透明叠加色：调 alpha 让它对底色达到 target（用于边框）；求「刚好达标的最小 alpha」 */
function solveAlpha(rgb600, bg, target) {
  let lo = 0, hi = 1, best = null;
  for (let i = 0; i < 60; i++) {
    const a = (lo + hi) / 2;
    const c = over(`rgba(${rgb600},${a})`, bg);
    if (ratio(c, hex2rgb(bg)) >= target) { best = a; hi = a; } else lo = a;
  }
  return best === null ? null : Math.round(best * 1000) / 1000;
}

const themes = {
  silk: { bg: "#faf7f2", panel: "#fffdf9", inkFaint: "#8b7a62", gold: "#b08a3e", cinnabar: "#c43d3d", line: "rgba(44,36,22,0.13)", lineStrong: "rgba(44,36,22,0.28)", inkRgb: "44,36,22" },
  spring: { bg: "#fff6ea", panel: "#fffbf5", inkFaint: "#9c7059", gold: "#a8761f", cinnabar: "#c0271f", line: "rgba(150,45,30,0.2)", lineStrong: "rgba(150,45,30,0.38)", inkRgb: "150,45,30" },
  night: { bg: "#171310", panel: "#241d17", inkFaint: "#9c8763", gold: "#d9b96a", cinnabar: "#d2694a", line: "rgba(237,223,192,0.16)", lineStrong: "rgba(237,223,192,0.34)", inkRgb: "237,223,192" },
};

for (const [name, t] of Object.entries(themes)) {
  const dark = name === "night";
  const toward = dark ? "light" : "dark";
  console.log(`\n════ ${name}（背景朝${dark ? "白" : "黑"}推）════`);
  console.log(`  现在  ink-faint ${t.inkFaint} = ${R(t.inkFaint, t.bg).toFixed(2)}:1`);

  const nf = solve(t.inkFaint, t.bg, 4.5, toward);
  console.log(`  ✅建议 ink-faint ${nf} = ${R(nf, t.bg).toFixed(2)}:1（bg）/ ${R(nf, t.panel).toFixed(2)}:1（面板）`);

  const goldTxt = solve(t.gold, t.bg, 4.5, toward);
  console.log(`  现在  gold 作文字 ${t.gold} = ${R(t.gold, t.bg).toFixed(2)}:1`);
  console.log(`  ✅建议 gold-text ${goldTxt} = ${R(goldTxt, t.bg).toFixed(2)}:1   （gold 保留作装饰/描边）`);

  // cinnabar 文字叠在 accent-soft 浅红底上。
  // ⚠️ 必须按「底部是面板」来解 —— 面板与页面底色不同，浅红底叠上去也不一样，
  //    夜读主题下两者差得最远（bg #311f18 vs 面板 #3c281e），要取更严的那个。
  const softCss = name === "silk" ? "rgba(196,61,61,0.09)" : name === "spring" ? "rgba(192,39,31,0.1)" : "rgba(210,105,74,0.14)";
  const softBg = toHex(over(softCss, t.bg));
  const softPanel = toHex(over(softCss, t.panel));
  const worst = R(t.cinnabar, softPanel) < R(t.cinnabar, softBg) ? softPanel : softBg;
  const cin = solve(t.cinnabar, worst, 4.5, toward);
  console.log(`  现在  cinnabar on 浅红底 = ${R(t.cinnabar, softBg).toFixed(2)}:1(bg) / ${R(t.cinnabar, softPanel).toFixed(2)}:1(面板)`);
  console.log(`  ✅建议 cinnabar-on-soft ${cin} = ${R(cin, softBg).toFixed(2)}:1(bg) / ${R(cin, softPanel).toFixed(2)}:1(面板)`);

  const aLine = solveAlpha(t.inkRgb, t.panel, 3);
  const aStrong = solveAlpha(t.inkRgb, t.panel, 3);
  console.log(`  现在  line 边框 = ${R(toHex(over(t.line, t.panel)), t.panel).toFixed(2)}:1   line-strong = ${R(toHex(over(t.lineStrong, t.panel)), t.panel).toFixed(2)}:1`);
  console.log(`  ✅输入框边框需 ≥3:1 ⇒ rgba(${t.inkRgb}, ${aLine}) = ${R(toHex(over(`rgba(${t.inkRgb},${aLine})`, t.panel)), t.panel).toFixed(2)}:1`);
  console.log(`     （line-strong 若也用作必要边界，同样抬到 rgba(${t.inkRgb}, ${aStrong})）`);
}
