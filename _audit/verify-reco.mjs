// 把「建议色板」整批跑一遍，确认每个推荐值真的达标（推荐前必须做的一步）
// 跑法：node _audit/verify-reco.mjs
function hex2rgb(h) {
  h = h.trim();
  if (h.startsWith("rgb")) { const p = h.match(/([\d.]+)/g).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
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

const T = {
  silk: { bg: "#faf7f2", panel: "#fffdf9", soft: "rgba(196,61,61,0.09)",
    inkFaint: "#7f6f5a", goldInk: "#8c6d31", cinnabarInk: "#bc3b3b", lineInput: "rgba(44,36,22,0.5)", okInk: "#047857", warnInk: "#b45309" },
  spring: { bg: "#fff6ea", panel: "#fffbf5", soft: "rgba(192,39,31,0.1)",
    inkFaint: "#926853", goldInk: "#96691c", cinnabarInk: "#c0271f", lineInput: "rgba(150,45,30,0.6)", okInk: "#047857", warnInk: "#b45309" },
  night: { bg: "#171310", panel: "#241d17", soft: "rgba(210,105,74,0.14)",
    inkFaint: "#9c8763", goldInk: "#d9b96a", cinnabarInk: "#d77a5e", lineInput: "rgba(237,223,192,0.4)", okInk: "#5aa87f", warnInk: "#c99a4a" },
};

let fail = 0;
for (const [name, t] of Object.entries(T)) {
  const softOnBg = toHex(over(t.soft, t.bg));
  const softOnPanel = toHex(over(t.soft, t.panel));
  const liOnPanel = toHex(over(t.lineInput, t.panel));
  const liOnBg = toHex(over(t.lineInput, t.bg));
  const rows = [
    ["ink-faint / bg", R(t.inkFaint, t.bg), 4.5],
    ["ink-faint / 面板", R(t.inkFaint, t.panel), 4.5],
    ["gold-ink / bg", R(t.goldInk, t.bg), 4.5],
    ["gold-ink / 面板", R(t.goldInk, t.panel), 4.5],
    ["cinnabar-ink / 浅红底", R(t.cinnabarInk, softOnBg), 4.5],
    ["cinnabar-ink / 浅红底(面板)", R(t.cinnabarInk, softOnPanel), 4.5],
    ["line-input / 面板", R(liOnPanel, t.panel), 3],
    ["line-input / bg", R(liOnBg, t.bg), 3],
    ["ok-ink / 面板", R(t.okInk, t.panel), 4.5],
    ["warn-ink / 面板", R(t.warnInk, t.panel), 4.5],
  ];
  console.log(`\n════ ${name} ════`);
  for (const [label, r, need] of rows) {
    const ok = r >= need;
    if (!ok) fail++;
    console.log(`  ${r.toFixed(2).padStart(6)}:1  需 ${String(need).padEnd(3)}  ${ok ? "✅" : "❌"}  ${label}`);
  }
}
console.log(`\n${fail === 0 ? "✅ 建议色板全部达标，可以交付" : `❌ 有 ${fail} 项不达标，不能交付`}`);
