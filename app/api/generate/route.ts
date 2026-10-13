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

import { NextResponse } from "next/server";
import { aiKeyFingerprint, generateWithAi, getAiConfig, isAiConfigured } from "@/lib/ai";
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

export async function GET() {
  const cfg = getAiConfig();
  const configured = isAiConfigured();
  return NextResponse.json({
    ok: true,
    configured,
    engine: configured ? "ai" : "local",
    model: configured ? cfg.model : null,
    endpoint: cfg.baseUrl,
    keyFingerprint: aiKeyFingerprint(),
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
