/**
 * 复现「D1 控制台粘贴建表 SQL 报 incomplete input」的根因，并验证修好的版本
 * ------------------------------------------------------------------
 * 假设：控制台把粘贴内容压成**一行**（换行丢失）。
 *   那么 `--` 那句注释会把它**后面整段代码**都注释掉，
 *   于是数据库只看到半句 `CREATE TABLE ... (` → 报 incomplete input。
 *
 * 这个脚本用 node 自带的 SQLite 在内存里跑四种组合，让结论不靠猜：
 *   ① 带注释 + 保留换行   → 期望成功
 *   ② 带注释 + 压成一行   → 期望失败（这就是用户遇到的）
 *   ③ 无注释 + 保留换行   → 期望成功
 *   ④ 无注释 + 压成一行   → 期望成功（这就是给控制台用的版本）
 *
 * 跑法：node --experimental-sqlite _sqlcheck.mjs
 */

import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

const DOC = "migrations/0001_init.sql";
const CONSOLE = "migrations/0001_init.console.sql";

function flatten(sql) {
  // 模拟「控制台把换行吃掉」：所有空白折叠成一个空格
  return sql
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ");
}

function run(label, sql) {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(sql);
    const n = db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table'").get().n;
    console.log(`✅ ${label} —— 建出 ${n} 张表`);
    return true;
  } catch (e) {
    console.log(`❌ ${label} —— ${e.message}`);
    return false;
  } finally {
    db.close();
  }
}

const doc = fs.readFileSync(DOC, "utf8");
const con = fs.readFileSync(CONSOLE, "utf8");

console.log("—— 先确认「无注释」那份真的没有注释符号 ——");
const conFlatCheck = con.includes("--");
console.log(`   console 版含 "--" : ${conFlatCheck}${conFlatCheck ? "  ← 有问题，必须修" : "  ✓"}`);
// 只统计真正的行注释（两个减号）
console.log(`   console 版行数     : ${con.split(/\r?\n/).length} 行`);

console.log("\n—— 四种组合 ——");
const a = run("① 带注释 + 保留换行（文件原样）", doc);
const b = run("② 带注释 + 压成一行（含开头注释）", flatten(doc));

// ③ 复现用户看到的那句错：粘贴内容只有 SQL 语句、
//    开头那几行「分段标题」注释没被带上（从预览里选中的常见结果）。
//    此时第一个 -- 出现在 users 表内部，把后半句注释掉 → incomplete input
const strippedTo = doc.slice(doc.indexOf("CREATE TABLE IF NOT EXISTS users"));
const e = run("③ 带注释 + 压成一行 + 去掉开头注释（= 报错现场）", flatten(strippedTo));

const c = run("④ 无注释 + 保留换行", con);
const d = run("⑤ 无注释 + 压成一行（= 给控制台用的版本）", flatten(con));

console.log("\n—— 结论 ——");
if (a && c && d && !e) {
  console.log("   诊断成立：");
  console.log("   · 换行被压成一行后，`--` 注释会把它后面的代码整段吃掉；");
  console.log("   · 带注释的版本一旦再少了开头的分段注释，就正好剩下半句 CREATE TABLE →");
  console.log("     报的就是你看到的 `incomplete input: SQLITE_ERROR`；");
  console.log("   · migrations/0001_init.console.sql 全篇没有注释，压不压成一行都建得出来。");
  process.exit(0);
}
if (a && c && d) {
  console.log("   修好的版本确认可用（第 ③ 项是否复现不影响结论）。");
  process.exit(0);
}
console.log("   ⚠️ 与预期不符，需要重新判断（别急着让用户重试）。");
process.exit(1);
