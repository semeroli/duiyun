// 验证图标是否真的接线成功（对着本地服务检查）
import http from "node:http";

const BASE = "http://localhost:4311";

function get(path) {
  return new Promise((resolve) => {
    const r = http.request(BASE + path, { method: "GET", timeout: 20000 }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, type: res.headers["content-type"], buf: Buffer.concat(chunks) }));
    });
    r.on("error", (e) => resolve({ err: e.message }));
    r.on("timeout", () => {
      r.destroy();
      resolve({ err: "timeout" });
    });
    r.end();
  });
}

function parseIco(buf) {
  if (buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) return null;
  const n = buf.readUInt16LE(4);
  const frames = [];
  for (let i = 0; i < n; i++) {
    const o = 6 + i * 16;
    const w = buf.readUInt8(o) || 256;
    const h = buf.readUInt8(o + 1) || 256;
    const bytes = buf.readUInt32LE(o + 8);
    const off = buf.readUInt32LE(o + 12);
    const isPng = buf.slice(off, off + 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    frames.push(`${w}×${h} ${bytes}B ${isPng ? "PNG" : "BMP"}`);
  }
  return frames;
}

const ICONS = [
  "/favicon.svg",
  "/favicon.ico",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/favicon-48x48.png",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/site.webmanifest",
];

(async () => {
  console.log("=== 首页 <head> 里的图标接线 ===");
  const home = await get("/");
  if (home.err) return console.log("首页拉取失败：", home.err);
  const head = home.buf.toString("utf8").slice(0, home.buf.toString("utf8").indexOf("</head>"));
  const links = head.match(/<link[^>]*(icon|manifest)[^>]*>/gi) || [];
  if (!links.length) console.log("  ✗ 一条 icon/manifest 的 <link> 都没有");
  links.forEach((l) => console.log("  " + l.replace(/\s+/g, " ")));
  const og = head.match(/<meta[^>]*og:image[^>]*>/gi) || [];
  og.forEach((l) => console.log("  " + l.replace(/\s+/g, " ")));

  console.log("\n=== 逐个文件能不能拿到 ===");
  for (const p of ICONS) {
    const r = await get(p);
    if (r.err) {
      console.log(`  ✗ ${p.padEnd(26)} ${r.err}`);
      continue;
    }
    const ok = r.status === 200;
    console.log(`  ${ok ? "✓" : "✗"} ${p.padEnd(26)} HTTP ${r.status}  ${r.type}  ${r.buf.length} 字节`);
    if (p === "/favicon.ico" && ok) {
      const f = parseIco(r.buf);
      console.log(`      ICO 内含 ${f ? f.length : "?"} 帧：` + (f ? f.join(" | ") : "头部解析失败"));
    }
    if (p === "/site.webmanifest" && ok) {
      try {
        const j = JSON.parse(r.buf.toString("utf8"));
        console.log(`      name=${j.name} / short_name=${j.short_name} / theme=${j.theme_color} / 图标 ${j.icons.length} 条`);
      } catch (e) {
        console.log("      ✗ manifest 不是合法 JSON：" + e.message);
      }
    }
    if (p === "/favicon.svg" && ok) {
      const s = r.buf.toString("utf8");
      console.log(`      含 <text> 标签？${/<text/i.test(s) ? "是（有字体风险）" : "否（纯路径，安全）"}；路径数 ${(s.match(/<path/g) || []).length}`);
    }
  }
})();
