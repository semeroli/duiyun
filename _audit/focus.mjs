// 严格版焦点可见性：用真实键盘 Tab 遍历（:focus-visible 只在键盘聚焦时命中）
// 跑法：node _audit/focus.mjs <url> [width] [height]
import { spawn } from "node:child_process";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL_ = process.argv[2] || "https://lwdy.de5.net/studio";
const W = Number(process.argv[3] || 390);
const H = Number(process.argv[4] || 844);
const PORT = 9378;

const child = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=D:/WorkBuddykongjian2026/duiyun/_audit/_profile2`,
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
  throw new Error("连不上 Chrome");
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
const evalJs = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result.value;
};

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: W < 768 });
await send("Page.navigate", { url: URL_ });
await sleep(6000);

console.log(`URL: ${await evalJs("location.href")}  视口 ${W}×${H}\n`);

async function tab() {
  for (const type of ["rawKeyDown", "char", "keyUp"]) {
    await send("Input.dispatchKeyEvent", {
      type, key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9,
      text: type === "char" ? "\t" : undefined,
    });
  }
  await sleep(140);
}

const seen = new Set();
const rows = [];
for (let i = 0; i < 40; i++) {
  await tab();
  const info = await evalJs(`(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const cs = getComputedStyle(el);
    const ow = parseFloat(cs.outlineWidth) || 0;
    const oc = cs.outlineColor || '';
    const os = cs.outlineStyle || 'none';
    const transparent = /rgba?\\(\\s*0,\\s*0,\\s*0,\\s*0\\s*\\)|transparent/.test(oc);
    const hasRing = (os !== 'none' && ow > 0 && !transparent) || (cs.boxShadow && cs.boxShadow !== 'none');
    const key = el.tagName + '|' + (el.className||'').toString().slice(0,50) + '|' + (el.textContent||el.placeholder||'').trim().slice(0,10);
    return {
      key,
      tag: el.tagName.toLowerCase(),
      txt: (el.textContent || el.placeholder || el.getAttribute('aria-label') || '').trim().slice(0, 16),
      outline: os + ' ' + ow + 'px ' + oc,
      shadow: (cs.boxShadow || 'none').slice(0, 60),
      hasRing,
      cls: (el.className || '').toString().slice(0, 70),
    };
  })()`);
  if (!info) { if (i > 0) break; else continue; }
  if (seen.has(info.key)) continue;
  seen.add(info.key);
  rows.push(info);
  if (rows.length >= 24) break;
}

const bad = rows.filter((r) => !r.hasRing);
console.log(`Tab 走过 ${rows.length} 个不同元素，其中 ${bad.length} 个「聚焦后屏幕上没有任何变化」\n`);
if (bad.length) {
  console.log("🔴 看不见焦点的元素：");
  for (const b of bad) console.log(`   <${b.tag}>「${b.txt}」\n       outline=${b.outline}  box-shadow=${b.shadow}\n       .${b.cls}`);
} else {
  console.log("✅ 全部有可见焦点指示");
}
console.log("\n（其余有焦点环的，抽样看几个）");
for (const r of rows.filter((r) => r.hasRing).slice(0, 4)) {
  console.log(`   ok <${r.tag}>「${r.txt}」 ${r.outline}`);
}

ws.close();
child.kill();
process.exit(0);
