"use client";

/**
 * 卡片工坊：一键生成精美分享卡片
 * ------------------------------------------------------------------
 * 用 html-to-image 把一块**离屏的真实 DOM**（不是 canvas 重绘）导出成 PNG，
 * 好处是所有字体、纹理、印章动画后的最终样式所见即所得。
 *
 * 关键工程点：
 *   - 卡片节点本身保持「原始像素尺寸」（1080×1080 等），预览只是外层 scale，
 *     html-to-image 读的是节点自身尺寸，不受父级 transform 影响；
 *   - 颜色全部用 CSS 变量，导出时 html-to-image 会把它解析成真实颜色值，
 *     所以切主题后导出的卡片会跟着变色；
 *   - 第一次导出若因跨域字体失败，自动改用 skipFonts 再试一次。
 */

import { toPng } from "html-to-image";
import { useEffect, useMemo, useRef, useState } from "react";
import { CARD_RATIOS } from "@/lib/themes";
import { KIND_META, type CoupletCandidate } from "@/lib/types";
import Seal from "./Seal";
import { Badge, Btn, Modal } from "./ui";

const NOISE =
  'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'180\' height=\'180\'%3E%3Cfilter id=\'f\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'180\' height=\'180\' filter=\'url(%23f)\' opacity=\'0.5\'/%3E%3C/svg%3E")';

const SONG = '"Noto Serif SC", "Songti SC", SimSun, serif';
const KAI = '"LXGW WenKai", KaiTi, STKaiti, serif';

export default function CardStudio({
  open,
  onClose,
  candidate,
  onShowToast,
}: {
  open: boolean;
  onClose: () => void;
  candidate: CoupletCandidate | null;
  onShowToast?: (msg: string) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [ratioId, setRatioId] = useState(CARD_RATIOS[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previewW, setPreviewW] = useState(340);

  const ratio = useMemo(
    () => CARD_RATIOS.find((r) => r.id === ratioId) ?? CARD_RATIOS[0],
    [ratioId]
  );

  useEffect(() => {
    if (!open) return;
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setPreviewW(el.clientWidth || 340);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const scale = Math.min(1, previewW / ratio.width, 460 / ratio.height);

  const metrics = useMemo(() => {
    const n = Math.max(candidate?.upper.length ?? 0, candidate?.lower.length ?? 0, 1);
    const padT = ratio.height * 0.17;
    const padB = ratio.height * 0.2;
    const availH = ratio.height - padT - padB;
    const ls = 0.16;
    const fs = Math.max(22, Math.min(availH / (n * (1 + ls) * 1.06), ratio.width * 0.17));
    return { padT, availH, fs, ls };
  }, [candidate, ratio]);

  async function handleDownload() {
    const node = cardRef.current;
    if (!node || !candidate) return;
    setBusy(true);
    setError("");
    try {
      let dataUrl = "";
      try {
        dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true });
      } catch {
        // 跨域字体拉取失败时的兜底：跳过字体内嵌
        dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true, skipFonts: true });
      }
      if (!dataUrl || !dataUrl.startsWith("data:image")) {
        throw new Error("导出结果不是图片数据");
      }
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `对韵-${candidate.upper}-${candidate.lower}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      onShowToast?.("卡片已保存到「下载」文件夹");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "未知错误";
      setError(`导出失败：${msg}。可先截屏保存，或换一张比例再试。`);
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!candidate) return;
    const text = `${candidate.upper}\n${candidate.lower}\n\n—— 对韵 · 智能对联生成器`;
    try {
      await navigator.clipboard.writeText(text);
      onShowToast?.("已复制对联文字");
    } catch {
      onShowToast?.("浏览器不允许自动复制，请手动选中复制");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="生成分享卡片"
      subtitle="上联在右、下联在左，符合传统张贴顺序"
      maxWidthClass="max-w-5xl"
    >
      {!candidate ? (
        <div className="px-6 py-16 text-center text-inkFaint">先对出一副下联，再来做卡片。</div>
      ) : (
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* 预览 */}
          <div>
            <div ref={wrapRef} className="mx-auto w-full max-w-[460px]">
              <div
                className="mx-auto overflow-hidden rounded-md shadow-lift"
                style={{ width: ratio.width * scale, height: ratio.height * scale }}
              >
                <div
                  style={{
                    width: ratio.width,
                    height: ratio.height,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                  }}
                >
                  {/* ── 真正被导出的节点 ── */}
                  <div
                    ref={cardRef}
                    style={{ width: ratio.width, height: ratio.height, position: "relative", overflow: "hidden" }}
                  >
                    <div style={{ position: "absolute", inset: 0, backgroundColor: "var(--bg)" }} />
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        opacity: 0.5,
                        backgroundImage: NOISE,
                        backgroundSize: "180px 180px",
                      }}
                    />
                    {/* 淡墨远山 */}
                    <svg
                      viewBox="0 0 1440 300"
                      preserveAspectRatio="none"
                      style={{ position: "absolute", left: 0, bottom: 0, width: "100%", height: ratio.height * 0.22 }}
                    >
                      <path
                        d="M0 200 C 200 150 320 212 480 180 C 640 148 760 212 940 180 C 1120 148 1280 206 1440 176 L1440 300 L0 300 Z"
                        fill="var(--ink)"
                        opacity="0.07"
                      />
                      <path
                        d="M0 252 C 240 220 420 260 640 236 C 860 212 1080 260 1440 232 L1440 300 L0 300 Z"
                        fill="var(--ink)"
                        opacity="0.11"
                      />
                    </svg>

                    {/* 双线描边 */}
                    <div
                      style={{
                        position: "absolute",
                        inset: ratio.width * 0.028,
                        border: "1px solid var(--line-strong)",
                        borderRadius: 4,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        inset: ratio.width * 0.038,
                        border: "1px solid var(--line)",
                      }}
                    />

                    {/* 顶部类型标签 */}
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: ratio.height * 0.068,
                        display: "flex",
                        justifyContent: "center",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: SONG,
                          fontSize: metrics.fs * 0.26,
                          letterSpacing: "0.42em",
                          color: "var(--ink-faint)",
                        }}
                      >
                        {KIND_META[candidate.kind].label}
                      </span>
                    </div>

                    {/* 竖排对联：row-reverse 让上联落在右侧 */}
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: metrics.padT,
                        height: metrics.availH,
                        display: "flex",
                        flexDirection: "row-reverse",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: ratio.width * 0.075,
                      }}
                    >
                      <span
                        style={{
                          writingMode: "vertical-rl",
                          fontFamily: SONG,
                          fontSize: metrics.fs,
                          lineHeight: 1,
                          letterSpacing: `${metrics.ls}em`,
                          color: "var(--ink)",
                        }}
                      >
                        {candidate.upper}
                      </span>
                      <span
                        style={{
                          writingMode: "vertical-rl",
                          fontFamily: SONG,
                          fontSize: metrics.fs,
                          lineHeight: 1,
                          letterSpacing: `${metrics.ls}em`,
                          color: "var(--ink)",
                        }}
                      >
                        {candidate.lower}
                      </span>
                    </div>

                    {/* 落款 */}
                    <div
                      style={{
                        position: "absolute",
                        right: ratio.width * 0.1,
                        bottom: ratio.height * 0.08,
                        display: "flex",
                      }}
                    >
                      <span
                        style={{
                          writingMode: "vertical-rl",
                          fontFamily: KAI,
                          fontSize: metrics.fs * 0.22,
                          letterSpacing: "0.22em",
                          color: "var(--ink-faint)",
                        }}
                      >
                        对韵 · 智能对联生成器
                      </span>
                    </div>

                    {/* 印章 */}
                    <div
                      style={{
                        position: "absolute",
                        left: ratio.width * 0.088,
                        bottom: ratio.height * 0.072,
                      }}
                    >
                      <Seal text="对韵" size={Math.round(ratio.width * 0.075)} animate={false} rotate={-8} />
                    </div>
                  </div>
                  {/* ── 导出节点结束 ── */}
                </div>
              </div>
            </div>
          </div>

          {/* 控制面板 */}
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="font-song text-xs tracking-[.2em] text-inkFaint">出图比例</span>
                <Badge tone="info">{ratio.width}×{ratio.height}</Badge>
              </div>
              <div className="space-y-1.5">
                {CARD_RATIOS.map((r) => {
                  const active = r.id === ratioId;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRatioId(r.id)}
                      className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                        active
                          ? "border-cinnabar/50 bg-accentSoft"
                          : "border-line hover:border-lineStrong hover:bg-accentSoft/60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-song text-sm text-ink">{r.label}</span>
                        {active && <span className="text-[11px] text-cinnabar">使用中</span>}
                      </div>
                      <div className="mt-0.5 text-[11px] text-inkFaint">{r.hint}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="divider-brush" />

            <div className="space-y-2">
              <Btn variant="primary" size="lg" className="w-full" onClick={handleDownload} disabled={busy}>
                {busy ? "落印中…" : "下载 PNG（2 倍图）"}
              </Btn>
              <Btn variant="outline" className="w-full" onClick={handleCopy}>
                复制对联文字
              </Btn>
            </div>

            {error && (
              <p className="rounded-md border border-cinnabar/40 bg-accentSoft px-3 py-2 text-[12px] leading-relaxed text-cinnabar">
                {error}
              </p>
            )}

            <div className="rounded-md border border-line bg-panelSolid/50 px-3 py-2.5 text-[11px] leading-relaxed text-inkFaint">
              <p className="mb-1 font-song text-[12px] tracking-wider text-inkSoft">小贴士</p>
              导出的卡片会跟随当前主题（素雅 / 春节 / 夜读）变色。春节写春联时，先切到「春节喜庆」再导出。
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
