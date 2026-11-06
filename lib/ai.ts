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
import {
  KIND_META,
  type AllusionAnalysis,
  type CoupletKind,
  type ProviderInfo,
} from "./types";

/**
 * 多服务商清单：对韵现在支持「魔搭 / 商汤日日新 / InferX」三家并存。
 * 每一家独立用一把 Key（各自不同的环境变量名），界面上用下拉框切换，
 * 哪家没填 Key 就自动灰掉。换服务商只改这一张表，业务代码其余部分不动。
 *
 * thinkingOff 字段说明「这家怎么关掉模型的『思考』」：
 *   - "modelscope"  用 enable_thinking:false（魔搭 / DeepSeek 系通用写法）
 *   - "sensenova"   用 reasoning_effort:"none"（商汤日日新专用写法，
 *                   和魔搭写法不同，写错就关不掉、额度烧在思考上）
 *   - "none"        不额外发关思考参数（模型本身不是推理模型，或待测）
 *
 * 与 wrangler.jsonc 的 vars / Secrets 保持一致：换服务商/换模型时两处一起改。
 */
export type ThinkingOffStyle = "modelscope" | "sensenova" | "none";

export interface AiProvider {
  id: string;
  /** 界面下拉框与徽标上展示的简短名 */
  label: string;
  baseUrl: string;
  model: string;
  /** 读取 Key 的环境变量名（每家的 Key 互不干扰） */
  keyEnv: string;
  thinkingOff: ThinkingOffStyle;
}

export const PROVIDERS: AiProvider[] = [
  {
    id: "modelscope",
    label: "魔搭 · Qwen3.8-Flash-Next",
    baseUrl: "https://api-inference.modelscope.cn/v1",
    model: "Qwen/Qwen3.8-Flash-Next",
    keyEnv: "AI_API_KEY",
    thinkingOff: "modelscope",
  },
  {
    id: "sensenova",
    label: "商汤日日新 · sensenova-6.8-flash-lite",
    baseUrl: "https://token.sensenova.cn/v1",
    model: "sensenova-6.8-flash-lite",
    keyEnv: "SENSENOVA_API_KEY",
    thinkingOff: "sensenova",
  },
  {
    // base URL 已在 InferX 控制台（Endpoints → Token-Based）确认：
    //   共享端点 https://model.inferx.net/endpoints/v1，实际请求打到
    //   .../endpoints/v1/chat/completions（postChat 会自动补 /chat/completions）。
    id: "inferx",
    label: "InferX · deepseek-v4.1-flash",
    baseUrl: "https://model.inferx.net/endpoints/v1",
    model: "deepseek-v4.1-flash-1017-basic",
    keyEnv: "INFERX_API_KEY",
    // deepseek-v4.1-flash 属 DeepSeek 系，先按 enable_thinking:false 试，
    // 线上用 ?probe=1&heavy=1 实测，若关不掉思考再调整。
    thinkingOff: "modelscope",
  },
];

const DEFAULT_BASE_URL = PROVIDERS[0].baseUrl;
const DEFAULT_MODEL = PROVIDERS[0].model;

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  /** 关思考的写法（按服务商不同） */
  thinkingStyle: ThinkingOffStyle;
}

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

/** 取某家服务商的配置；不传或传错则回落到魔搭（保持旧行为） */
export function getAiConfigFor(id: string): AiConfig {
  const p = PROVIDERS.find((x) => x.id === id) ?? PROVIDERS[0];
  return {
    baseUrl: p.baseUrl,
    apiKey: env(p.keyEnv),
    model: p.model,
    timeoutMs: Math.max(5000, Number(env("AI_TIMEOUT_MS")) || 60000),
    thinkingStyle: p.thinkingOff,
  };
}

/** 默认配置（魔搭），保留给体检、本地兜底等不需要指定服务商的地方 */
export function getAiConfig(): AiConfig {
  return {
    baseUrl: (env("AI_BASE_URL") || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    apiKey: env("AI_API_KEY"),
    model: env("AI_MODEL") || DEFAULT_MODEL,
    timeoutMs: Math.max(5000, Number(env("AI_TIMEOUT_MS")) || 60000),
    thinkingStyle: "modelscope",
  };
}

/** 列出所有服务商，并标注哪家已经填了 Key（界面据此渲染下拉框） */
export function listProviders(): ProviderInfo[] {
  return PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    model: p.model,
    configured: env(p.keyEnv).length > 8,
  }));
}

/** 找到第一个「已经填了 Key 的」服务商 id，作为默认选中项 */
export function defaultProviderId(): string {
  const hit = PROVIDERS.find((p) => env(p.keyEnv).length > 8);
  return hit?.id ?? PROVIDERS[0].id;
}

export function isAiConfigured(cfg?: AiConfig): boolean {
  return (cfg ?? getAiConfig()).apiKey.length > 8;
}

/**
 * Key 指纹：只暴露哈希前 8 位，用于线上排查「用的到底是哪把 Key」。
 *
 * 这里用 FNV-1a 而不用 SHA-256，是为了**彻底摆脱 node:crypto** ——
 * 部署到 Cloudflare Workers 时 Node 内置模块支持并不完整，
 * 而指纹只是拿来区分「是哪一把 Key」，不需要密码学强度。
 */
export function aiKeyFingerprint(cfg?: AiConfig): string {
  const key = (cfg ?? getAiConfig()).apiKey;
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

/**
 * 按服务商把「关思考」参数写进请求体。
 * 三家写法不同，写错就关不掉、额度烧在思考上、正文 0 字——
 * 这是线上实测踩出来的坑（见 wrangler.jsonc 的 AI_MODEL 注释）。
 */
function applyThinkingOff(body: Record<string, unknown>, style: ThinkingOffStyle): void {
  if (style === "modelscope") {
    // 魔搭 / DeepSeek 系：enable_thinking:false 关掉思考
    body.enable_thinking = false;
    body.chat_template_kwargs = { enable_thinking: false };
  } else if (style === "sensenova") {
    // 商汤日日新：用 reasoning_effort:"none" 关思考（写法与魔搭不同）
    body.reasoning_effort = "none";
  }
  // style === "none" 时不发任何关思考参数
}

/**
 * 一次 chat/completions 调用。
 *
 * 🔑 `noThink` 是本项目**最关键的开关**：魔搭上主流模型都是推理模型，会把
 * max_tokens 整段烧在「思考」上、正文一个字不吐（实测 3 个候选的真实负载下
 * 烧掉 4000~8000 字思考、正文 0 字）。带上 enable_thinking:false 之后，
 * 同样 5 个模型从「全部失败/超时」变成 8~13 秒产出 800~1100 字完整 JSON。
 */
async function postChat(
  cfg: AiConfig,
  upper: string,
  kind: CoupletKind,
  count: number,
  withJsonMode: boolean,
  noThink: boolean
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
      // 留足额度：万一没有关掉思考（平台不认那个参数），大额度还能给正文
      // 留下一点空间，不至于一个字都吐不出来
      max_tokens: 3200,
    };
    if (withJsonMode) body.response_format = { type: "json_object" };
    // 关思考：按服务商用对的写法。不认的字段平台一般会忽略；
    // 万一 400 了，generateWithAi 会自动退回不带它们的版本重试。
    if (noThink) applyThinkingOff(body, cfg.thinkingStyle);

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
  // 依次退让：首选「JSON 模式 + 关思考」；某个平台不认某个参数就退回，
  // 以保证换平台时不至于一上来就 400。只有 400/422 才继续退。
  const VARIANTS = [
    { jsonMode: true, noThink: true },
    { jsonMode: false, noThink: true },
    { jsonMode: true, noThink: false },
    { jsonMode: false, noThink: false },
  ];

  let res: Response | null = null;
  try {
    for (const v of VARIANTS) {
      res = await postChat(cfg, upper, kind, count, v.jsonMode, v.noThink);
      if (res.status !== 400 && res.status !== 422) break;
    }
  } catch (e) {
    const err = e as { name?: string; message?: string };
    if (err?.name === "AbortError") {
      throw new Error(`AI 响应超时（${Math.round(cfg.timeoutMs / 1000)} 秒未返回）`);
    }
    throw new Error(`连接 AI 服务失败：${err?.message ?? "未知网络错误"}`);
  }
  if (!res) throw new Error("AI 服务没有任何响应");

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

export interface ModelProbeRow {
  model: string;
  heavy: boolean;
  noThink: boolean;
  status: number;
  ms: number;
  finish: string;
  contentLen: number;
  reasonLen: number;
  head: string;
  verdict: "ok" | "空正文（思考吃光额度）" | "无正文" | "请求失败";
  error?: string;
}

export interface ProbeOptions {
  models: string[];
  /** true = 用线上真正那套系统提示词与输出规模（3 个候选、完整 JSON） */
  heavy: boolean;
  /** 关思考的两种常见写法都带上 */
  noThink: boolean;
  /** 是否带 response_format: json_object（线上默认带） */
  jsonMode: boolean;
  /** 提问用的上联（heavy 模式）或一句话（轻量模式） */
  say: string;
  /** 单个模型的超时 */
  timeoutMs: number;
  /** 并发跑（墙钟时间 = 最慢那个，而不是求和） */
  parallel: boolean;
}

/**
 * 模型体检：拿线上这把 Key **挨个点名调用**候选模型，报出每个模型
 * 在真实负载下的「正文产出 / 思考产出 / 耗时」。
 *
 * 🔴 为什么必须有 heavy 模式：一开始用「只回复两个字」去测，Qwen3.8-Flash-Next
 * 1.1 秒就回来了，看着完美；可换成线上真正那套提示词（要 3 个候选 + 完整
 * 解析 JSON）之后直接 60 秒超时。**拿极简提问去选模型会选错** —— 必须用
 * 真实提示词与真实输出规模去量。
 *
 * 判据：`reasonLen` 小且 `contentLen` 大、`ms` 在可接受范围内才是可用模型。
 */
export async function probeModels(cfg: AiConfig, opts: ProbeOptions): Promise<ModelProbeRow[]> {
  const one = async (model: string): Promise<ModelProbeRow> => {
    const t0 = Date.now();
    const row: ModelProbeRow = {
      model,
      heavy: opts.heavy,
      noThink: opts.noThink,
      status: 0,
      ms: 0,
      finish: "-",
      contentLen: -1,
      reasonLen: -1,
      head: "",
      verdict: "请求失败",
    };
    try {
      const body: Record<string, unknown> = opts.heavy
        ? {
            model,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt(opts.say, "classic", 3) },
            ],
            temperature: 0.95,
            max_tokens: 3200,
          }
        : {
            model,
            messages: [
              { role: "system", content: "你是中文助手，回答极简。" },
              { role: "user", content: opts.say },
            ],
            max_tokens: 1200,
            temperature: 0,
          };
      if (opts.jsonMode) body.response_format = { type: "json_object" };
      // 关思考：按服务商用对的写法（cfg.thinkingStyle），平台不认的字段一般会忽略
      if (opts.noThink) applyThinkingOff(body, cfg.thinkingStyle);

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
      let res: Response;
      try {
        res = await fetch(`${cfg.baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
          body: JSON.stringify(body),
          signal: ctrl.signal,
          cache: "no-store",
        });
      } finally {
        clearTimeout(timer);
      }

      row.status = res.status;
      const text = await res.text();
      let data: unknown = null;
      try {
        data = JSON.parse(text);
      } catch {
        // 非 JSON，下面按错误处理
      }

      const o = data as Record<string, unknown> | null;
      if (o && typeof o === "object" && !("choices" in o) && ("code" in o || "message" in o)) {
        row.error = `错误信封 code=${String(o.code)} ${String(o.message ?? "").slice(0, 80)}`;
      } else {
        const content = pickContent(data);
        const reasoning = pickReasoning(data);
        const ch0 = (o as { choices?: Array<Record<string, unknown>> })?.choices?.[0];
        row.finish = String(ch0?.finish_reason ?? "-");
        row.contentLen = content.length;
        row.reasonLen = reasoning.length;
        row.head = content.replace(/\s+/g, " ").slice(0, 60);
        row.verdict = content.trim() ? "ok" : reasoning.length ? "空正文（思考吃光额度）" : "无正文";
      }
    } catch (e) {
      const err = e as { name?: string; message?: string };
      row.error =
        err?.name === "AbortError"
          ? `超时（${Math.round(opts.timeoutMs / 1000)} 秒）`
          : (err?.message ?? "未知错误");
    }
    row.ms = Date.now() - t0;
    return row;
  };

  if (opts.parallel) return Promise.all(opts.models.map(one));

  const rows: ModelProbeRow[] = [];
  for (const model of opts.models) rows.push(await one(model));
  return rows;
}
