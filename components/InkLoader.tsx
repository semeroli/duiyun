"use client";

/**
 * 加载态：砚台研磨 + 墨汁滴落
 * 比转圈圈更贴题，也更容易让人「愿意等」。
 */

export default function InkLoader({ label = "研墨中，稍候落笔" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-7" role="status" aria-live="polite">
      <svg width="84" height="62" viewBox="0 0 84 62" aria-hidden>
        {/* 墨汁滴落 */}
        <g>
          <circle cx="42" cy="8" r="3.2" fill="var(--ink)" className="animate-ink-drop" />
        </g>

        {/* 砚台 */}
        <ellipse cx="42" cy="46" rx="33" ry="12" fill="var(--ink)" opacity=".08" />
        <path
          d="M9 44 a33 12 0 0 0 66 0 v-7 a33 12 0 0 1 -66 0 Z"
          fill="var(--panel-solid)"
          stroke="var(--ink-faint)"
          strokeWidth="1.1"
        />
        <ellipse
          cx="42"
          cy="37"
          rx="33"
          ry="12"
          fill="var(--panel-solid)"
          stroke="var(--ink-faint)"
          strokeWidth="1.1"
        />
        <ellipse cx="42" cy="38" rx="21" ry="7.2" fill="var(--ink)" opacity=".55" />
        <ellipse cx="35" cy="36.5" rx="7" ry="2.4" fill="#fff" opacity=".18" />

        {/* 墨锭（往复研磨） */}
        <g
          className="animate-grind"
          style={{ transformBox: "fill-box", transformOrigin: "50% 85%" }}
        >
          <rect x="36" y="12" width="12" height="27" rx="3" fill="var(--ink)" />
          <rect x="36" y="12" width="12" height="7" rx="3" fill="var(--gold)" opacity=".85" />
          <rect x="38.5" y="22" width="7" height="1.4" rx="0.7" fill="var(--gold)" opacity=".5" />
        </g>
      </svg>

      <p className="font-song text-sm tracking-[.2em] text-inkSoft">{label}</p>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-cinnabar/60"
            style={{ animation: `ink-drop 1.5s ease-in infinite ${i * 0.22}s` }}
          />
        ))}
      </div>
    </div>
  );
}
