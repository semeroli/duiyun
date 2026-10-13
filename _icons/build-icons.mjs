// 把方案渲染成完整的图标资产
//   node build-icons.mjs                  → 四套方案都渲染到 _icons/out/<方案>/
//   node build-icons.mjs --install A      → 把 A 装进 duiyun/public/（并写好 webmanifest）

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { svgFor, CONCEPTS } from "./icons.mjs";

const reqSharp = createRequire("D:/WorkBuddykongjian2026/duiyun/package.json");
const sharp = reqSharp("sharp");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "out");
const PUBLIC = path.resolve(HERE, "..", "public");

/** 多尺寸 ICO 容器（每帧直接放 PNG，Windows Vista+ / 所有现代浏览器都认） */
function buildIco(entries) {
  const n = entries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(n, 4);
  const dir = Buffer.alloc(16 * n);
  let offset = 6 + 16 * n;
  const blobs = [];
  entries.forEach((e, i) => {
    const o = i * 16;
    const dim = e.size >= 256 ? 0 : e.size;
    dir.writeUInt8(dim, o);
    dir.writeUInt8(dim, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(e.png.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += e.png.length;
    blobs.push(e.png);
  });
  return Buffer.concat([header, dir, ...blobs]);
}

async function png(id, mode, size) {
  return await sharp(Buffer.from(svgFor(id, mode, size))).png({ compressionLevel: 9 }).toBuffer();
}

const FILE_PLAN = [
  ["favicon-16x16.png", "compact", 16],
  ["favicon-32x32.png", "compact", 32],
  ["favicon-48x48.png", "compact", 48],
  ["apple-touch-icon.png", "detail", 180],
  ["icon-192.png", "detail", 192],
  ["icon-512.png", "detail", 512],
  ["icon-maskable-512.png", "maskable", 512],
  ["preview-256.png", "detail", 256],
];

async function renderConcept(id) {
  const dir = path.join(OUT, id);
  fs.mkdirSync(dir, { recursive: true });
  const buffers = {};
  for (const [name, mode, size] of FILE_PLAN) {
    const b = await png(id, mode, size);
    fs.writeFileSync(path.join(dir, name), b);
    buffers[name] = b;
  }
  // favicon.svg：用精简版（浏览器多半按 16/32 渲染它）
  fs.writeFileSync(path.join(dir, "favicon.svg"), svgFor(id, "compact", 32), "utf8");
  // favicon.ico：16 / 32 / 48 三帧
  const ico = buildIco([
    { size: 16, png: buffers["favicon-16x16.png"] },
    { size: 32, png: buffers["favicon-32x32.png"] },
    { size: 48, png: buffers["favicon-48x48.png"] },
  ]);
  fs.writeFileSync(path.join(dir, "favicon.ico"), ico);
  return { dir, icoSize: ico.length };
}

function manifestFor(id) {
  const c = CONCEPTS[id];
  return JSON.stringify(
    {
      name: "对韵 · 智能对联生成器",
      short_name: "对韵",
      description:
        "面向学习与创作的中文对联辅助工具：输入上联，AI 对出下联，并从平仄、词性、意境、典故四个维度逐层解析。",
      start_url: "/",
      display: "standalone",
      background_color: "#FAF7F2",
      theme_color: c.p.bgBot,
      icons: [
        { src: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        { src: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { src: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
        { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
      ],
    },
    null,
    2
  );
}

async function install(id) {
  if (!CONCEPTS[id]) throw new Error("未知方案: " + id);
  const src = path.join(OUT, id);
  if (!fs.existsSync(src)) await renderConcept(id);
  const names = [
    "favicon.svg",
    "favicon.ico",
    "favicon-16x16.png",
    "favicon-32x32.png",
    "favicon-48x48.png",
    "apple-touch-icon.png",
    "icon-192.png",
    "icon-512.png",
    "icon-maskable-512.png",
  ];
  fs.mkdirSync(PUBLIC, { recursive: true });
  for (const n of names) fs.copyFileSync(path.join(src, n), path.join(PUBLIC, n));
  fs.writeFileSync(path.join(PUBLIC, "site.webmanifest"), manifestFor(id), "utf8");
  console.log(`已把方案 ${id}（${CONCEPTS[id].name}）安装到 ${PUBLIC}`);
  console.log("  " + names.join("\n  ") + "\n  site.webmanifest");
}

const args = process.argv.slice(2);
const installIdx = args.indexOf("--install");

(async () => {
  if (installIdx >= 0) {
    await install(args[installIdx + 1]);
    return;
  }
  fs.mkdirSync(OUT, { recursive: true });
  for (const id of Object.keys(CONCEPTS)) {
    const { dir, icoSize } = await renderConcept(id);
    console.log(`${id} ${CONCEPTS[id].name.padEnd(10)} → ${dir}  (favicon.ico ${icoSize} 字节)`);
  }
})();
