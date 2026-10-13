// 线上核对探针：只读，不写任何数据。
const BASE = "https://lwdy.de5.net";

const targets = [
  ["/api/auth/me?selfcheck=1", "数据库自检 + 当前用户"],
  ["/api/posts?limit=1", "文章列表"],
  ["/api/auth/me?hash=1&it=200000", "旧探针是否已撤掉（应为正常响应，不是空体）"],
  ["/", "落地页"],
  ["/register", "注册页"],
  ["/studio", "工作台"],
  ["/blog", "博客列表"],
];

const out = [];
for (const [path, label] of targets) {
  const t0 = Date.now();
  try {
    const res = await fetch(BASE + path, {
      headers: { accept: "text/html,application/json" },
      redirect: "manual",
    });
    const ms = Date.now() - t0;
    const ct = res.headers.get("content-type") || "";
    const body = await res.text();
    let brief;
    if (ct.includes("json")) {
      try {
        brief = JSON.stringify(JSON.parse(body)).slice(0, 300);
      } catch {
        brief = "<JSON 解析失败> " + body.slice(0, 200);
      }
    } else {
      // HTML：抓 title 和前几个关键标记，别把整页打出来
      const title = (body.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "";
      brief = `HTML ${body.length} 字节 | title="${title.trim().replace(/\s+/g, " ")}"`;
    }
    out.push(`${String(res.status).padEnd(4)} ${String(ms + "ms").padEnd(7)} ${label.padEnd(26)} ${path}\n       ${brief}`);
  } catch (e) {
    out.push(`ERR  ${label.padEnd(26)} ${path}\n       ${e && e.message}`);
  }
}

console.log(out.join("\n"));
