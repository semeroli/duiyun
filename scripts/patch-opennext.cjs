// 对韵 · postinstall 补丁
// ---------------------------------------------------------------
// 背景：@opennextjs/aws 4.x 里加了一道「Next.js 主版本超过官方 2 年支持期就
// process.exit(1)」的硬校验（见 node_modules/@opennextjs/aws/dist/build/helper.js
// 的 checkNextVersionSupport）。Cloudflare 的构建命令是
// `npx @opennextjs/cloudflare build`，写死在控制台、改不了，也没法传
// --dangerouslyUseUnsupportedNextVersion 旗标，所以这里在 npm install 之后
// 把该函数里的判定改成「一律视为受支持」，让构建照常进行。
//
// ⚠️ 说明：
//   - 这只是绕过一道「EOL 提示」性质的硬退出，不改任何打包/运行时逻辑；
//   - Next.js 15.5.27 本身完全能构建（2026-10-13 已在本线上成功部署验证过）；
//   - 以后把 Next 升到受官方支持的版本后，删掉本脚本和 package.json 里的
//     postinstall 即可。
const fs = require("node:fs");
const path = require("node:path");

const target = path.join(
  process.cwd(),
  "node_modules",
  "@opennextjs",
  "aws",
  "dist",
  "build",
  "helper.js"
);

const NEEDLE = "const isSupported = isNextVersionSupported(nextVersion);";
const REPLACEMENT =
  "const isSupported = true; // patched by scripts/patch-opennext.cjs (bypass Next EOL date check)";

try {
  if (!fs.existsSync(target)) {
    console.log("[patch-opennext] 未找到 helper.js，跳过（依赖可能尚未安装）");
    process.exit(0);
  }
  const src = fs.readFileSync(target, "utf8");
  if (!src.includes(NEEDLE)) {
    console.log("[patch-opennext] 未找到目标语句，可能已打过补丁或版本已变化，跳过");
    process.exit(0);
  }
  fs.writeFileSync(target, src.replace(NEEDLE, REPLACEMENT), "utf8");
  console.log("[patch-opennext] 已绕过 Next.js EOL 日期校验");
} catch (err) {
  // 补丁失败不应让 npm install 整体失败（真出问题时构建日志里会再报）
  console.warn("[patch-opennext] 出错（不影响安装继续）:", err && err.message);
}
