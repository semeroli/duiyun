// 移动端硬数据：顶部占屏、主输入位置、点按目标尺寸（WCAG 2.5.8 要求 ≥24×24）
// 跑法：node _audit/measure.mjs <url> [width] [height]
import { spawn } from "node:child_process";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL_ = process.argv[2] || "https://lwdy.de5.net/studio";
const W = Number(process.argv[3] || 390);
const H = Number(process.argv[4] || 844);
const PORT = 9379;

const child = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=D:/WorkBuddykongjian2026/duiyun/_audit/_profile3`,
  `--window-size=${W},${H}`, "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function target() {
  for (let i = 0; i < 40; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = l.find((t) => t.type === "page");
      if (p) return p.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error("连不上");
}
let id = 0;
const ws = new WebSocket(await target());
const pending = new Map();
await new Promise((r) => (ws.onopen = r));
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => { const i = ++id; return new Promise((res, rej) => { pending.set(i, (m) => m.error ? rej(new Error(m.error.message)) : res(m.result)); ws.send(JSON.stringify({ id: i, method, params })); }); };
const evalJs = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result.value;

await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: W < 768 });
await send("Page.navigate", { url: URL_ }); await sleep(6000);

const r = await evalJs(`(() => {
  const out = { vh: innerHeight, headers: [], main: null, tap: [], sticky: [] };
  // ① 先收集候选
  const cands = [];
  for (const el of document.querySelectorAll('header, [class*="sticky"], nav')) {
    const b = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (b.height > 8 && b.top < 300) cands.push({ el, b, cs });
  }
  // ② 只在"没有别的候选包含它自己"时才计入 ——
  //    否则 header 和它内部的 nav（类型切换条）会被重复相加，得出偏大的占屏比例。
  for (const c of cands) {
    const nested = cands.some((o) => o !== c && o.el.contains(c.el));
    if (nested) out.sticky.push({ tag: c.el.tagName.toLowerCase(), h: Math.round(c.b.height), cls: (c.el.className||'').toString().slice(0,55) });
    else out.headers.push({ tag: c.el.tagName.toLowerCase(), h: Math.round(c.b.height), top: Math.round(c.b.top), sticky: c.cs.position, cls: (c.el.className||'').toString().slice(0,55) });
  }
  const main = document.querySelector('main');
  if (main) { const b = main.getBoundingClientRect(); out.main = { top: Math.round(b.top), h: Math.round(b.height) }; }

  // 第一个主要输入控件（上联框或 email）
  const inp = document.querySelector('textarea, input[type="email"], input[type="text"]');
  if (inp) { const b = inp.getBoundingClientRect(); out.firstInput = { top: Math.round(b.top), h: Math.round(b.height), ph: inp.placeholder }; }

  // 点按目标
  for (const el of document.querySelectorAll('a[href],button,input:not([type=hidden]),textarea,[role="button"]')) {
    const b = el.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) continue;
    out.tap.push({
      tag: el.tagName.toLowerCase(),
      w: Math.round(b.width), h: Math.round(b.height),
      txt: (el.textContent || el.placeholder || el.getAttribute('title') || '').trim().slice(0, 12),
    });
  }
  return out;
})()`);

console.log(`URL: ${URL_}  视口 ${W}×${H}\n`);
console.log("【顶部固定/粘性条】（已排除嵌在其中的子条，避免重复相加）");
let total = 0;
for (const h of r.headers) { total += h.h; console.log(`   ${h.tag} 高 ${h.h}px   top=${h.top}  position=${h.sticky}\n      .${h.cls}`); }
if (r.sticky && r.sticky.length) {
  console.log(`   — 以下 ${r.sticky.length} 个嵌在上述条内部，不计入合计（算了会重复）：`);
  for (const s of r.sticky) console.log(`      ${s.tag} 高 ${s.h}px   .${s.cls}`);
}
console.log(`   ⇒ 合计 ${total}px，占屏高 ${(total / r.vh * 100).toFixed(0)}%\n`);
if (r.main) console.log(`【main 起点】top=${r.main.top}px（${(r.main.top / r.vh * 100).toFixed(0)}% 屏高）`);
if (r.firstInput) console.log(`【首个输入框】top=${r.firstInput.top}px  高 ${r.firstInput.h}px  「${r.firstInput.ph}」\n`);

const tooSmall = r.tap.filter((t) => t.w < 24 || t.h < 24);
const advisory = r.tap.filter((t) => (t.w < 44 || t.h < 44) && !(t.w < 24 || t.h < 24));
console.log(`【点按目标】共 ${r.tap.length} 个`);
console.log(`   ✗ 小于 24×24（WCAG 2.2 AA 硬线）：${tooSmall.length} 个`);
for (const t of tooSmall.slice(0, 12)) console.log(`      <${t.tag}> ${t.w}×${t.h}「${t.txt}」`);
console.log(`   ! 小于 44×44（建议值）：${advisory.length} 个`);
for (const t of advisory.slice(0, 12)) console.log(`      <${t.tag}> ${t.w}×${t.h}「${t.txt}」`);

ws.close(); child.kill(); process.exit(0);
