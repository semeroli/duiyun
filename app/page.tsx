"use client";

/**
 * 对韵 · 主页
 * ------------------------------------------------------------------
 * 状态编排都收在这一层，子组件只负责渲染与回调：
 *   kind        当前类型（传统 / 谐音 / 金句）
 *   upper       上联
 *   candidates  候选下联（AI 或本地引擎产出，统一结构）
 *   activeIdx   当前正在看第几个候选
 *   settings    主题 / 音效 / 学习模式（持久化在浏览器）
 *   favorites   收藏（持久化在浏览器）
 *
 * 一条重要的容错线：**服务端接口不可用时，直接在浏览器里用内置语料生成**。
 * 这样即使把这个页面丢进一个纯静态托管、或断网演示，功能依然成立。
 */

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import AnalysisPanels from "@/components/AnalysisPanels";
import CardStudio from "@/components/CardStudio";
import FavoritesDrawer from "@/components/FavoritesDrawer";
import LandscapeBg from "@/components/LandscapeBg";
import LearningSidebar from "@/components/LearningSidebar";
import LowerOutput from "@/components/LowerOutput";
import NavBar from "@/components/NavBar";
import Seal from "@/components/Seal";
import TipsDrawer from "@/components/TipsDrawer";
import UpperInput from "@/components/UpperInput";
import { Badge, Btn } from "@/components/ui";
import { onlyHanzi } from "@/lib/hanzi";
import { playSound } from "@/lib/sound";
import {
  DEFAULT_SETTINGS,
  loadFavorites,
  loadSettings,
  saveFavorites,
  saveSettings,
  type FavoriteItem,
  type Settings,
} from "@/lib/storage";
import type { CoupletCandidate, CoupletKind, GenerateResponse } from "@/lib/types";

interface EngineInfo {
  engine: "ai" | "local";
  configured: boolean;
  model: string | null;
  fallbackReason?: string;
}

export default function Home() {
  const [kind, setKind] = useState<CoupletKind>("classic");
  const [upper, setUpper] = useState("");
  const [candidates, setCandidates] = useState<CoupletCandidate[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [engine, setEngine] = useState<EngineInfo | null>(null);
  const [config, setConfig] = useState<{ configured: boolean; model: string | null } | null>(null);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  const [tipsOpen, setTipsOpen] = useState(false);
  const [favOpen, setFavOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [toast, setToast] = useState("");

  const seedRef = useRef(0);
  const S = settings ?? DEFAULT_SETTINGS;

  /* ── 初始化：读本地设置与收藏 ─────────────────────────── */
  useEffect(() => {
    setSettings(loadSettings());
    setFavorites(loadFavorites());
  }, []);

  /* ── 设置变更：写回本地 + 切换主题属性 ─────────────────── */
  useEffect(() => {
    if (!settings) return;
    document.documentElement.setAttribute("data-theme", settings.theme);
    saveSettings(settings);
  }, [settings]);

  /* ── 探一次服务端，确认是 AI 还是本地引擎 ─────────────── */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/generate", { cache: "no-store" });
        const ct = res.headers.get("content-type") ?? "";
        if (!ct.includes("application/json")) throw new Error("no api");
        const json = await res.json();
        if (alive) {
          setConfig({ configured: !!json.configured, model: json.model ?? null });
          setEngine({
            engine: json.configured ? "ai" : "local",
            configured: !!json.configured,
            model: json.model ?? null,
          });
        }
      } catch {
        if (alive) {
          setConfig({ configured: false, model: null });
          setEngine({
            engine: "local",
            configured: false,
            model: null,
            fallbackReason: "未检测到服务端接口，全部在浏览器内用内置语料 + 集句完成。",
          });
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* ── 生成 ─────────────────────────────────────────────── */
  const doGenerate = useCallback(
    async (refresh: boolean) => {
      const u = onlyHanzi(upper);
      if (u.length < 2) {
        setError("上联至少需要 2 个字");
        return;
      }
      setLoading(true);
      setError("");
      if (refresh) seedRef.current += 1;
      else seedRef.current = 0;

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ upper: u, kind, count: 3, seed: seedRef.current }),
          cache: "no-store",
        });
        const ct = res.headers.get("content-type") ?? "";
        // SPA 兜底会把 404 伪装成 200 + HTML，所以必须校验内容类型
        if (!ct.includes("application/json")) throw new Error("接口不可用");
        const data = (await res.json()) as GenerateResponse;
        if (!data.ok || !data.candidates?.length) {
          throw new Error(data.error || "未能对出下联");
        }
        setCandidates(data.candidates);
        setActiveIdx(0);
        setEngine({
          engine: data.engine,
          configured: data.engine === "ai",
          model: config?.model ?? null,
          fallbackReason: data.fallbackReason,
        });
        playSound("drop", S.sound);
      } catch (e) {
        // 兜底：浏览器内生成。语料与拼音库体量不小，
        // 所以这里用动态 import 拆包，首屏不加载它们。
        try {
          const { generateLocal } = await import("@/lib/localEngine");
          const local = generateLocal(u, kind, 3, seedRef.current);
          if (local.length) {
            setCandidates(local);
            setActiveIdx(0);
            setEngine({
              engine: "local",
              configured: false,
              model: null,
              fallbackReason: "服务端未响应，已在浏览器内用内置语料 + 集句生成。",
            });
            playSound("drop", S.sound);
            return;
          }
        } catch {
          /* 连本地引擎都起不来，落到下面的报错 */
        }
        setError(e instanceof Error ? e.message : "生成失败，请换个上联试试");
      } finally {
        setLoading(false);
      }
    },
    [upper, kind, config?.model, S.sound]
  );

  const activeCandidate = candidates[activeIdx] ?? null;
  const analysis = activeCandidate?.analysis ?? null;

  /* ── 收藏 ─────────────────────────────────────────────── */
  const favIds = useMemo(() => new Set(favorites.map((f) => f.id)), [favorites]);
  const isFav = activeCandidate ? favIds.has(activeCandidate.id) : false;

  const toggleFav = useCallback(() => {
    if (!activeCandidate) return;
    const exists = favorites.some((f) => f.id === activeCandidate.id);
    const next = exists
      ? favorites.filter((f) => f.id !== activeCandidate.id)
      : [
          {
            id: activeCandidate.id,
            upper: activeCandidate.upper,
            lower: activeCandidate.lower,
            kind: activeCandidate.kind,
            note: activeCandidate.note,
            homophone: activeCandidate.homophone,
            conception: activeCandidate.analysis.conception.summary,
            allusion: activeCandidate.analysis.allusion.has
              ? activeCandidate.analysis.allusion
              : undefined,
            source: activeCandidate.source,
            at: Date.now(),
          },
          ...favorites,
        ];
    setFavorites(next);
    saveFavorites(next);
    playSound(exists ? "tap" : "seal", S.sound);
    setToast(exists ? "已取消收藏" : "已收藏，可在右上角「收藏」里找到");
  }, [activeCandidate, favorites, S.sound]);

  const loadFavorite = useCallback(async (f: FavoriteItem) => {
    setUpper(f.upper);
    setKind(f.kind);
    seedRef.current = 0;
    // 平仄与词性当场重算（不存旧结果，算法升级后收藏也是新的）
    const { buildAnalysis } = await import("@/lib/analyze");
    setCandidates([
      {
        id: f.id,
        upper: f.upper,
        lower: f.lower,
        kind: f.kind,
        source: f.source ?? "local",
        analysis: buildAnalysis(f.upper, f.lower, {
          conception: f.conception,
          allusion: f.allusion,
        }),
        note: f.note,
        homophone: f.homophone,
      },
    ]);
    setActiveIdx(0);
    setFavOpen(false);
    setError("");
    setToast("已载入这一副");
  }, []);

  const removeFavorite = useCallback(
    (id: string) => {
      const next = favorites.filter((f) => f.id !== id);
      setFavorites(next);
      saveFavorites(next);
    },
    [favorites]
  );

  const clearFavorites = useCallback(() => {
    setFavorites([]);
    saveFavorites([]);
    setToast("已清空收藏");
  }, []);

  /* ── 轻提示 ───────────────────────────────────────────── */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = useCallback((msg: string) => setToast(msg), []);

  return (
    <div className="relative min-h-[100dvh]">
      <LandscapeBg theme={S.theme} />

      <div className="relative z-10">
        <NavBar
          kind={kind}
          onKindChange={(k) => {
            setKind(k);
            playSound("tap", S.sound);
          }}
          favCount={favorites.length}
          onOpenFavorites={() => setFavOpen(true)}
          learning={S.learning}
          onToggleLearning={() => setSettings({ ...S, learning: !S.learning })}
          theme={S.theme}
          onThemeChange={(t) => setSettings({ ...S, theme: t })}
          sound={S.sound}
          onSoundChange={(v) => setSettings({ ...S, sound: v })}
        />

        <div
          className={`mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-24 pt-7 md:px-6 ${
            S.learning ? "xl:flex-row xl:items-start" : ""
          }`}
        >
          {/* 卷轴自上而下缓缓展开 */}
          <motion.div
            initial={{ clipPath: "inset(0px 0px 100% 0px)", opacity: 0.4 }}
            animate={{ clipPath: "inset(0px 0px -40px 0px)", opacity: 1 }}
            transition={{ duration: 1.05, ease: [0.22, 0.8, 0.3, 1] }}
            className="min-w-0 flex-1 space-y-5"
          >
            {/* ── 题首 ── */}
            <section className="pt-1 text-center">
              <div className="mb-3 flex items-center justify-center gap-3">
                <span className="h-[1px] w-10 bg-lineStrong" />
                <span className="font-song text-[11px] tracking-[.5em] text-inkFaint">对韵</span>
                <span className="h-[1px] w-10 bg-lineStrong" />
              </div>
              <h1 className="font-song text-[28px] leading-tight tracking-[.1em] text-ink md:text-[42px]">
                一字一句，皆可成对
              </h1>
              <p className="mx-auto mt-3.5 max-w-2xl text-[13px] leading-[1.9] text-inkSoft md:text-[14px]">
                写下上联，为你对出下联，并从
                <span className="mx-0.5 text-cinnabar">平仄</span>、
                <span className="mx-0.5 text-cinnabar">词性</span>、
                <span className="mx-0.5 text-cinnabar">意境</span>、
                <span className="mx-0.5 text-cinnabar">典故</span>
                四个维度逐层拆解。既是创作工具，也是讲对联的教具。
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {config === null ? (
                  <Badge tone="neutral">正在检测引擎…</Badge>
                ) : config.configured ? (
                  <Badge tone="good">AI 已接通{config.model ? ` · ${config.model}` : ""}</Badge>
                ) : (
                  <Badge tone="info">未配置 AI Key · 内置语料 + 集句</Badge>
                )}
                {engine?.fallbackReason && (
                  <Badge tone="warn">{engine.fallbackReason}</Badge>
                )}
              </div>
            </section>

            {/* ── 输入 ── */}
            <UpperInput
              value={upper}
              onChange={setUpper}
              onGenerate={() => void doGenerate(false)}
              onClear={() => {
                setUpper("");
                setCandidates([]);
                setError("");
                seedRef.current = 0;
              }}
              loading={loading}
            />

            {/* 引下箭头 */}
            <div className="flex justify-center">
              <motion.div
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                className="font-song text-lg text-inkFaint"
                aria-hidden
              >
                ↓
              </motion.div>
            </div>

            {/* ── 错误 ── */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="rounded-md border border-cinnabar/40 bg-accentSoft px-4 py-3 text-[13px] leading-relaxed text-cinnabar"
                  role="alert"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── 输出 ── */}
            <LowerOutput
              candidate={activeCandidate}
              loading={loading}
              onRefresh={() => void doGenerate(true)}
              onToggleFav={toggleFav}
              isFav={isFav}
              onOpenCard={() => {
                setCardOpen(true);
                playSound("seal", S.sound);
              }}
            />

            {/* 多候选切换 */}
            {candidates.length > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-song text-[11px] tracking-[.2em] text-inkFaint">
                  候选 {activeIdx + 1}/{candidates.length}
                </span>
                {candidates.map((c, i) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setActiveIdx(i);
                      playSound("tap", S.sound);
                    }}
                    title={c.lower}
                    className={`h-7 min-w-7 rounded-md border px-2 font-song text-[12px] transition-colors ${
                      i === activeIdx
                        ? "border-cinnabar/50 bg-accentSoft text-cinnabar"
                        : "border-line text-inkFaint hover:border-lineStrong hover:text-ink"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <span className="text-[11px] text-inkFaint">换一个只是切换，点「换一换」才是重新生成</span>
              </div>
            )}

            {/* ── 四维解析 ── */}
            <section className="space-y-2.5 pt-1">
              <div className="flex items-baseline justify-between">
                <h2 className="font-song text-[15px] tracking-[.28em] text-ink">多维解析</h2>
                <span className="text-[11px] text-inkFaint">平仄 / 词性 / 意境 / 典故</span>
              </div>
              <AnalysisPanels analysis={analysis} />
            </section>

            {/* ── 底部操作 ── */}
            <section className="flex flex-wrap items-center gap-2.5 pt-2">
              <Btn
                variant="seal"
                size="lg"
                onClick={() => {
                  setCardOpen(true);
                  playSound("seal", S.sound);
                }}
                disabled={!activeCandidate}
              >
                📜 生成卡片分享
              </Btn>
              <Btn variant="outline" size="lg" onClick={() => setTipsOpen(true)}>
                📖 对联知识小贴士
              </Btn>
              <div className="ml-auto hidden items-center gap-2 text-[11px] text-inkFaint md:flex">
                <span>收藏 {favorites.length} 副</span>
                <Seal text="对韵" size={30} animate={false} rotate={-8} />
              </div>
            </section>

            {/* ── AI 配置说明（面向老师，默认折叠） ── */}
            <details className="no-print rounded-md border border-line bg-panelSolid/50 px-4 py-3 text-[12px] leading-relaxed text-inkFaint">
              <summary className="cursor-pointer font-song text-[12px] tracking-wider text-inkSoft">
                候选后面的「内置语料 / 集句 / AI 生成」怎么区分？怎么接入自己的 AI
              </summary>
              <div className="mt-2.5 space-y-2">
                <p>
                  <span className="text-inkSoft">三种来源，含金量依次下降，界面都标在候选右上角：</span>
                  <br />
                  <span className="text-inkSoft">① 内置语料</span>
                  —— 你这句正好在名联库里，下联是<b>原配</b>，最可靠；
                  <br />
                  <span className="text-inkSoft">② 集句</span>
                  —— 库里没这句，就从库中真实句子里挑一句
                  <b>平仄相对、词性相合</b>的当对句。集句是对联的正规玩法（取古人成句成对），
                  句子本身一定通顺、有出处，但<b>语义未必与你这句呼应</b>，适合当格律范本；
                  <br />
                  <span className="text-inkSoft">③ AI 生成</span> —— 配了 Key 才有，最贴题。
                </p>
                <p>
                  本项目支持任何「OpenAI 兼容」的模型接口。在项目根目录新建
                  <code className="mx-1 rounded bg-accentSoft px-1.5 py-[1px] font-mono text-[11px] text-cinnabar">
                    .env.local
                  </code>
                  ，填三行即可（改完要重启服务）：
                </p>
                <pre className="overflow-x-auto rounded border border-line bg-panelSolid px-3 py-2 font-mono text-[11px] leading-relaxed text-inkSoft">
{`AI_BASE_URL=https://api.deepseek.com/v1
AI_API_KEY=你的密钥
AI_MODEL=deepseek-chat`}
                </pre>
                <p>
                  不填也能用：会自动走内置的 89 副名联（178 句句库）与 1555 条对仗词表，平仄与词性解析照常计算 ——
                  因为<span className="mx-0.5 text-cinnabar">平仄永远由本地算法判定</span>，不依赖模型。
                </p>
              </div>
            </details>

            <footer className="flex flex-col items-center gap-2 pt-6 text-center">
              <div className="flex items-center gap-3">
                <span className="h-[1px] w-8 bg-line" />
                <Seal text="对韵" size={42} animate={false} rotate={-9} />
                <span className="h-[1px] w-8 bg-line" />
              </div>
              <p className="text-[11px] leading-relaxed text-inkFaint">
                对韵 · 智能对联生成器 ｜ 平仄依古韵（含入声字修正），词性依常用对仗词表
              </p>
            </footer>
          </motion.div>

          {/* ── 学习模式侧栏（桌面固定，移动端落到正文下） ── */}
          {S.learning && (
            <aside className="mt-2 w-full shrink-0 xl:mt-0 xl:w-[312px]">
              <div className="xl:sticky xl:top-24">
                <LearningSidebar />
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* ── 浮层 ── */}
      <CardStudio
        open={cardOpen}
        onClose={() => setCardOpen(false)}
        candidate={activeCandidate}
        onShowToast={showToast}
      />
      <TipsDrawer open={tipsOpen} onClose={() => setTipsOpen(false)} />
      <FavoritesDrawer
        open={favOpen}
        onClose={() => setFavOpen(false)}
        favorites={favorites}
        onLoad={loadFavorite}
        onRemove={removeFavorite}
        onClear={clearFavorites}
      />

      {/* ── 轻提示 ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.24 }}
            className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-full border border-line bg-panelSolid px-4 py-2 text-[13px] text-ink shadow-lift"
            role="status"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
