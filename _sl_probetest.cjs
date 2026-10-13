/**
 * 模型体检（probe）的桩件测试
 * ------------------------------------------------------------------
 * 起假模型服务（4313），然后请求本地 dev 的
 *   GET /api/generate?probe=1&models=mock-good,mock-empty&nothink=1
 * 其中 mock-empty 名字带 empty ⇒ 假模型回「正文为空、思考很长」，
 * 用来验证体检能把这两种情况分辨出来。
 *
 * 用法：先起 dev（带假 AI 配置）
 *   AI_BASE_URL=http://127.0.0.1:4313/v1 AI_API_KEY=test-key-abcdefghij \
 *   AI_MODEL=mock GOOD npx next dev -p 4311
 */
const http = require("node:http");

const mock = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    let model = "";
    let noThink;
    try {
      const b = JSON.parse(raw);
      model = String(b.model || "");
      noThink = b.enable_thinking === false && b.chat_template_kwargs && b.chat_template_kwargs.enable_thinking === false;
    } catch {
      /* ignore */
    }
    const msg =
      model.includes("empty")
        ? { role: "assistant", content: "", reasoning_content: "想啊想……".repeat(40) }
        : { role: "assistant", content: "可以", reasoning_content: "" };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        choices: [{ finish_reason: model.includes("empty") ? "length" : "stop", message: msg }],
        echoNothink: !!noThink,
      })
    );
  });
});

function get(path) {
  return new Promise((resolve) => {
    const req = http.get("http://127.0.0.1:4311" + path, { timeout: 60000 }, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(d) });
        } catch {
          resolve({ status: res.statusCode, raw: d.slice(0, 200) });
        }
      });
    });
    req.on("error", (e) => resolve({ err: e.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ err: "超时" });
    });
  });
}

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) {
    pass++;
    console.log("  PASS  " + name + (detail ? "  [" + detail + "]" : ""));
  } else {
    fail++;
    console.log("  FAIL  " + name + (detail ? "  [" + detail + "]" : ""));
  }
}

(async () => {
  // 前置检查：dev server 必须指向本脚本的假模型（4313）
  const pre = await get("/api/generate");
  if (!pre || pre.err || !String((pre.json || {}).endpoint || "").includes("127.0.0.1:4313")) {
    console.log("⛔ 前置条件不满足，本测试不适用于当前 dev server。");
    console.log("   期望 AI_BASE_URL 指向 http://127.0.0.1:4313/v1");
    console.log("   实际 endpoint = " + ((pre && pre.json && pre.json.endpoint) || JSON.stringify(pre)));
    console.log("   请按下面这样重启 dev：");
    console.log("   AI_BASE_URL=http://127.0.0.1:4313/v1 AI_API_KEY=test-key-abcdefghij AI_MODEL=mock AI_TIMEOUT_MS=20000 \\");
    console.log("     CODEBUDDY_SAFE_DELETE_ENABLED=0 npx next dev -p 4311");
    process.exit(2);
  }

  await new Promise((r) => mock.listen(4313, "127.0.0.1", r));
  console.log("桩件已就绪 → http://127.0.0.1:4313/v1");

  console.log("\n════ 模型体检 GET /api/generate?probe=1 ════");
  const r = await get("/api/generate?probe=1&models=mock-good,mock-empty&nothink=1&say=只回复两个字：可以");
  if (r.err || r.raw) {
    console.log("  请求异常：" + (r.err || r.raw));
    fail++;
  } else {
    console.log(JSON.stringify(r.json, null, 1));
    const rows = r.json.rows || [];
    check("返回 ok", r.json.ok === true, "ok=" + r.json.ok);
    check("返回两行体检结果", rows.length === 2, rows.length + " 行");
    const good = rows.find((x) => x.model === "mock-good") || {};
    const bad = rows.find((x) => x.model === "mock-empty") || {};
    check("正常模型判为 ok", good.verdict === "ok", "verdict=" + good.verdict + " 正文" + good.contentLen + "字");
    check("正常模型正文长度 > 0", (good.contentLen || 0) > 0, String(good.contentLen));
    check("空正文模型被识别出来", bad.verdict === "空正文（思考吃光额度）", "verdict=" + bad.verdict);
    check("空正文模型 finish=length", bad.finish === "length", "finish=" + bad.finish);
    check("空正文模型思考长度 > 0", (bad.reasonLen || 0) > 0, String(bad.reasonLen));
    check("nothink 开关透传（体检回显）", r.json.noThink === true, "noThink=" + r.json.noThink);
  }

  console.log("\n════ 结果：" + pass + " PASS / " + fail + " FAIL ════");
  mock.close();
  process.exit(fail ? 1 : 0);
})();
