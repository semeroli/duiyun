// 三套主题的设计 token 级对比度体检（含半透明叠底合成）
// 跑法：node _audit/theme-contrast.mjs
import { readFileSync } from "node:fs";

const css = readFileSync("app/globals.css", "utf8");

function parseTheme(name) {
  const re = new RegExp(`\\[data-theme="${name}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`, "m");
  const m = css.match(re);
  if (!m) throw new Error("没找到主题 " + name);
  const out = {};
  for (const line of m[1].split(/\n/)) {
    const mm = line.match(/^\s*(--[a-z0-9-]+):\s*(.+?);\s*$/);
    if (mm) out[mm[1]] = mm[2].trim();
  }
  return out;
}
// silk 是 :root 与 [data-theme="silk"] 共用，单独抓
const rootM = css.match(/:root,\s*\n\[data-theme="silk"\]\s*\{([\s\S]*?)\n\}/);
const themes = {
  silk: (() => {
    const out = {};
    for (const line of rootM[1].split(/\n/)) {
      const mm = line.match(/^\s*(--[a-z0-9-]+):\s*(.+?);\s*$/);
      if (mm) out[mm[1]] = mm[2].trim();
    }
    return out;
  })(),
  spring: parseTheme("spring"),
  night: parseTheme("night"),
};

function hex2rgb(h) {
  h = h.trim();
  if (h.startsWith("#")) {
    let s = h.slice(1);
    if (s.length === 3) s = s.split("").map((c) => c + c).join("");
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  }
  const m = h.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error("解析不了颜色：" + h);
  const p = m[1].split(",").map((x) => parseFloat(x));
  return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
}

/** 把前景（可能带 alpha）合成到不透明背景上 */
function over(fg, bg) {
  const f = hex2rgb(fg);
  const b = hex2rgb(bg);
  const a = f.length > 3 ? f[3] : 1;
  return [Math.round(f[0] * a + b[0] * (1 - a)), Math.round(f[1] * a + b[1] * (1 - a)), Math.round(f[2] * a + b[2] * (1 - a))];
}

function lum(rgb) {
  const c = rgb.slice(0, 3).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const l1 = lum(a);
  const l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const r2 = (n) => Math.round(n * 100) / 100;
function mark(r, need) {
  return r >= need ? "  ok " : "  ✗  ";
}

for (const [name, t] of Object.entries(themes)) {
  const bg = t["--bg"];
  const bg2 = t["--bg-2"];
  const panel = t["--panel-solid"];
  // accent-soft 是半透明的，分别合成到 bg / panel
  const accOnBg = `rgb(${over(t["--accent-soft"], bg).join(",")})`;
  const accOnPanel = `rgb(${over(t["--accent-soft"], panel).join(",")})`;

  const rows = [
    ["正文 ink / bg", t["--ink"], bg, 4.5],
    ["次级 ink-soft / bg", t["--ink-soft"], bg, 4.5],
    ["🔴 弱化 ink-faint / bg", t["--ink-faint"], bg, 4.5],
    ["弱化 ink-faint / 面板", t["--ink-faint"], panel, 4.5],
    ["次级 ink-soft / 面板", t["--ink-soft"], panel, 4.5],
    ["朱红 cinnabar / bg", t["--cinnabar"], bg, 4.5],
    ["🔴 朱红文字 on 浅红底(accent-soft)", t["--cinnabar"], accOnBg, 4.5],
    ["朱红文字 on 浅红底 / 面板", t["--cinnabar"], accOnPanel, 4.5],
    ["金 gold / bg", t["--gold"], bg, 4.5],
    ["青 stoneblue / bg", t["--stoneblue"], bg, 4.5],
    ["UI 边框 line-strong / bg", `rgb(${over(t["--line-strong"], bg).join(",")})`, bg, 3],
    ["UI 边框 line-strong / 面板", `rgb(${over(t["--line-strong"], panel).join(",")})`, panel, 3],
    ["装饰线 line / bg（无标准）", `rgb(${over(t["--line"], bg).join(",")})`, bg, 1],
    ["输入框边框 line / 面板（≥3 才够）", `rgb(${over(t["--line"], panel).join(",")})`, panel, 3],
  ];

  console.log(`\n════ ${name} ════  bg=${bg}  panel=${panel}`);
  for (const [label, fg, bgc, need] of rows) {
    const rr = ratio(hex2rgb(fg), hex2rgb(bgc));
    console.log(`  ${r2(rr).toFixed(2).padStart(6)}:1  需 ${String(need).padEnd(3)} ${mark(rr, need)}${label}`);
  }
}
