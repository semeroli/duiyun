// 真机探针：焦点可见性 + 渲染字号实况
// 跑法：node _audit/probe.mjs <url> [width] [height]
import { spawn } from "node:child_process";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL_ = process.argv[2] || "https://lwdy.de5.net/studio";
const W = Number(process.argv[3] || 390);
const H = Number(process.argv[4] || 844);
const PORT = 9377;

const child = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=D:/WorkBuddykongjian2026/duiyun/_audit/_profile`,
  `--window-size=${W},${H}`,
  "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function target() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = list.find((t) => t.type === "page");
      if (p) return p.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error("连不上 Chrome（必须取 type==='page' 的 target）");
}

let id = 0;
const ws = new WebSocket(await target());
const pending = new Map();
await new Promise((r) => (ws.onopen = r));
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
function send(method, params = {}) {
  const i = ++id;
  return new Promise((res, rej) => {
    pending.set(i, (m) => (m.error ? rej(new Error(method + ": " + m.error.message)) : res(m.result)));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
}

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });
await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: W < 768 });
await send("Page.navigate", { url: URL_ });
await sleep(6000);

async function evalJs(expr) {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result.value;
}

const out = await evalJs(`(() => {
  const res = { url: location.href, size: [], focus: [], small: [], fonts: {}, aria: {} };

  // 1) 渲染字号实况（只看实际有文字的元素）
  const counts = {};
  const small = [];
  for (const el of document.querySelectorAll('*')) {
    const direct = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!direct) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const fs = Math.round(parseFloat(cs.fontSize) * 10) / 10;
    counts[fs] = (counts[fs] || 0) + 1;
    if (fs < 12) small.push({ fs, t: el.textContent.trim().slice(0, 16), tag: el.tagName.toLowerCase(), ff: cs.fontFamily.split(',')[0] });
  }
  res.size = Object.entries(counts).map(([k,v]) => [Number(k), v]).sort((a,b)=>a[0]-b[0]);
  res.small = small.slice(0, 25);

  // 2) 焦点可见性：逐个个真实聚焦，比对 outline 是否真的可见
  const focusables = [...document.querySelectorAll('a[href],button,input,textarea,select,[tabindex]:not([tabindex="-1"])')]
    .filter(el => el.offsetParent !== null || el.tagName === 'A');
  for (const el of focusables.slice(0, 30)) {
    el.focus();
    const cs = getComputedStyle(el);
    const ow = parseFloat(cs.outlineWidth) || 0;
    const oc = cs.outlineColor;
    const os = cs.outlineStyle;
    // transparent 的 outline 等于没有
    const transparent = /rgba?\\(0,\\s*0,\\s*0,\\s*0\\)|transparent/.test(oc);
    const visible = os !== 'none' && ow > 0 && !transparent;
    res.focus.push({
      tag: el.tagName.toLowerCase(),
      txt: (el.textContent || el.placeholder || el.getAttribute('aria-label') || '').trim().slice(0, 14),
      outline: os + ' ' + ow + 'px ' + oc,
      visible,
      cls: (el.className || '').toString().slice(0, 60),
    });
  }

  // 3) 无障碍名
  const btns = [...document.querySelectorAll('button')];
  res.aria.iconNoName = btns.filter(b => !b.textContent.trim() && !b.getAttribute('aria-label') && !b.title).length;
  res.aria.buttons = btns.length;
  res.aria.ariaLabels = document.querySelectorAll('[aria-label]').length;
  res.aria.inputsNoLabel = [...document.querySelectorAll('input,textarea,select')].filter(el => {
    if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return false;
    if (el.closest('label')) return false;
    if (el.id && document.querySelector('label[for="' + el.id + '"]')) return false;
    return true;
  }).length;

  // 4) 用到的字体栈
  for (const el of document.querySelectorAll('h1,h2,p,button,textarea,input')) {
    const f = getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g,'');
    res.fonts[f] = (res.fonts[f] || 0) + 1;
  }
  return res;
})()`);

console.log("URL:", out.url);
console.log("\n【渲染字号实况】(字号px: 元素数)");
console.log("  " + out.size.map(([s, n]) => `${s}:${n}`).join("  "));
const under12 = out.size.filter(([s]) => s < 12).reduce((a, [, n]) => a + n, 0);
console.log(`  <12px 共 ${under12} 个文字元素  |  12~13px 共 ${out.size.filter(([s]) => s >= 12 && s <= 13).reduce((a, [, n]) => a + n, 0)} 个`);

console.log("\n【<12px 的最小的那些】");
for (const s of out.small) console.log(`  ${String(s.fs).padStart(5)}px  <${s.tag}>  「${s.t}」  ${s.ff}`);

console.log("\n【焦点可见性】");
const bad = out.focus.filter((f) => !f.visible);
console.log(`  可聚焦 ${out.focus.length} 个，其中 ${bad.length} 个聚焦后看不到任何指示`);
for (const f of bad) console.log(`   ✗ <${f.tag}>「${f.txt}」  outline=${f.outline}\n       .${f.cls}`);

console.log("\n【无障碍名】");
console.log("  " + JSON.stringify(out.aria));
console.log("\n【字体栈使用】");
console.log("  " + JSON.stringify(out.fonts));

ws.close();
child.kill();
process.exit(0);
