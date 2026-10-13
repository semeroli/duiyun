/**
 * 用本机 Chrome 的 CDP 给本地预览页截图（开发自检用，不参与构建）
 * ------------------------------------------------------------------
 * 为什么不装 agent-browser：它要拉一份 ~500MB 的独立 Chromium，
 * 而本机已经有 Chrome，CDP 本身就在，几十行就够。
 *
 * 用法：node _shots.mjs <基础地址> <输出目录> <路径1> [路径2 ...]
 *   node _shots.mjs http://127.0.0.1:8791 _shots_tmp / /studio /blog
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9333;

const [, , base = "http://127.0.0.1:8791", outDir = "_shots_tmp", ...routes] = process.argv;
const targets = routes.length ? routes : ["/"];

const userDataDir = path.join(os.tmpdir(), `duiyun-shots-${Date.now()}`);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) {
        const j = await res.json();
        if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
      }
    } catch {
      /* 还没起来 */
    }
    await sleep(250);
  }
  throw new Error("等不到 Chrome 的调试端口");
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.waiting = new Map();
    this.events = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.waiting.has(msg.id)) {
        const { resolve, reject } = this.waiting.get(msg.id);
        this.waiting.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        const list = this.events.get(msg.method) ?? [];
        list.forEach((fn) => fn(msg.params));
        this.events.set(msg.method, []);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.waiting.has(id)) {
          this.waiting.delete(id);
          reject(new Error(`${method} 超时`));
        }
      }, 30000);
    });
  }
  once(method) {
    return new Promise((resolve) => {
      const list = this.events.get(method) ?? [];
      list.push(resolve);
      this.events.set(method, list);
    });
  }
}

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "about:blank",
  ],
  { stdio: "ignore", detached: false }
);

let exitCode = 0;
try {
  const wsUrl = await getWsUrl();
  const listRes = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  const pages = await listRes.json();
  const page = pages.find((p) => p.type === "page");
  if (!page) throw new Error("没有可用的页面目标");

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res, { once: true });
    ws.addEventListener("error", rej, { once: true });
  });

  const cdp = new CDP(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  // 需要看「登录之后」的页面时，用 COOKIE="名=值" 带一枚会话 cookie 进去
  if (process.env.COOKIE) {
    await cdp.send("Network.enable");
    const i = process.env.COOKIE.indexOf("=");
    await cdp.send("Network.setCookie", {
      name: process.env.COOKIE.slice(0, i),
      value: process.env.COOKIE.slice(i + 1),
      url: base,
      httpOnly: true,
    });
  }
  // 默认无头窗口只有 764 宽（看着像平板），桌面版式要在 1440 下才看得出来
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  fs.mkdirSync(outDir, { recursive: true });

  for (const route of targets) {
    const url = base + route;
    const loaded = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url });
    await Promise.race([loaded, sleep(12000)]);
    // 字体（Noto Serif SC / 霞鹜文楷）是外链，等一会儿再截，免得拍到系统兜底字体
    await sleep(2600);

    // EVAL 用来在截图前点一下按钮之类的（例如进编辑器）
    if (process.env.EVAL) {
      await cdp.send("Runtime.evaluate", { expression: process.env.EVAL, awaitPromise: true });
      await sleep(2200);
    }

    // READ 用来把某段文字取回来打印 —— 隔着截图猜渲染结果容易看走眼
    if (process.env.READ) {
      const r = await cdp.send("Runtime.evaluate", {
        expression: process.env.READ,
        returnByValue: true,
      });
      console.log(`    ${route} READ → ${JSON.stringify(r.result.value)}`);
    }

    const name = route === "/" ? "home" : route.replace(/^\/+|\/+$/g, "").replace(/\//g, "-");
    const png = path.join(outDir, `${name}.png`);

    const full = await cdp.send("Runtime.evaluate", {
      expression: "JSON.stringify({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight})",
      returnByValue: true,
    });
    const { w, h } = JSON.parse(full.result.value);
    // 想看首屏细节时用 MAXH=900 只截一屏（大图会被查看器缩小，反而看不清字）
    const cap = Number(process.env.MAXH) || 4600;
    const shotH = Math.min(h, cap);

    const { data } = await cdp.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: w, height: shotH, scale: 1 },
    });
    fs.writeFileSync(png, Buffer.from(data, "base64"));
    console.log(`${route}  →  ${png}  (${w}×${h}, 截了 ${shotH}px)`);
  }

  ws.close();
} catch (e) {
  console.error("截图失败:", e instanceof Error ? e.message : e);
  exitCode = 1;
} finally {
  try {
    chrome.kill();
  } catch {
    /* 忽略 */
  }
  await sleep(600);
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch {
    /* 临时目录清不掉不影响结果 */
  }
}

process.exit(exitCode);
