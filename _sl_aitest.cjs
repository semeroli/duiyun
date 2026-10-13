/**
 * 本地桩件测试：验证 lib/ai.ts 对「上游返回各种怪形状」的处置
 * ------------------------------------------------------------------
 * 起一个假的 OpenAI 兼容服务（127.0.0.1:4312），按需要返回：
 *   normal    正常 JSON 正文
 *   empty     正文为空、额度被「思考」吃光（finish_reason=length）
 *   reason    正文为空、JSON 落在 reasoning_content 里
 *   envelope  平台错误信封（没有 choices）
 * 然后往本地 dev server（4311）打真实请求，看它怎么降级/报错。
 *
 * 用法：先起 dev（带假 AI 配置），再跑本脚本
 *   AI_BASE_URL=http://127.0.0.1:4312/v1 AI_API_KEY=test-key-abcdefghij \
 *   AI_MODEL=mock npx next dev -p 4311
 */
const http = require("node:http");

let MODE = "normal";

const okJson = (obj) => JSON.stringify(obj);

function buildBody() {
  if (MODE === "empty") {
    return {
      choices: [
        {
          finish_reason: "length",
          message: { role: "assistant", content: "", reasoning_content: "思考中……".repeat(20) },
        },
      ],
    };
  }
  if (MODE === "reason") {
    const inner = okJson({
      candidates: [
        {
          lower: "处处闻啼鸟",
          conception: "以鸟啼相应和，声气相谐，动静相衬，春意相连而不重复。",
          note: "mock 思考字段",
        },
      ],
    });
    return {
      choices: [
        { finish_reason: "stop", message: { role: "assistant", content: "", reasoning_content: "先想一下……\n" + inner } },
      ],
    };
  }
  if (MODE === "envelope") {
    return { code: "InvalidParameter", message: "model not found: mock-not-exist" };
  }
  return {
    choices: [
      {
        finish_reason: "stop",
        message: {
          role: "assistant",
          content: okJson({
            candidates: [
              {
                lower: "处处闻啼鸟",
                conception: "以鸟啼相应和，声气相谐，动静相衬，春意相连而不重复。",
                note: "mock 正常返回",
                homophone: "",
                allusion: { has: false },
              },
            ],
          }),
        },
      },
    ],
  };
}

const mock = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const payload = okJson(buildBody());
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(payload);
  });
});

function post(body, timeoutMs = 40000) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = http.request(
      "http://127.0.0.1:4311/api/generate",
      {
        method: "POST",
        timeout: timeoutMs,
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
      },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(d));
          } catch {
            resolve({ raw: d.slice(0, 200) });
          }
        });
      }
    );
    req.on("error", (e) => resolve({ err: e.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ err: "超时" });
    });
    req.write(data);
    req.end();
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

const UPPER = "春眠不觉晓";

(async () => {
  await new Promise((r) => mock.listen(4312, "127.0.0.1", r));
  console.log("桩件已就绪 → http://127.0.0.1:4312/v1");

  console.log("\n════ ① 正常返回：应走 AI ════");
  MODE = "normal";
  let r = await post({ upper: UPPER, kind: "classic", count: 3, seed: 0 });
  if (r.err || r.raw) console.log("  请求异常：" + (r.err || r.raw));
  check("engine 为 ai", r.engine === "ai", "engine=" + r.engine);
  check("候选来自 AI", (r.candidates || [])[0] && r.candidates[0].source === "ai", (r.candidates || [])[0] && r.candidates[0].lower);

  console.log("\n════ ② 正文为空、额度被思考吃光：应降级并说清原因 ════");
  MODE = "empty";
  r = await post({ upper: UPPER, kind: "classic", count: 3, seed: 0 });
  check("engine 降级为 local", r.engine === "local", "engine=" + r.engine);
  const fr = r.fallbackReason || "";
  check("原因里带 finish_reason=length", fr.includes("finish_reason=length"), fr.slice(0, 90));
  check("原因里带思考字段长度", fr.includes("思考字段长度"), "");
  check("仍给出可用候选（不白屏）", (r.candidates || []).length > 0, (r.candidates || []).length + " 条");

  console.log("\n════ ③ JSON 落在 reasoning_content 里：应被正确取用（新逻辑）════");
  MODE = "reason";
  r = await post({ upper: UPPER, kind: "classic", count: 3, seed: 0 });
  check("engine 为 ai（说明从思考字段里取到了 JSON）", r.engine === "ai", "engine=" + r.engine + " reason=" + (r.fallbackReason || "").slice(0, 60));
  check("候选来自 AI", (r.candidates || [])[0] && r.candidates[0].source === "ai", (r.candidates || [])[0] && r.candidates[0].lower);

  console.log("\n════ ④ 平台错误信封（无 choices）：应明说是错误信封 ════");
  MODE = "envelope";
  r = await post({ upper: UPPER, kind: "classic", count: 3, seed: 0 });
  const fr2 = r.fallbackReason || "";
  check("engine 降级为 local", r.engine === "local", "engine=" + r.engine);
  check("原因里写明「错误信封」", fr2.includes("错误信封"), fr2.slice(0, 90));
  check("原因里带出 code", fr2.includes("InvalidParameter"), "");

  console.log("\n════ 结果：" + pass + " PASS / " + fail + " FAIL ════");
  mock.close();
  process.exit(fail ? 1 : 0);
})();
