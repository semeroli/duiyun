// 源码类名普查：拿数字，不拿印象
// 跑法：node _audit/census.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["app", "components", "lib"];
const files = [];
function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(e)) files.push(p.replace(/\\/g, "/"));
  }
}
ROOTS.forEach(walk);

let all = "";
const perFile = new Map();
for (const f of files) {
  const c = readFileSync(f, "utf8");
  all += "\n" + c;
  perFile.set(f, c);
}
console.log(`扫描 ${files.length} 个源文件\n`);

function tally(re, label, top = 40) {
  const m = new Map();
  for (const x of all.matchAll(re)) {
    const k = x[0];
    m.set(k, (m.get(k) || 0) + 1);
  }
  const arr = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, top);
  console.log(`── ${label}（共 ${[...m.values()].reduce((a, b) => a + b, 0)} 处，${m.size} 种）`);
  console.log("   " + arr.map(([k, v]) => `${k}×${v}`).join("  "));
  console.log();
  return m;
}

// 1) 任意值（偏离刻度的地方）
const arb = tally(/\[[^\]\n]{1,30}\]/g, "任意值 className（偏离刻度）", 45);

// 2) 字号
const sizes = [...all.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)].map((m) => parseFloat(m[1]));
const sizeMap = new Map();
for (const s of sizes) sizeMap.set(s, (sizeMap.get(s) || 0) + 1);
console.log("── 显式 px 字号分布（字号刻度实况）");
console.log("   " + [...sizeMap.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}px×${v}`).join("  "));
const tiny = sizes.filter((s) => s < 12).length;
const small = sizes.filter((s) => s >= 12 && s <= 13).length;
console.log(`   <12px: ${tiny} 处   12~13px: ${small} 处   ≥14px: ${sizes.length - tiny - small} 处`);
console.log();

// 3) 颜色族
tally(/(?:bg|text|border|from|to|via|ring|fill|stroke|shadow)-[a-z]+(?:-\d{2,3})?(?:\/\d+)?/g, "颜色类名", 60);

// 4) 圆角 / 阴影
tally(/(?:rounded|shadow)-[a-z0-9]+/g, "圆角与阴影档位", 25);

// 5) 交互态与无障碍
console.log("── 交互态 / 无障碍 关键词计数");
const keys = [
  "hover:",
  "focus:",
  "focus-visible:",
  "active:",
  "disabled:",
  "aria-",
  "role=",
  "prefers-reduced-motion",
  "outline-none",
  "sm:",
  "md:",
  "lg:",
  "xl:",
  "whitespace-nowrap",
  "overflow-x-auto",
  "min-h-",
  "h-[",
];
for (const k of keys) {
  const n = all.split(k).length - 1;
  console.log(`   ${k.padEnd(24)} ${n}`);
}
console.log();

// 6) label / htmlFor
const labels = all.match(/<label/g)?.length || 0;
const htmlFor = all.match(/htmlFor=/g)?.length || 0;
console.log(`── <label> ${labels} 个   htmlFor= ${htmlFor} 个`);
const buttons = all.match(/<button/g)?.length || 0;
const ariaLabel = all.match(/aria-label=/g)?.length || 0;
const titleAttr = all.match(/title=/g)?.length || 0;
console.log(`── <button> ${buttons} 个   aria-label= ${ariaLabel} 个   title= ${titleAttr} 个`);

// 7) 中性色混用检查（Tailwind 原生色）
const natives = ["slate", "gray", "zinc", "neutral", "stone"];
console.log("\n── Tailwind 原生中性色使用情况（应为 0）");
for (const n of natives) {
  const re = new RegExp(`(?:bg|text|border|ring|from|to|via)-${n}-\\d{2,3}`, "g");
  const c = all.match(re)?.length || 0;
  if (c) console.log(`   🔴 ${n}: ${c} 处`);
}
const defaults = ["emerald", "amber", "blue", "red", "green", "indigo", "violet", "pink", "teal", "sky", "orange", "yellow", "purple", "rose", "cyan", "fuchsia", "lime"];
console.log("\n── Tailwind 默认语义色使用情况（与自建 token 并存 = 换肤会脱节）");
for (const n of defaults) {
  const re = new RegExp(`(?:bg|text|border|ring|from|to|via)-${n}-\\d{2,3}(?:\\/\\d+)?`, "g");
  const hits = [...all.matchAll(re)].map((m) => m[0]);
  if (hits.length) {
    const where = [];
    for (const [f, c] of perFile) for (const h of hits) if (c.includes(h)) where.push(`${f}:${h}`);
    console.log(`   ⚠️  ${n}: ${hits.length} 处  → ${[...new Set(where)].slice(0, 6).join(", ")}`);
  }
}
