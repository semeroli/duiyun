// 字形提取自检：确认这几个字能在华文中宋 / 黑体 / 楷体里正确取到轮廓
import { createRequire } from "node:module";
const require = createRequire("C:/Users/Administrator/.workbuddy/binaries/node/workspace/index.js");
const opentype = require("opentype.js");

const FONTS = {
  华文中宋: "C:/Windows/Fonts/STZHONGS.TTF",
  黑体: "C:/Windows/Fonts/simhei.ttf",
  楷体: "C:/Windows/Fonts/simkai.ttf",
  微软雅黑粗: "C:/Windows/Fonts/msyhbd.ttc",
  等线粗: "C:/Windows/Fonts/Dengb.ttf",
};

const CHARS = ["对", "韵", "联", "对韵"];

for (const [name, file] of Object.entries(FONTS)) {
  let font;
  try {
    font = opentype.loadSync(file);
  } catch (e) {
    console.log(`\n### ${name}  ✗ 读取失败: ${e.message}`);
    continue;
  }
  console.log(`\n### ${name}  (upm=${font.unitsPerEm})`);
  for (const ch of CHARS) {
    const path = font.getPath(ch, 0, 0, 1000);
    const bb = path.getBoundingBox();
    const d = path.toPathData(2);
    console.log(
      `  「${ch}」  bbox=[${bb.x1.toFixed(0)},${bb.y1.toFixed(0)} → ${bb.x2.toFixed(0)},${bb.y2.toFixed(0)}]` +
        `  宽高=${(bb.x2 - bb.x1).toFixed(0)}×${(bb.y2 - bb.y1).toFixed(0)}  路径 ${d.length} 字符`
    );
  }
}
