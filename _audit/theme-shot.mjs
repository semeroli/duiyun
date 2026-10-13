// 强制切主题后截图（用来核对暗色主题下的可读性）
// 跑法：node _audit/theme-shot.mjs <url> <theme> <out.png> [width] [height]
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const [URL_, THEME, OUT] = process.argv.slice(2);
const W = Number(process.argv[5] || 390);
const H = Number(process.argv[6] || 2400);
const PORT = 9381;

const child = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=D:/WorkBuddykongjian2026/duiyun/_audit/_profile4`,
  "--window-size=1200,900", "about:blank",
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
const evalJs = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true })).result.value;

await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: W < 768 });
await send("Page.navigate", { url: URL_ }); await sleep(5000);
// 🔴 直接 setAttribute 会被 studio/page.tsx 的 effect 改回去（它按 localStorage 里的设置落地主题），
//    所以必须先写 localStorage 再 reload —— 这也说明主题真正的事实来源是本地存储。
if (THEME && THEME !== "-") {
  await evalJs(`localStorage.setItem('duiyun:settings:v1', JSON.stringify({theme:'${THEME}', sound:false, learning:false})); 'ok'`);
  await send("Page.reload", { ignoreCache: false });
  await sleep(6000);
}
const applied = await evalJs("document.documentElement.getAttribute('data-theme')");
console.log("页面实际生效主题 =", applied);
const h = await evalJs("Math.min(document.documentElement.scrollHeight, 6000)");
await send("Emulation.setDeviceMetricsOverride", { width: W, height: Math.min(H, h), deviceScaleFactor: 1, mobile: W < 768 });
await sleep(800);
const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
writeFileSync(OUT, Buffer.from(shot.data, "base64"));
console.log("已写入", OUT, "主题=", THEME, "高度=", Math.min(H, h));
ws.close(); child.kill(); process.exit(0);
