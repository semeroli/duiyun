// 用 node 自带 SQLite 在内存里验证 0002c（两个账号都提权）的语法与效果。
// 跑法：node --experimental-sqlite _check0002c.mjs
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

const raw = readFileSync("migrations/0002c_promote_all.console.sql", "utf8");

console.log("含 --  注解吗：", raw.includes("--") ? "❌ 有（控制台会吃掉后面）" : "✅ 没有");
console.log("压成一行后：", raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join(" "));

function makeDb(emails) {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    nickname TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    status TEXT NOT NULL DEFAULT 'active'
  );`);
  for (const e of emails) {
    db.prepare("INSERT INTO users (email, nickname, password_hash) VALUES (?, ?, 'x')").run(e, e.split("@")[0]);
  }
  return db;
}

// 场景一：线上现状 —— 2 个账号，都还是 user
{
  const db = makeDb(["wang@example.com", "wang2@example.com"]);
  db.exec(raw);
  const rows = db.prepare("SELECT id, email, role FROM users ORDER BY id").all();
  console.log("【2 个账号】执行后：", rows.map((r) => `#${r.id} ${r.email} → ${r.role}`).join(" | "));
  console.log(rows.every((r) => r.role === "admin") && rows.length === 2 ? "  ✅ PASS 两个都提成 admin 了" : "  ❌ FAIL");
}

// 场景二：还没注册的空表（提前跑）—— 不应报错
{
  const db = makeDb([]);
  db.exec(raw);
  console.log("【空表】执行不报错 ⇒ ✅ 符合预期（但控制台会说『成功』，所以必须看 SELECT）");
}

// 场景三：只有一个账号 —— 不应出错
{
  const db = makeDb(["only@example.com"]);
  db.exec(raw);
  const rows = db.prepare("SELECT id, email, role FROM users ORDER BY id").all();
  console.log("【1 个账号】执行后：", rows.map((r) => `#${r.id} ${r.email} → ${r.role}`).join(" | "));
  console.log(rows.length === 1 && rows[0].role === "admin" ? "  ✅ PASS" : "  ❌ FAIL");
}

// 场景四：误连点把整段粘两遍 —— 幂等，不该坏
{
  const db = makeDb(["a@x.com", "b@x.com"]);
  db.exec(raw);
  db.exec(raw);
  const rows = db.prepare("SELECT id, email, role FROM users ORDER BY id").all();
  console.log("【连跑两遍】结果：", rows.map((r) => `#${r.id} ${r.role}`).join(" | "));
  console.log(rows.every((r) => r.role === "admin") && rows.length === 2 ? "  ✅ PASS 幂等，跑两遍也没坏" : "  ❌ FAIL");
}
