/**
 * 端到端验收脚本（纯 HTTP，不需要浏览器）
 *   1. GET  /api/generate              → 引擎自检
 *   2. POST /api/generate              → 生成候选（3 个）
 *   3. 逐项核对四维解析是否字段齐全
 *   4. 逐条核对平仄算得对不对（拿已知答案的联来验）
 *   5. 边界：字数不足 / 超长 / 非法 JSON
 *
 * 用法：node _sl_check.mjs
 */

const BASE = process.env.BASE || "http://127.0.0.1:4311";

let pass = 0;
let fail = 0;
const failures = [];

function ok(name, cond, extra = "") {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}${extra ? "  " + extra : ""}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL  ${name}${extra ? "  " + extra : ""}`);
  }
}

async function getJson(path) {
  const res = await fetch(BASE + path, { cache: "no-store" });
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* 留 null */
  }
  return { res, ct, text, json };
}

async function postJson(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
    cache: "no-store",
  });
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* 留 null */
  }
  return { res, ct, text, json };
}

(async () => {
  console.log("════ 1. 引擎自检 GET /api/generate ════");
  {
    const { res, ct, json } = await getJson("/api/generate");
    ok("状态码 200", res.status === 200, `got ${res.status}`);
    ok("响应是 JSON（不是 SPA 兜底 HTML）", ct.includes("application/json"), ct);
    ok("含 ok / configured / engine 字段", !!json && "ok" in json && "configured" in json && "engine" in json);
    ok("engine 取值合法", json && (json.engine === "ai" || json.engine === "local"), json && json.engine);
    ok("暴露 Key 指纹（便于线上排查）", !!json && typeof json.keyFingerprint === "string");
    console.log(`        → engine=${json && json.engine} configured=${json && json.configured} model=${json && json.model} fp=${json && json.keyFingerprint}`);
  }

  console.log("\n════ 2. 生成 POST /api/generate ════");
  const r1 = await postJson("/api/generate", { upper: "春风又绿江南岸", kind: "classic", count: 3, seed: 0 });
  {
    ok("状态码 200", r1.res.status === 200, `got ${r1.res.status}`);
    ok("响应是 JSON", r1.ct.includes("application/json"), r1.ct);
    const d = r1.json;
    ok("ok=true", d && d.ok === true, d && JSON.stringify(d.error || ""));
    ok("返回 3 个候选", d && Array.isArray(d.candidates) && d.candidates.length === 3, d && `got ${d.candidates && d.candidates.length}`);
    const c = d && d.candidates && d.candidates[0];
    ok("候选含 id/upper/lower/kind/source/analysis", !!(c && c.id && c.upper && c.lower && c.kind && c.source && c.analysis));
    ok("下联字数与上联相等", !!c && c.lower.length === c.upper.length, c && `上${c.upper.length} 下${c.lower.length}`);
    ok("下联只含汉字", !!c && /^[\u4e00-\u9fff]+$/.test(c.lower), c && c.lower);
    if (c) {
      const a = c.analysis;
      ok("tone.upperMarks 是 ○●× 串且长度=上联字数",
        typeof a.tone.upperMarks === "string" && a.tone.upperMarks.length === c.upper.length,
        `${a.tone.upperMarks} (len ${a.tone.upperMarks.length})`);
      ok("tone.lowerMarks 长度=下联字数", a.tone.lowerMarks.length === c.lower.length, a.tone.lowerMarks);
      ok("tone.pairs 数量=上联字数", Array.isArray(a.tone.pairs) && a.tone.pairs.length === c.upper.length, `len ${a.tone.pairs && a.tone.pairs.length}`);
      ok("tone.grade 取值合法", ["工整", "较工整", "宽松", "待推敲"].includes(a.tone.grade), a.tone.grade);
      ok("tone.summary 非空", typeof a.tone.summary === "string" && a.tone.summary.length > 5);
      ok("pos.pairs 非空且含上下词性", Array.isArray(a.pos.pairs) && a.pos.pairs.length > 0 &&
        typeof a.pos.pairs[0].upperPos === "string" && typeof a.pos.pairs[0].lowerPos === "string");
      ok("pos.summary 非空", typeof a.pos.summary === "string" && a.pos.summary.length > 5);
      ok("conception.summary 非空", typeof a.conception.summary === "string" && a.conception.summary.length > 5);
      ok("conception.harmony 取值合法", ["呼应", "相衬", "反差", "待打磨"].includes(a.conception.harmony), a.conception.harmony);
      ok("allusion.has 是布尔", typeof a.allusion.has === "boolean");
      console.log(`        → 下联「${c.lower}」`);
      console.log(`          上 ${a.tone.upperMarks}  下 ${a.tone.lowerMarks}  → ${a.tone.grade}`);
    }
  }

  console.log("\n════ 2b. 集句兜底（库里没有的上联，也必须给出真句子）════");
  {
    // 「荷塘月色清如水」是白话，名联库里没有 → 应当走集句
    const r = await postJson("/api/generate", { upper: "荷塘月色清如水", kind: "classic", count: 3, seed: 0 });
    const d = r.json;
    const cs = (d && d.candidates) || [];
    ok("库外上联也能给出候选", cs.length === 3, `${cs.length} 个：${cs.map((c) => c.lower).join("、")}`);
    ok("候选里出现 source=jiju", cs.some((c) => c.source === "jiju"), cs.map((c) => c.source).join(","));
    ok("集句候选的 note 说明了出处与「集句」", cs.filter((c) => c.source === "jiju").every((c) => /集句/.test(c.note || "") && /取自/.test(c.note || "")));
    ok("全部候选字数与上联相等", cs.every((c) => c.lower.length === c.upper.length), cs.map((c) => `${c.lower}(${c.lower.length})`).join(" "));
    ok("全部候选只含汉字", cs.every((c) => /^[\u4e00-\u9fff]+$/.test(c.lower)));
    ok("已无「借名联句式」这类历史文案", !cs.some((c) => /借名联/.test(c.note || "")));
    // 集句的底线：平仄必须相对（ratio ≥ 0.6），否则不配叫对联
    ok("集句候选平仄相对率都 ≥ 0.6", cs.filter((c) => c.source === "jiju").every((c) => c.analysis.tone.ratio >= 0.6),
      cs.map((c) => `${c.lower}:${(c.analysis.tone.ratio * 100).toFixed(0)}%`).join(" "));
    console.log(`        → ${cs.map((c) => `${c.lower}[${c.source}]`).join("  ")}`);
  }

  console.log("\n════ 3. 平仄算法正确性（拿有标准答案的对联验）════");
  {
    // 「春风又绿江南岸 / 明月何时照我还」出自王安石《泊船瓜洲》，本身就是一副工联
    const r = await postJson("/api/generate", { upper: "春风又绿江南岸", kind: "classic", count: 1, seed: 0 });
    const c = r.json && r.json.candidates && r.json.candidates[0];
    if (c && c.lower === "明月何时照我还") {
      // 春1平 风1平 又4仄 绿4仄(入) 江1平 南2平 岸4仄
      ok("上联平仄 = ○○●●○○●", c.analysis.tone.upperMarks === "○○●●○○●", c.analysis.tone.upperMarks);
      // 明2平 月4仄 何2平 时2平 照4仄 我3仄 还2平 —— 注意「时」是阳平，属平声
      // （这里原来被写成 ○●●○○●●，是把「时」误当仄声；平仄串一律以引擎输出为准，别手算）
      ok("下联平仄 = ○●○○●●○", c.analysis.tone.lowerMarks === "○●○○●●○", c.analysis.tone.lowerMarks);
      const shi = c.analysis.tone.lowerChars.find((x) => x.char === "时");
      ok("「时」被判为平声（阳平）", !!shi && shi.tone === "ping", shi && `${shi.tone}/${shi.pinyin}`);
      const ru = c.analysis.tone.upperChars.find((x) => x.char === "绿");
      ok("「绿」被识别为入声字（byRuSheng=true）", !!(ru && ru.byRuSheng), JSON.stringify(ru));
      ok("「绿」判为仄声", !!ru && ru.tone === "ze", ru && ru.tone);
    } else {
      console.log(`        （本地库未直接命中该联，实际下联「${c && c.lower}」，跳过定点断言）`);
    }
  }

  console.log("\n════ 4. 三种类型都能出结果 ════");
  for (const kind of ["classic", "homophone", "modern"]) {
    const r = await postJson("/api/generate", { upper: "两个黄鹂鸣翠柳", kind, count: 3, seed: 0 });
    const d = r.json;
    ok(`kind=${kind} 有候选且字数相等`, !!(d && d.ok && d.candidates.length >= 1 && d.candidates.every((c) => c.lower.length === c.upper.length)),
      d && d.candidates && `${d.candidates.length} 个 / ${d.candidates.map((c) => c.lower).join("、")}`);
    ok(`kind=${kind} 返回的 kind 字段正确`, !!(d && d.candidates.every((c) => c.kind === kind)));
  }

  console.log("\n════ 5.「换一换」确实换出不同内容 ════");
  {
    const a = await postJson("/api/generate", { upper: "海内存知己", kind: "classic", count: 3, seed: 0 });
    const b = await postJson("/api/generate", { upper: "海内存知己", kind: "classic", count: 3, seed: 1 });
    const la = (a.json.candidates || []).map((c) => c.lower).join("|");
    const lb = (b.json.candidates || []).map((c) => c.lower).join("|");
    ok("seed 变化后结果不同", la !== lb, `seed0=${la}  seed1=${lb}`);
  }

  console.log("\n════ 6. 边界与错误处理 ════");
  {
    const r1 = await postJson("/api/generate", { upper: "春", kind: "classic" });
    ok("1 个字 → 400 + 中文原因", r1.res.status === 400 && /至少/.test(r1.json.error || ""), `${r1.res.status} ${r1.json && r1.json.error}`);

    const r2 = await postJson("/api/generate", { upper: "春".repeat(31), kind: "classic" });
    ok("31 个字 → 400 + 中文原因", r2.res.status === 400 && /最多/.test(r2.json.error || ""), `${r2.res.status} ${r2.json && r2.json.error}`);

    const r3 = await postJson("/api/generate", "{ not json");
    ok("非法 JSON → 400 且不崩", r3.res.status === 400 && !!r3.json, `${r3.res.status}`);

    const r4 = await postJson("/api/generate", { upper: "春风，又绿！江南岸", kind: "classic", count: 1 });
    ok("上联含标点 → 自动清洗后仍能生成", r4.res.status === 200 && r4.json.ok, `upper=${r4.json && r4.json.candidates && r4.json.candidates[0] && r4.json.candidates[0].upper}`);

    const r5 = await postJson("/api/generate", { upper: "春风又绿江南岸", kind: "不存在的类型" });
    ok("非法 kind → 回落 classic 而不是报错", r5.res.status === 200 && r5.json.ok && r5.json.candidates[0].kind === "classic", r5.json && r5.json.candidates && r5.json.candidates[0].kind);
  }

  console.log("\n════ 7. 首页可访问 ════");
  {
    const res = await fetch(BASE + "/", { cache: "no-store" });
    const html = await res.text();
    ok("首页 200", res.status === 200, `${res.status}`);
    ok("HTML 含标题「对韵」", html.includes("对韵"));
    ok("HTML 含空状态引导语「请赐上联，待我应对」", html.includes("请赐上联，待我应对"));
    ok("HTML 含三种类型标签", html.includes("传统对联") && html.includes("趣味谐音") && html.includes("现代金句"));
    ok("HTML 含占位符「请输入上联」", html.includes("请输入上联"));
    ok("内联了主题首屏脚本（防闪白）", html.includes("data-theme"));
  }

  console.log(`\n════ 结果：${pass} PASS / ${fail} FAIL ════`);
  if (failures.length) {
    console.log("失败项：");
    failures.forEach((f) => console.log("  - " + f));
  }
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error("脚本异常：", e);
  process.exit(2);
});
