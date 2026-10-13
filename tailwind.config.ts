import type { Config } from "tailwindcss";

/**
 * 颜色全部走 CSS 变量（见 app/globals.css），
 * 因此「素雅 / 春节 / 夜读」三套主题只需切换 <html data-theme>，组件零改动。
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        app: "var(--bg)",
        app2: "var(--bg-2)",
        panel: "var(--panel)",
        panelSolid: "var(--panel-solid)",
        ink: "var(--ink)",
        inkSoft: "var(--ink-soft)",
        inkFaint: "var(--ink-faint)",
        cinnabar: "var(--cinnabar)",
        stoneblue: "var(--stoneblue)",
        gold: "var(--gold)",
        line: "var(--line)",
        lineStrong: "var(--line-strong)",
        accentSoft: "var(--accent-soft)",
        // 派生色：专用于「当文字 / 当必要边界」（报告 §2.5）
        goldInk: "var(--gold-ink)",
        cinnabarInk: "var(--cinnabar-ink)",
        lineInput: "var(--line-input)",
        okInk: "var(--ok-ink)",
        warnInk: "var(--warn-ink)",
      },
      fontFamily: {
        song: [
          '"Noto Serif SC"',
          '"Source Han Serif SC"',
          '"Songti SC"',
          '"STSong"',
          "SimSun",
          "serif",
        ],
        kai: [
          '"LXGW WenKai"',
          "KaiTi",
          "STKaiti",
          '"Kaiti SC"',
          '"楷体"',
          "serif",
        ],
      },
      boxShadow: {
        paper: "0 1px 0 rgba(255,255,255,.7) inset, 0 10px 34px -18px rgba(var(--shadow-rgb),.5)",
        lift: "0 18px 46px -20px rgba(var(--shadow-rgb),.55)",
        seal: "0 6px 20px -8px rgba(var(--shadow-rgb),.5)",
      },
      keyframes: {
        drift: {
          "0%": { transform: "translate3d(-3%,0,0)" },
          "50%": { transform: "translate3d(3%,-1.2%,0)" },
          "100%": { transform: "translate3d(-3%,0,0)" },
        },
        "ink-spread": {
          "0%": { opacity: "0", filter: "blur(6px)", transform: "scale(1.06)" },
          "100%": { opacity: "1", filter: "blur(0)", transform: "scale(1)" },
        },
        "seal-press": {
          "0%": { opacity: "0", transform: "scale(1.5) rotate(-18deg)" },
          "60%": { opacity: "1", transform: "scale(.94) rotate(-8deg)" },
          "100%": { opacity: "1", transform: "scale(1) rotate(-10deg)" },
        },
        "grind": {
          "0%": { transform: "translateX(-14px) rotate(-24deg)" },
          "50%": { transform: "translateX(14px) rotate(24deg)" },
          "100%": { transform: "translateX(-14px) rotate(-24deg)" },
        },
        "ink-drop": {
          "0%": { opacity: "0", transform: "translateY(-10px) scaleY(.6)" },
          "35%": { opacity: "1" },
          "100%": { opacity: "0", transform: "translateY(22px) scaleY(1.3)" },
        },
      },
      animation: {
        drift: "drift 46s ease-in-out infinite",
        "drift-slow": "drift 72s ease-in-out infinite",
        "ink-spread": "ink-spread .5s ease-out both",
        "seal-press": "seal-press .55s cubic-bezier(.2,1.5,.4,1) both",
        grind: "grind 1.5s ease-in-out infinite",
        "ink-drop": "ink-drop 1.5s ease-in infinite",
      },
    },
  },
  plugins: [],
};

export default config;
