"use client";

/**
 * 背景：淡墨远山 + 缓慢漂移的云雾 + 灯笼点缀
 * 固定在最底层，极低速动画，明确不干扰阅读。
 */

import type { ThemeId } from "@/lib/themes";

export default function LandscapeBg({ theme }: { theme: ThemeId }) {
  const spring = theme === "spring";

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* 云雾 —— 两层不同速度，制造纵深 */}
      <div
        className="absolute inset-x-[-25%] top-[6%] h-[36vh] animate-drift-slow"
        style={{
          opacity: theme === "night" ? 0.55 : 0.7,
          filter: "blur(22px)",
          background:
            "radial-gradient(46% 58% at 28% 52%, var(--accent-soft), transparent 68%), radial-gradient(38% 50% at 72% 38%, rgba(74,107,138,.12), transparent 70%)",
        }}
      />
      <div
        className="absolute inset-x-[-30%] top-[40%] h-[32vh] animate-drift"
        style={{
          opacity: theme === "night" ? 0.4 : 0.5,
          filter: "blur(28px)",
          background:
            "radial-gradient(40% 55% at 62% 45%, rgba(176,138,62,.10), transparent 70%), radial-gradient(34% 46% at 20% 60%, rgba(74,107,138,.10), transparent 72%)",
        }}
      />

      {/* 远山轮廓 */}
      <svg
        className="absolute bottom-0 left-0 w-full"
        viewBox="0 0 1440 420"
        preserveAspectRatio="none"
        style={{ height: "42vh", minHeight: 260 }}
      >
        <defs>
          <linearGradient id="dy-far" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--stoneblue)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--stoneblue)" stopOpacity="0.015" />
          </linearGradient>
          <linearGradient id="dy-near" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ink)" stopOpacity="0.17" />
            <stop offset="100%" stopColor="var(--ink)" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <path
          d="M0 302 C 118 252 178 188 262 204 C 332 217 372 148 470 174 C 542 193 600 266 700 250 C 782 237 832 174 930 194 C 1030 214 1092 286 1180 268 C 1266 251 1332 204 1440 234 L1440 420 L0 420 Z"
          fill="url(#dy-far)"
        />
        <path
          d="M0 358 C 142 328 210 290 320 298 C 430 306 500 256 620 270 C 740 284 800 338 920 326 C 1040 314 1120 266 1240 286 C 1330 301 1390 334 1440 328 L1440 420 L0 420 Z"
          fill="url(#dy-near)"
        />
        <path
          d="M0 400 C 160 380 260 392 400 386 C 560 379 700 396 860 390 C 1020 384 1180 396 1440 384 L1440 420 L0 420 Z"
          fill="var(--ink)"
          opacity="0.07"
        />
      </svg>

      {/* 春节模式：两侧灯笼 */}
      {spring && (
        <>
          <Lantern className="left-[3vw] top-0" delay={0} />
          <Lantern className="right-[3vw] top-0" delay={1.4} />
        </>
      )}
    </div>
  );
}

function Lantern({ className, delay }: { className: string; delay: number }) {
  return (
    <div className={`absolute ${className} hidden md:block`} style={{ animationDelay: `${delay}s` }}>
      <svg width="72" height="190" viewBox="0 0 72 190" aria-hidden>
        <line x1="36" y1="0" x2="36" y2="34" stroke="var(--gold)" strokeWidth="1.4" />
        <rect x="24" y="30" width="24" height="8" rx="2" fill="var(--gold)" opacity=".85" />
        <ellipse cx="36" cy="76" rx="29" ry="34" fill="var(--cinnabar)" opacity=".9" />
        <ellipse cx="36" cy="76" rx="29" ry="34" fill="none" stroke="var(--gold)" strokeWidth="1.2" opacity=".7" />
        <ellipse cx="27" cy="70" rx="7" ry="22" fill="#fff" opacity=".16" />
        <rect x="24" y="106" width="24" height="8" rx="2" fill="var(--gold)" opacity=".85" />
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={i}
            x1={22 + i * 7}
            y1="114"
            x2={22 + i * 7}
            y2="142"
            stroke="var(--gold)"
            strokeWidth="1.1"
            opacity=".7"
          />
        ))}
        <text
          x="36"
          y="86"
          textAnchor="middle"
          fontSize="26"
          fill="var(--gold)"
          style={{ fontFamily: '"Noto Serif SC", serif', fontWeight: 700 }}
        >
          春
        </text>
      </svg>
    </div>
  );
}
