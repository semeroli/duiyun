// 生成两张自检图：① 四套方案大图对比  ② 小尺寸（16/32/48）放大检查
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const reqSharp = createRequire("D:/WorkBuddykongjian2026/duiyun/package.json");
const sharp = reqSharp("sharp");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "out");
const IDS = ["A", "B", "C", "D"];
const GAP = 28;
const PAD = 28;

async function design() {
  const cell = 256;
  const total = PAD * 2 + cell * 2 + GAP;
  const comps = [];
  for (let i = 0; i < IDS.length; i++) {
    const img = await sharp(path.join(OUT, IDS[i], "preview-256.png")).ensureAlpha().toBuffer();
    comps.push({
      input: img,
      left: PAD + (i % 2) * (cell + GAP),
      top: PAD + Math.floor(i / 2) * (cell + GAP),
    });
  }
  await sharp({
    create: { width: total, height: total, channels: 4, background: { r: 233, g: 228, b: 220, alpha: 1 } },
  })
    .composite(comps)
    .png()
    .toFile(path.join(HERE, "sheet-design.png"));
  console.log("sheet-design.png  → 排列顺序 A(左上) B(右上) C(左下) D(右下)");
}

/** 把 16/32/48 的真实像素放大（不插值），看小尺寸到底糊不糊 */
async function small(id) {
  const sizes = [16, 32, 48];
  const zooms = [6, 4, 3];
  const cells = [];
  for (let i = 0; i < sizes.length; i++) {
    const b = await sharp(path.join(OUT, id, `favicon-${sizes[i]}x${sizes[i]}.png`))
      .resize(sizes[i] * zooms[i], sizes[i] * zooms[i], { kernel: "nearest" })
      .toBuffer();
    cells.push({ buf: b, w: sizes[i] * zooms[i] });
  }
  const rowH = Math.max(...cells.map((c) => c.w)) + 56;
  const totalW = PAD * 2 + cells.reduce((a, c) => a + c.w, 0) + GAP * (cells.length - 1);
  const totalH = PAD * 2 + rowH * 2 + GAP;

  const light = { r: 250, g: 247, b: 242, alpha: 1 };
  const dark = { r: 23, g: 19, b: 16, alpha: 1 };

  const comps = [];
  let x = PAD;
  for (const c of cells) {
    comps.push({ input: c.buf, left: x, top: PAD + (rowH - 56) / 2 });
    x += c.w + GAP;
  }
  let x2 = PAD;
  for (const c of cells) {
    comps.push({ input: c.buf, left: x2, top: PAD + rowH + GAP + (rowH - 56) / 2 });
    x2 += c.w + GAP;
  }
  // 上半浅色底 下半深色底
  const top = await sharp({ create: { width: totalW, height: PAD + rowH, channels: 4, background: light } })
    .composite(comps.filter((c) => c.top < PAD + rowH))
    .png()
    .toBuffer();
  const bottom = await sharp({
    create: { width: totalW, height: PAD + rowH, channels: 4, background: dark },
  })
    .composite(comps.filter((c) => c.top >= PAD + rowH).map((c) => ({ ...c, top: c.top - (PAD + rowH + GAP) + PAD / 2 })))
    .png()
    .toBuffer();
  await sharp({ create: { width: totalW, height: totalH, channels: 4, background: { r: 128, g: 128, b: 128, alpha: 1 } } })
    .composite([
      { input: top, left: 0, top: 0 },
      { input: bottom, left: 0, top: PAD + rowH + GAP },
    ])
    .png()
    .toFile(path.join(HERE, `sheet-small-${id}.png`));
  console.log(`sheet-small-${id}.png  → 从左到右：16px(×6)、32px(×4)、48px(×3)；上=浅色底 下=深色底`);
}

await design();
for (const id of IDS) await small(id);
fs.writeFileSync(path.join(HERE, "_sheet_info.txt"), "A 朱印·对 / B 墨印·对 / C 门联 / D 朱印·韵\n");
