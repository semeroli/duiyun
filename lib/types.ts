/**
 * 对韵 · 全局类型契约
 * ------------------------------------------------------------------
 * 这份文件是「数据层」与「业务层」之间的唯一契约：
 *   - lib/data/*.ts  提供静态语料（名联库 / 对仗词表 / 典故 / 贴士 / 入声字表）
 *   - lib/*.ts       负责计算与编排
 *   - components/*   只消费这里定义的形状
 * 改动此文件必须同步改数据文件，否则 `npm run typecheck` 会直接报错。
 */

/* ── 对联类型（对应顶部三个标签） ────────────────────────────── */

export type CoupletKind = "classic" | "homophone" | "modern";

export const KIND_META: Record<CoupletKind, { label: string; hint: string }> = {
  classic: { label: "传统对联", hint: "平仄相谐、词性工对，讲究意境与出典" },
  homophone: { label: "趣味谐音", hint: "借音生趣，一字双关，读来会心一笑" },
  modern: { label: "现代金句", hint: "白话入联，短句有力，适合文案与朋友圈" },
};

/* ── 平仄 ───────────────────────────────────────────────────── */

/** ping = 平声（○）；ze = 仄声（●）；unknown = 未能判定（×，古体多音字等情况） */
export type Tone = "ping" | "ze" | "unknown";

export interface ToneChar {
  char: string;
  tone: Tone;
  /** 该字读音（带调号，便于教学展示） */
  pinyin: string;
  /**
   * 该字命中「入声字表」——中古属仄声。
   * 若其今音为平声，上面的 tone 已被改判为 "ze"（界面会标注「入」字角标）。
   */
  byRuSheng?: boolean;
}

export interface TonePair {
  upper: ToneChar | null;
  lower: ToneChar | null;
  /** null = 该位无法判定，不计入工整度分母 */
  ok: boolean | null;
}

export type ToneGrade = "工整" | "较工整" | "宽松" | "待推敲";

export interface ToneAnalysis {
  upperChars: ToneChar[];
  lowerChars: ToneChar[];
  /** 上联的 ○● 串 */
  upperMarks: string;
  /** 下联的 ○● 串 */
  lowerMarks: string;
  pairs: TonePair[];
  /** 相反对（位）数 */
  matched: number;
  /** 可判定的总位数 */
  total: number;
  /** 0~1 */
  ratio: number;
  grade: ToneGrade;
  summary: string;
  /** 上下联字数是否一致 */
  lengthEqual: boolean;
}

/* ── 词性对仗 ───────────────────────────────────────────────── */

export interface PosPair {
  upperWord: string;
  upperPos: string;
  lowerWord: string;
  lowerPos: string;
  ok: boolean;
}

export interface PosAnalysis {
  upperWords: { word: string; pos: string }[];
  lowerWords: { word: string; pos: string }[];
  pairs: PosPair[];
  matched: number;
  total: number;
  ratio: number;
  grade: ToneGrade;
  summary: string;
}

/* ── 意境呼应 ───────────────────────────────────────────────── */

export type Harmony = "呼应" | "相衬" | "反差" | "待打磨";

export interface ConceptionAnalysis {
  /** 整体说明（AI 优先，降级为本地模板文案） */
  summary: string;
  /** 上下联各自的意象词 */
  upperImages: string[];
  lowerImages: string[];
  /** 共同意象（若有） */
  sharedImages: string[];
  harmony: Harmony;
}

/* ── 典故出处 ───────────────────────────────────────────────── */

export interface AllusionAnalysis {
  has: boolean;
  title?: string;
  /** 出典，如《世说新语·言语》 */
  source?: string;
  /** 白话释义 */
  explain?: string;
  /** 原文引句 */
  quote?: string;
}

/* ── 聚合 ───────────────────────────────────────────────────── */

export interface CoupletAnalysis {
  tone: ToneAnalysis;
  pos: PosAnalysis;
  conception: ConceptionAnalysis;
  allusion: AllusionAnalysis;
}

/**
 * 候选的来源：
 *   ai    —— 大模型生成
 *   local —— 本地名联库直接命中（库里真实收录的现成对联）
 *   jiju  —— 集句：取本地库里的真实句子，按平仄 + 词性挑出的对句
 */
export type CoupletSource = "ai" | "local" | "jiju";

export const SOURCE_META: Record<CoupletSource, { label: string; tone: "red" | "info" | "warn" }> = {
  ai: { label: "AI 生成", tone: "red" },
  local: { label: "内置语料", tone: "info" },
  jiju: { label: "集句", tone: "warn" },
};

/** 界面上统一取来源文案，避免各处各写一套三元表达式 */
export function sourceLabel(s: CoupletSource | undefined): string {
  return s ? SOURCE_META[s]?.label ?? "内置语料" : "内置语料";
}

export interface CoupletCandidate {
  id: string;
  upper: string;
  lower: string;
  kind: CoupletKind;
  source: CoupletSource;
  analysis: CoupletAnalysis;
  /** 生成方的补充说明（AI 那句话 / 本地引擎的出处提示） */
  note?: string;
  /** 谐音类的「谐音点」说明 */
  homophone?: string;
  /** 机关对的「机关」说明（拆字 / 组字 / 同旁 / 回文等） */
  device?: string;
}

export interface GenerateResponse {
  ok: boolean;
  /** ok=false 时给出可直接展示给用户的中文原因 */
  error?: string;
  /** 实际使用的引擎 */
  engine: "ai" | "local";
  /** 降级原因（engine=local 且有 key 时说明为何没走 AI） */
  fallbackReason?: string;
  candidates: CoupletCandidate[];
  /** 服务端毫秒耗时，便于诊断 */
  elapsedMs?: number;
}

/* ── 静态数据契约（lib/data/*） ─────────────────────────────── */

export interface LexiconEntry {
  /** 词条本身（1~3 字） */
  word: string;
  /** 词性：名词 / 动词 / 形容词 / 数量词 / 副词 / 方位词 / 颜色词 / 虚词 */
  pos: string;
  /** 语义类目：天文 / 地理 / 时令 / 动植物 / 人事 / 器物 / 情感 / 颜色 / 数字 / 方位 … */
  category: string;
  /** 可与之对仗的词（越靠前越推荐，平仄相反者优先） */
  opposites: string[];
}

export interface LibraryAllusion {
  title: string;
  source: string;
  explain: string;
  quote?: string;
}

export interface LibraryCouplet {
  upper: string;
  lower: string;
  kind: CoupletKind;
  /** 作者或出处 */
  author?: string;
  /** 典故出处 */
  allusion?: LibraryAllusion;
  /** 意境呼应说明 */
  conception?: string;
  /** 谐音类专用：谐音点说明 */
  homophone?: string;
  /**
   * 联中的「文字机关」说明 —— 拆字（析字）、组字、同旁、叠字、回文等。
   * 机关对只对上平仄词性是不够的，必须用同一种机关去对，
   * 所以这份说明是教与学里最要紧的一句，界面会单独以「机关」展示。
   */
  device?: string;
}

export interface AllusionEntry {
  title: string;
  /** 命中关键词（出现在上联/下联中即认为是同一个典） */
  keywords: string[];
  source: string;
  explain: string;
  quote?: string;
}

export type TipCategory = "平仄" | "对仗" | "意境" | "避忌" | "入门";

export interface TipItem {
  id: string;
  title: string;
  body: string;
  category: TipCategory;
}
