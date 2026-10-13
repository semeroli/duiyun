// 用 node 自带 SQLite 在内存里验证 0002b 这份提权 SQL 的语法与效果。
// 跑法：node --experimental-sqlite _check0002b.mjs
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

const db = new DatabaseSync(":memory:");

// 建最小可用的 users 表（字段与 migrations/0001_init.sql 对齐）
db.exec(`
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

db.exec(`INSERT INTO users (email, nickname, password_hash) VALUES ('wang@example.com', '王老师', 'pbkdf2$x$y$z')`);

// 把文件按「控制台丢换行」的最坏情况压成一行，验证它照样能跑
const raw = readFileSync("migrations/0002b_promote_admin_sole_user.console.sql", "utf8");
const oneLine = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join(" ");
console.log("压成一行后：", oneLine);
console.log("含 --  注解吗：", raw.includes("--") ? "❌ 有（控制台会吃掉后面）" : "✅ 没有");

// 逐条执行（DatabaseSync.exec 本身支持多语句）
db.exec(raw);

const rows = db.prepare("SELECT id, email, nickname, role, status FROM users ORDER BY id").all();
console.log("执行后：");
for (const r of rows) console.log("  ", JSON.stringify(r));
const ok = rows.length === 1 && rows[0].role === "admin";
console.log(ok ? "✅ PASS 唯一账号已提权为 admin" : "❌ FAIL 角色没变成 admin");

// 再验一次「零行匹配」时不会报错（模拟还没注册就提前跑）
const db2 = new DatabaseSync(":memory:");
db2.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, nickname TEXT, role TEXT NOT NULL DEFAULT 'user', status TEXT NOT NULL DEFAULT 'active');`);
db2.exec(raw);
const after = db2.prepare("SELECT COUNT(*) AS n FROM users").get();
console.log("空表上执行不报错、影响 0 行 ⇒", after.n === 0 ? "✅ 符合预期（控制台仍会说『成功』，所以必须看 SELECT）" : "❌ 意外");
