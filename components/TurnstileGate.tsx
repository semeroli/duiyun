"use client";

/**
 * Turnstile 人机验证小组件
 * ------------------------------------------------------------------
 * - 用官方 `api.js?render=explicit` 显式渲染，脚本只加载一次；
 * - managed 模式（默认）：一般无感通过，可疑时才要用户点一下；
 * - token 通过 onToken 回传给父组件，父组件随生成请求一起发；
 * - token 一次性，所以父组件每生成一次就把 `resetKey` 加一，
 *   本组件据此调 `turnstile.reset()` 换一张新的（不重挂 iframe，不闪）。
 *
 * 只有拿得到 siteKey 才渲染；没配就完全不出现，页面行为不变。
 */

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export default function TurnstileGate({
  siteKey,
  onToken,
  resetKey = 0,
}: {
  siteKey: string;
  onToken: (token: string) => void;
  resetKey?: number;
}) {
  const el = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const init = () => {
      if (cancelled || widgetId.current) return;
      if (!el.current || !window.turnstile) return;
      widgetId.current = window.turnstile.render(el.current, {
        sitekey: siteKey,
        theme: "auto",
        callback: (token: string) => onToken(token),
        // 5 分钟不用就会过期：清掉旧 token 并立刻换一张，
        // 否则用户挂着页面去讲课、回来一点就验证失败
        "expired-callback": () => {
          onToken("");
          if (widgetId.current && window.turnstile) {
            try {
              window.turnstile.reset(widgetId.current);
            } catch {
              /* 重置失败就等下次挂载 */
            }
          }
        },
        "error-callback": () => onToken(""),
      });
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      if (window.turnstile) init();
      else existing.addEventListener("load", init, { once: true });
    } else {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.addEventListener("load", init, { once: true });
      document.head.appendChild(s);
    }

    return () => {
      cancelled = true;
      try {
        if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      } catch {
        /* 卸载失败无所谓 */
      }
      widgetId.current = null;
    };
  }, [siteKey, onToken]);

  // resetKey 变化 = 父组件刚用完一张 token，换一张新的备着。
  // 不重挂组件（不重载 iframe），所以界面上不会闪一下。
  useEffect(() => {
    if (!resetKey || !widgetId.current || !window.turnstile) return;
    try {
      window.turnstile.reset(widgetId.current);
    } catch {
      /* 重置失败：下次挂载会重新渲染，不影响主流程 */
    }
  }, [resetKey]);

  return (
    <div className="flex justify-center" aria-label="人机验证">
      <div ref={el} />
    </div>
  );
}
