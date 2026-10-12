/**
 * 音效：用 Web Audio 现场合成「棋子落盘」质感
 * ------------------------------------------------------------------
 * 刻意不引入任何音频文件 —— 一是不增加体积，二是合成音在
 * 手机/电脑上表现一致，也不会因为资源 404 而静默失败。
 * 默认静音，用户主动打开才响。
 */

export type SoundKind = "drop" | "seal" | "tap";

let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noiseBurst(ac: AudioContext, at: number, duration: number, centre: number, peak: number) {
  const len = Math.max(1, Math.floor(ac.sampleRate * duration));
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / len;
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 6);
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;

  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = centre;
  bp.Q.value = 1.1;

  const gain = ac.createGain();
  gain.gain.setValueAtTime(peak, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  src.connect(bp);
  bp.connect(gain);
  gain.connect(ac.destination);
  src.start(at);
}

function woodTone(ac: AudioContext, at: number, from: number, to: number, duration: number, peak: number) {
  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(to, at + duration * 0.8);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(peak, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

export function playSound(kind: SoundKind, enabled: boolean): void {
  if (!enabled) return;
  const ac = ensureCtx();
  if (!ac) return;
  const at = ac.currentTime + 0.005;
  try {
    if (kind === "seal") {
      // 印章落纸：更低、更闷、更重
      noiseBurst(ac, at, 0.09, 850, 0.26);
      woodTone(ac, at, 420, 170, 0.18, 0.14);
      woodTone(ac, at + 0.035, 260, 130, 0.14, 0.09);
      return;
    }
    if (kind === "tap") {
      // 轻触：干脆的一声
      noiseBurst(ac, at, 0.05, 2100, 0.1);
      woodTone(ac, at, 900, 520, 0.09, 0.07);
      return;
    }
    // drop：棋子落盘
    noiseBurst(ac, at, 0.075, 1750, 0.15);
    woodTone(ac, at, 820, 430, 0.12, 0.11);
  } catch {
    /* 播放失败无所谓，不打断主流程 */
  }
}
