/**
 * AI 适配层（服务端专用）
 * ------------------------------------------------------------------
 * 只要对方提供「OpenAI 兼容」的 /chat/completions 即可，因此
 * DeepSeek / 通义千问 / 智谱 / 魔搭 / OpenAI 都能直接接。
 *
 * 配置来源与优先级（从高到低）：
 *   1. 运行期环境变量 —— Cloudflare 上由 `wrangler.jsonc` 的 `vars` 段下发
 *      （非密钥配置）以及控制台里的 Secret（密钥）注入；
 *   2. 下面的兜底默认值 —— 只在前两者都拿不到时才生效。
 *
 * 🔴 非密钥配置（AI_BASE_URL / AI_MODEL）请改 `wrangler.jsonc` 的 `vars`，
 *    不要只写在 Cloudflare 控制台：`wrangler deploy` 每次部署都会清空
 *    Worker 上的明文变量（详见 wrangler.jsonc 内的说明）。
 *
 * 设计取舍：
 *   - 平仄不交给模型算（模型很容易算错），只让它产出文字与解析；
 *   - 要求返回严格 JSON，并用「剥代码块 → 取首尾花括号」两步容错解析；
 *   - 有的平台不支持 response_format，第一次 400 就自动去掉该参数重试。
 */

import { onlyHanzi } from "./tone";
import { KIND_META, type AllusionAnalysis, type CoupletKind } from "./types";

/** 与 wrangler.jsonc 的 vars 保持一致：换服务商时两处一起改 */
const DEFAULT_BASE_URL = "https://api-inference.modelscope.cn/v1";
const DEFAULT_MODEL = "deepseek-ai/DeepSeek-V4.1-Flash";

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function getAiConfig(): AiConfig {
  return {
    baseUrl: (env("AI_BASE_URL") || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    apiKey: env("AI_API_KEY"),
    model: env("AI_MODEL") || DEFAULT_MODEL,
    timeoutMs: Math.max(5000, Number(env("AI_TIMEOUT_MS")) || 60000),
  };
}

export function isAiConfigured(): boolean {
  return getAiConfig().apiKey.length > 8;
}

/**
 * Key 指纹：只暴露哈希前 8 位，用于线上排查「用的到底是哪把 Key」。
 *
 * 这里用 FNV-1a 而不用 SHA-256，是为了**彻底摆脱 node:crypto** ——
 * 部署到 Cloudflare Workers 时 Node 内置模块支持并不完整，
 * 而指纹只是拿来区分「是哪一把 Key」，不需要密码学强度。
 */
export function aiKeyFingerprint(): string {
  const key = getAiConfig().apiKey;
  if (!key) return "none";
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export interface AiCandidateRaw {
  lower: string;
  conception?: string;
  allusion?: AllusionAnalysis;
  homophone?: string;
  note?: string;
}

const SYSTEM_PROMPT = `你是一位精研对联三十年的中文楹联专家，兼通古典诗词与当代文案创作。

用户给出上联，你要对出下联，并从意境、典故两个维度给出解析。

【铁律】
1. 下联字数必须与上联【完全相等】，一字不多、一字不少。
2. 下联只输出纯汉字，不得含标点、空格、字母、数字、表情符号。
3. 上下联同一位次尽量避免出现同一个字（刻意重字者除外）。
4. 讲究平仄相对、词性相同、结构相当、意境相谐。
5. 不要输出平仄符号或 ○● 标注 —— 平仄由程序另外计算，你只负责文字与解析。
6. 不要编造典故出处。拿不准就把 allusion 写成 { "has": false }。
7. 【机关对必须破机关】先判断上联有没有「文字机关」：拆字（析字）、组字、
   同旁（偏旁）、叠字、回文、同音双关等。若有，下联**必须用同一种机关、同等数量**
   逐一对应，只顾平仄词性而破不了机关，就等于没有对上。
   - 拆字例：上联「此木为柴山山出」（「柴」＝此＋木、「出」＝山＋山），
     下联当为「因火成烟夕夕多」（「烟」＝因＋火、「多」＝夕＋夕）。
     同名异写要注意：「閒看门中月」的「閒」＝門＋月，写成简体「闲」（门＋木）
     就拆不出月，对句「思耕心上田」（「思」＝田＋心）也就落了空。
   - 这类联的机关写进 note，形如「拆字：烟＝因＋火，多＝夕＋夕」，一句说清即可。

【风格要求】
- 传统对联：典雅工稳，贴合古典诗词语言，可用典故。
- 趣味谐音：至少一处真正同音或近音的双关，并在 homophone 字段说清谐音点。
- 现代金句：白话入联，短句有力，适合文案与社交媒体，但仍须守住对仗。

【输出格式】
只输出一个 JSON 对象，不要 Markdown 代码块，不要任何解释性文字。结构如下：
{
  "candidates": [
    {
      "lower": "下联（纯汉字）",
      "conception": "意境呼应说明，40~90 字中文，讲清上下联如何相得益彰",
      "allusion": {
        "has": true,
        "title": "典故名",
        "source": "出典，如《世说新语·言语》",
        "explain": "30~70 字白话释义",
        "quote": "原文引句，可省略"
      },
      "homophone": "仅谐音类填写；其它类型填空字符串",
      "note": "一句话提示，20 字以内"
    }
  ]
}`;

function userPrompt(upper: string, kind: CoupletKind, count: number): string {
  const meta = KIND_META[kind];
  return `上联：${upper}
风格：${meta.label}（${meta.hint}）
请给出 ${count} 个【思路明显不同】的下联，不要只换一两个字。`;
}

function extractJson(raw: string): unknown {
  let t = (raw ?? "").trim();
  t = t.replace(/^```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  return JSON.parse(t);
}

function toAllusion(v: unknown): AllusionAnalysis | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const explain = typeof o.explain === "string" ? o.explain : "";
  const title = typeof o.title === "string" ? o.title : "";
  if (explain.length > 6 && explain.length < 400) {
    return {
      has: true,
      title: title.slice(0, 40) || "典故",
      source: typeof o.source === "string" ? o.source.slice(0, 80) : "",
      explain: explain.slice(0, 400),
      quote: typeof o.quote === "string" && o.quote.trim() ? o.quote.trim().slice(0, 120) : undefined,
    };
  }
  return { has: false };
}

function normalizeCandidates(data: unknown, upperLen: number): AiCandidateRaw[] {
  const arr = (data as { candidates?: unknown })?.candidates;
  if (!Array.isArray(arr)) return [];
  const out: AiCandidateRaw[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const lower = onlyHanzi(typeof o.lower === "string" ? o.lower : "");
    // 字数必须与上联一致，否则直接丢弃（宁可少给，不给错的）
    if (!lower || lower.length !== upperLen) continue;
    out.push({
      lower,
      conception: typeof o.conception === "string" ? o.conception.slice(0, 500) : undefined,
      allusion: toAllusion(o.allusion),
      homophone: typeof o.homophone === "string" ? o.homophone.slice(0, 200) : undefined,
      note: typeof o.note === "string" ? o.note.slice(0, 80) : undefined,
    });
  }
  return out;
}

async function postChat(
  cfg: AiConfig,
  upper: string,
  kind: CoupletKind,
  count: number,
  withJsonMode: boolean
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
  try {
    const body: Record<string, unknown> = {
      model: cfg.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt(upper, kind, count) },
      ],
      temperature: 0.95,
      // 🔴 免费/推理类模型会把输出额度先花在「思考」上。1600 太小：
      // 实测魔搭 deepseek-ai/DeepSeek-V4.1-Flash 跑满 1600 后正文一个字没吐
      // （耗时 20 秒左右、content 为空）—— 留足额度才有正文。
      max_tokens: 3200,
    };
    if (withJsonMode) body.response_format = { type: "json_object" };

    return await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

function pickContent(payload: unknown): string {
  const choices = (payload as { choices?: unknown })?.choices;
  if (!Array.isArray(choices) || !choices.length) return "";
  const msg = (choices[0] as { message?: { content?: unknown } })?.message;
  const content = msg?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    // 有的平台把正文拆成数组块
    return content
      .map((c) => (c && typeof c === "object" && "text" in c ? String((c as { text: unknown }).text) : ""))
      .join("");
  }
  return "";
}

/** 部分平台（如魔搭上的推理模型）把思考过程单独放在 message.reasoning_content */
function pickReasoning(payload: unknown): string {
  const choices = (payload as { choices?: unknown })?.choices;
  if (!Array.isArray(choices) || !choices.length) return "";
  const msg = (choices[0] as { message?: Record<string, unknown> })?.message;
  const rc = msg?.reasoning_content;
  return typeof rc === "string" ? rc : "";
}

/**
 * 失败时给一句「能拿去排查」的中文说明。
 * 只报长度与开头，不打印 Key；把 finish_reason / 思考字段长度都带上，
 * 是为了区分「额度被思考吃光」和「平台返回错误信封」这两种完全不同的病。
 */
function describeFailure(content: string, reasoning: string, data: unknown, rawText: string): string {
  const o = data as Record<string, unknown> | null;
  if (o && typeof o === "object" && !("choices" in o) && ("message" in o || "code" in o)) {
    const code = String((o as { code?: unknown }).code ?? "-");
    const msg = String((o as { message?: unknown }).message ?? "").slice(0, 150);
    return `AI 平台返回错误信封：code=${code} message=${msg}`;
  }
  const ch0 = (o as { choices?: unknown[] })?.choices?.[0] as Record<string, unknown> | undefined;
  const finish = ch0 ? String(ch0.finish_reason ?? "未提供") : "响应里没有 choices";
  return (
    `AI 没有产出可解析的正文（finish_reason=${finish}，正文长度=${content.length}，` +
    `思考字段长度=${reasoning.length}；原文开头：${rawText.replace(/\s+/g, " ").slice(0, 150)}）`
  );
}

/** 调用模型生成候选；失败时抛出的 Error.message 是可直接展示的中文 */
export async function generateWithAi(
  upper: string,
  kind: CoupletKind,
  count: number,
  cfg: AiConfig = getAiConfig()
): Promise<AiCandidateRaw[]> {
  let res: Response;
  try {
    res = await postChat(cfg, upper, kind, count, true);
    if (res.status === 400 || res.status === 422) {
      // 平台不支持 response_format，去掉重试一次
      res = await postChat(cfg, upper, kind, count, false);
    }
  } catch (e) {
    const err = e as { name?: string; message?: string };
    if (err?.name === "AbortError") {
      throw new Error(`AI 响应超时（${Math.round(cfg.timeoutMs / 1000)} 秒未返回）`);
    }
    throw new Error(`连接 AI 服务失败：${err?.message ?? "未知网络错误"}`);
  }

  const text = await res.text();

  if (!res.ok) {
    const brief = text.replace(/\s+/g, " ").slice(0, 200);
    if (res.status === 401 || res.status === 403) {
      throw new Error(`AI 鉴权失败（HTTP ${res.status}）：请检查 AI_API_KEY 是否正确、是否已完成账号验证`);
    }
    if (res.status === 429) {
      throw new Error("AI 平台限流（HTTP 429）：当前免费额度可能已用尽，稍后再试或更换模型");
    }
    throw new Error(`AI 返回错误 HTTP ${res.status}：${brief}`);
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`AI 返回的不是 JSON（正文开头：${text.slice(0, 80)}）`);
  }

  const content = pickContent(data);
  const reasoning = pickReasoning(data);

  // 正文与思考字段都试一遍：魔搭上的推理模型有时把整段 JSON 落在
  // reasoning_content 里、正文留空。这是**纯增量**逻辑 —— 正文正常时
  // 第一轮就命中，行为与以前完全一致。
  let parsed: unknown = null;
  for (const cand of [content, reasoning]) {
    if (!cand.trim()) continue;
    try {
      parsed = extractJson(cand);
      break;
    } catch {
      // 这一个不行，试下一个
    }
  }

  if (parsed === null) throw new Error(describeFailure(content, reasoning, data, text));

  const candidates = normalizeCandidates(parsed, onlyHanzi(upper).length);
  if (!candidates.length) {
    throw new Error("AI 没有给出字数合规的下联（可能是模型未能守住所要求的字数）");
  }
  return candidates;
}
