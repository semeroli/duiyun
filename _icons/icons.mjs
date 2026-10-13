// 对韵 · 图标方案定义 + SVG 生成
// ---------------------------------------------------------------
// 原则：
//  1. 汉字用**真实字体轮廓转成的路径**，图标不依赖任何系统字体
//     （参考代码里用 <text> + font-family 回退，服务器/导航站抓取时字会变形甚至不显示）
//  2. 同一套几何，分「精简版」（16–48px，粗笔画）与「精致版」（≥180px，加印边）
//  3. 另出「maskable」版（满 bleed + 内容内缩 78%），供安卓/PWA 裁圆角用

import { createRequire } from "node:module";

// 以「托管工作区」为基准解析依赖（opentype.js 装在那里）
const reqSelf = createRequire("C:/Users/Administrator/.workbuddy/binaries/node/workspace/index.js");
const opentype = reqSelf("opentype.js");

export const S = 512; // 主画布

const SERIF = opentype.loadSync("C:/Windows/Fonts/STZHONGS.TTF"); // 华文中宋

/** 取某个汉字的轮廓，缩放居中到指定高度 */
function glyphPath(ch, targetH, cx, cy, strokeW, color) {
  const p = SERIF.getPath(ch, 0, 0, 1000);
  const b = p.getBoundingBox();
  const k = targetH / (b.y2 - b.y1);
  const tx = cx - ((b.x1 + b.x2) / 2) * k;
  const ty = cy - ((b.y1 + b.y2) / 2) * k;
  const sw = (strokeW / k).toFixed(2); // 描边要和整体一起缩放，先换算回去
  return (
    `<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${k.toFixed(5)})">` +
    `<path d="${p.toPathData(1)}" fill="${color}" stroke="${color}" ` +
    `stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/></g>`
  );
}

export const CONCEPTS = {
  A: {
    name: "朱印 · 对",
    tag: "最醒目",
    desc: "朱砂方印 + 米白「对」字 + 一圈淡金印边。红底在标签页、导航站列表里最抢眼，国风一眼认得出。",
    kind: "seal",
    char: "对",
    p: { bgTop: "#C63C2C", bgBot: "#8B1912", frame: "#F7E3BE", frameOp: 0.42, ink: "#FDF3E0" },
  },
  B: {
    name: "墨印 · 对",
    tag: "最贴合站点",
    desc: "墨底 + 朱红内框 + 米白「对」字，碑拓/印泥的质感，和站点「宣纸米白 / 墨黑」的素雅文人风最搭。",
    kind: "seal",
    char: "对",
    p: { bgTop: "#2C2219", bgBot: "#0C0906", frame: "#C0402F", frameOp: 0.85, ink: "#F5EAD4" },
  },
  C: {
    name: "门联 · 对韵",
    tag: "小尺寸最锐利",
    desc: "纯几何：上方一条横批、左右两联，正是春联贴门上的形制。不做汉字，16px 也方正清晰。",
    kind: "gate",
    p: { bgTop: "#C63C2C", bgBot: "#8B1912", ink: "#FDF3E0" },
  },
  D: {
    name: "朱印 · 韵",
    tag: "字义最贴产品名",
    desc: "把「韵」字入印。笔画比「对」密，小尺寸略吃力，但大图标（手机桌面、启动图）最雅致。",
    kind: "seal",
    char: "韵",
    p: { bgTop: "#C63C2C", bgBot: "#8B1912", frame: "#F7E3BE", frameOp: 0.42, ink: "#FDF3E0" },
  },
};

/**
 * 生成 SVG
 * @param {string} id      方案 A/B/C/D
 * @param {"compact"|"detail"|"maskable"} mode
 * @param {number} size    渲染边长（写进 width/height）
 */
export function svgFor(id, mode, size) {
  const c = CONCEPTS[id];
  if (!c) throw new Error("未知方案: " + id);
  const uid = "g" + id + mode;

  // maskable：满幅方底，内容缩到 78% 保证安全区
  const rx = mode === "maskable" ? 0 : 112;
  const inner = mode === "maskable" ? 0.78 : 1;

  const parts = [];
  parts.push(
    `<defs><linearGradient id="${uid}" x1="0" y1="0" x2="0.35" y2="1">` +
      `<stop offset="0" stop-color="${c.p.bgTop}"/><stop offset="1" stop-color="${c.p.bgBot}"/>` +
      `</linearGradient></defs>`
  );
  parts.push(`<rect width="${S}" height="${S}" rx="${rx}" fill="url(#${uid})"/>`);

  const body = [];

  if (c.kind === "seal") {
    // 精致版才画印边；精简版（16–48px）不画，避免糊成一团
    if (mode === "detail" || mode === "maskable") {
      body.push(
        `<rect x="36" y="36" width="440" height="440" rx="88" fill="none" ` +
          `stroke="${c.p.frame}" stroke-width="9" opacity="${c.p.frameOp}"/>`
      );
    }
    const dense = c.char === "韵";
    // 精简版把字放大到接近满幅 —— 16px 下才认得出
    const h = mode === "compact" ? (dense ? 360 : 386) : dense ? 296 : 312;
    const sw = mode === "compact" ? 15 : 6.5;
    body.push(glyphPath(c.char, h, S / 2, S / 2 + (mode === "compact" ? 8 : 4), sw, c.p.ink));
  } else {
    // 门联形制：横批在门楣上（两端与左右联齐平），两联下垂
    const ink = c.p.ink;
    body.push(`<rect x="104" y="88" width="304" height="58" rx="16" fill="${ink}"/>`);
    body.push(`<rect x="104" y="186" width="58" height="240" rx="16" fill="${ink}"/>`);
    body.push(`<rect x="350" y="186" width="58" height="240" rx="16" fill="${ink}"/>`);
  }

  if (inner !== 1) {
    // 以画布中心为锚点整体缩小
    parts.push(
      `<g transform="translate(${S / 2} ${S / 2}) scale(${inner}) translate(${-S / 2} ${-S / 2})">` +
        body.join("") +
        `</g>`
    );
  } else {
    parts.push(body.join(""));
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="0 0 ${S} ${S}" role="img" aria-label="对韵">${parts.join("")}</svg>`
  );
}
