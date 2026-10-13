/**
 * POST /api/generate  对句生成（AI 优先，失败自动降级到本地引擎）
 * GET  /api/generate  运行时自检：当前是 AI 还是本地引擎、模型名、Key 指纹
 * ------------------------------------------------------------------
 * 关键设计：
 *   - AI 失败**不报错给用户**，而是带着 fallbackReason 降级到本地引擎，
 *     保证这个工具任何时候点下去都有东西出来（老师上课时最怕白屏）。
 *   - AI 给的下联字数若与上联不符，直接丢弃（见 lib/ai.ts 的 normalizeCandidates）。
 *   - 平仄永远由本地算法覆盖，避免模型算错还理直气壮。
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import {
  aiKeyFingerprint,
  generateWithAi,
  getAiConfig,
  isAiConfigured,
  probeModels,
} from "@/lib/ai";
import { buildAnalysis } from "@/lib/analyze";
import { confidentLibraryHits, generateLocal, normalizeUpper } from "@/lib/localEngine";
import {
  KIND_META,
  type CoupletCandidate,
  type CoupletKind,
  type GenerateResponse,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS: CoupletKind[] = ["classic", "homophone", "modern"];

function hashId(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function fail(error: string, status = 400) {
  const body: GenerateResponse = { ok: false, error, engine: "local", candidates: [] };
  return NextResponse.json(body, { status });
}

/**
 * 探针：读出 Worker 的**原始绑定**（只报变量名与长度，**绝不报值**）。
 *
 * 为什么不能直接看 process.env：OpenNext 启动时会用构建期烘焙进
 * `next-env.mjs` 的值把 `process.env` 补齐，于是「变量压根不存在」和
 * 「变量存在但值为空」表现出来一模一样（都是空字符串）。
 * 只有 `getCloudflareContext().env` 是运行时真实绑定，能一眼分清。
 *
 * 排查线上「明明设了变量却读不到」时，看这里：
 *   - apiKeyPresent=false  → Secret 根本没绑到这个 Worker 上（没保存 / 存到了别处）
 *   - apiKeyPresent=true 且 apiKeyLength=0 → 绑上了但值是空的
 */
function envProbe() {
  try {
    const { env } = getCloudflareContext();
    const raw = env as unknown as Record<string, unknown>;
    const names = Object.keys(raw)
      .filter((k) => k !== "ASSETS" && k !== "WORKER_SELF_REFERENCE")
      .sort()
      .slice(0, 20);
    const keyVal = raw.AI_API_KEY;
    return {
      available: true,
      names,
      apiKeyPresent: "AI_API_KEY" in raw,
      apiKeyLength: typeof keyVal === "string" ? keyVal.length : null,
    };
  } catch (e) {
    // 本地 `next dev` 没有 Workers 上下文，走到这里属于正常
    return {
      available: false,
      reason: e instanceof Error ? e.message.slice(0, 80) : "无法读取运行环境",
    };
  }
}

/**
 * 模型体检的默认候选（都是魔搭清单里的「Flash / 轻量」一档，
 * 因为主要目的是找**不把额度烧在思考上**的模型）。
 */
const PROBE_DEFAULT_MODELS = [
  "Qwen/Qwen3.8-Flash-Next",
  "Qwen/Qwen3.8-27B",
  "deepseek-ai/DeepSeek-V4-Flash-0731",
  "ZhipuAI/GLM-4.7-Flash",
  "ZhipuAI/GLM-5.2",
  "stepfun-ai/Step-3.7-Flash",
  "Shanghai_AI_Laboratory/Intern-S2-Preview",
  "MiniMax/MiniMax-M3",
];

/** 体检会花掉真实的调用额度，加个冷却，防止被反复触发 */
const PROBE_COOLDOWN_MS = 15000;
let lastProbeAt = 0;

export async function GET(req: Request) {
  const url = new URL(req.url);

  // GET /api/generate?probe=1[&models=A,B][&heavy=1][&parallel=1][&nothink=1][&jsonmode=0][&tmo=45000]
  // 模型体检：挨个点名调用候选模型，报出「正文 / 思考产出 + 耗时」
  if (url.searchParams.get("probe") === "1") {
    const now = Date.now();
    if (now - lastProbeAt < PROBE_COOLDOWN_MS) {
      const wait = Math.ceil((PROBE_COOLDOWN_MS - (now - lastProbeAt)) / 1000);
      return NextResponse.json({ ok: false, error: `体检冷却中，请 ${wait} 秒后再试` }, { status: 429 });
    }
    const cfg = getAiConfig();
    if (!isAiConfigured()) {
      return NextResponse.json(
        { ok: false, error: "还没读到 AI_API_KEY，体检无从谈起（先看同一接口的 envProbe）" },
        { status: 400 }
      );
    }
    const parallel = url.searchParams.get("parallel") === "1";
    const asked = (url.searchParams.get("models") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, parallel ? 6 : 8);
    const list = asked.length ? asked : PROBE_DEFAULT_MODELS;
    const opted = {
      models: list,
      heavy: url.searchParams.get("heavy") === "1",
      noThink: url.searchParams.get("nothink") === "1",
      jsonMode: url.searchParams.get("jsonmode") !== "0",
      say: (url.searchParams.get("say") || "只回复两个字：可以").slice(0, 40),
      timeoutMs: Math.min(60000, Math.max(8000, Number(url.searchParams.get("tmo")) || cfg.timeoutMs)),
      parallel,
    };

    lastProbeAt = now;
    const rows = await probeModels(cfg, opted);
    return NextResponse.json({
      ok: true,
      current: cfg.model,
      heavy: opted.heavy,
      noThink: opted.noThink,
      jsonMode: opted.jsonMode,
      timeoutMs: opted.timeoutMs,
      parallel: opted.parallel,
      rows,
    });
  }

  const cfg = getAiConfig();
  const configured = isAiConfigured();
  return NextResponse.json({
    ok: true,
    configured,
    engine: configured ? "ai" : "local",
    model: configured ? cfg.model : null,
    endpoint: cfg.baseUrl,
    keyFingerprint: aiKeyFingerprint(),
    envProbe: envProbe(),
    service: "对韵 · /api/generate",
  });
}

export async function POST(req: Request) {
  const started = Date.now();

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail("请求体不是合法的 JSON");
  }

  const upper = normalizeUpper(typeof body.upper === "string" ? body.upper : "");
  const kind: CoupletKind = KINDS.includes(body.kind as CoupletKind)
    ? (body.kind as CoupletKind)
    : "classic";
  const count = Math.min(5, Math.max(1, Number(body.count) || 3));
  const seedRaw = Number(body.seed);
  const seed = Number.isFinite(seedRaw) ? Math.abs(Math.trunc(seedRaw)) : 0;

  if (upper.length < 2) return fail("上联至少需要 2 个字");
  if (upper.length > 30) return fail("上联最多 30 个字，再长就不是对联的体例了");

  const localResponse = (fallbackReason?: string): GenerateResponse => {
    const candidates = generateLocal(upper, kind, count, seed);
    return {
      ok: candidates.length > 0,
      error: candidates.length
        ? undefined
        : "本地句库里找不到同字数、平仄相对的句子，请换个上联或配置 AI Key",
      engine: "local",
      fallbackReason,
      candidates,
      elapsedMs: Date.now() - started,
    };
  };

  if (!isAiConfigured()) {
    // 常驻的小字已经说明「未配置 AI Key」，这里只补一句机制说明，别重复啰嗦
    return NextResponse.json(
      localResponse("库中命中优先，其次集句（取库中真实句子成对）")
    );
  }

  try {
    const raws = await generateWithAi(upper, kind, count);

    const aiCandidates: CoupletCandidate[] = raws.map((r) => ({
      id: `ai-${hashId(upper + r.lower)}`,
      upper,
      lower: r.lower,
      kind,
      source: "ai",
      analysis: buildAnalysis(upper, r.lower, {
        conception: r.conception,
        allusion: r.allusion,
      }),
      note: r.note || `AI 生成 · ${KIND_META[kind].label}`,
      homophone: r.homophone && r.homophone.trim() ? r.homophone : undefined,
    }));

    // 库里「完全命中」的原句永远排在最前 —— 库是逐条校对过的权威语料，
    // 比模型可靠；拆字联这类「机关固定、只有一种对法」的联尤其如此，
    // 模型很容易对不上机关（例如把「此木为柴山山出」对成别的意思）。
    // 只挑完全命中，近似命中不插队，仍按原顺序留给本地引擎兜底。
    const head = confidentLibraryHits(upper, kind);
    const seen = new Set(head.map((c) => c.lower));
    const candidates: CoupletCandidate[] = [...head];
    for (const c of aiCandidates) {
      if (candidates.length >= count) break;
      if (seen.has(c.lower)) continue;
      seen.add(c.lower);
      candidates.push(c);
    }

    // AI 只给了 1~2 条（或被库内原句挤掉）时，用本地引擎补足到 count，
    // 保证「换一换」有内容可翻
    if (candidates.length < count) {
      for (const c of generateLocal(upper, kind, count, seed + candidates.length)) {
        if (candidates.length >= count) break;
        if (seen.has(c.lower)) continue;
        seen.add(c.lower);
        candidates.push(c);
      }
    }

    return NextResponse.json({
      ok: true,
      engine: "ai",
      candidates,
      elapsedMs: Date.now() - started,
    } satisfies GenerateResponse);
  } catch (e) {
    const reason = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json(localResponse(`AI 调用失败，已自动降级：${reason}`));
  }
}
