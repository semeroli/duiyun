"use client";

/**
 * 印章（朱文方印）
 * 用于卡片落款、收藏标记、印章落下动画。
 */

export default function Seal({
  text = "对韵",
  size = 60,
  rotate = -9,
  animate = true,
  className = "",
}: {
  text?: string;
  size?: number;
  rotate?: number;
  animate?: boolean;
  className?: string;
}) {
  const chars = Array.from(text);
  const cols = chars.length > 4 ? 3 : chars.length > 2 ? 2 : 1;

  return (
    <div
      className={`${animate ? "animate-seal-press" : ""} ${className}`}
      style={{ width: size, height: size }}
    >
      <div
        className="seal-face flex h-full w-full items-center justify-center rounded-[7px]"
        style={{ transform: `rotate(${rotate}deg)` }}
      >
        <div
          className="grid place-items-center"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
        >
          {chars.map((c, i) => (
            <span
              key={`${c}-${i}`}
              className="block leading-none"
              style={{ fontSize: chars.length > 4 ? size * 0.24 : size * 0.34, fontWeight: 700 }}
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
