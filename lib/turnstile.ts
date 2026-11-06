/**
 * Cloudflare Turnstile 人机验证（服务端专用）
 * ==================================================================
 * 目的：在「AI 生成」这一步加一道真人校验，挡住脚本刷额度；
 *       **本地引擎照旧不验证**，保证任何情况下工具都能出内容。
 *
 * 配置（两个都要有才启用，缺一个就整体跳过、行为与没有它时完全一致）：
 *   - TURNSTILE_SITE_KEY    公开，可进仓库，放 wrangler.jsonc 的 vars
 *   - TURNSTILE_SECRET_KEY  保密，必须走 Cloudflare 控制台 Secret
 *
 * 校验地址：https://challenges.cloudflare.com/turnstile/v0/siteverify
 * 注意：token 是一次性的、约 5 分钟过期，前端每次生成后要重置部件。
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

/** 公开的 Site Key（前端用它渲染部件）；为空表示没配 */
export function turnstileSiteKey(): string {
  return env("TURNSTILE_SITE_KEY");
}

function turnstileSecretKey(): string {
  return env("TURNSTILE_SECRET_KEY");
}

/** 两个 Key 都在才算「已启用」；只配了一个视为未启用，避免半吊子状态 */
export function isTurnstileConfigured(): boolean {
  return turnstileSiteKey().length > 0 && turnstileSecretKey().length > 0;
}

export interface TurnstileResult {
  ok: boolean;
  reason?: string;
}

/**
 * 校验前端带上来的 token。
 * - 未配置密钥 → 直接放行（等价于没开这个功能）
 * - token 缺失/校验失败 → 拒绝（调用方降级到本地引擎，不白屏）
 * - 校验服务网络异常 → **fail-open 放行**（宁可少挡一次，也不让整站 AI 因 CF 抖动挂掉）
 */
export async function verifyTurnstile(token: string, remoteIp?: string): Promise<TurnstileResult> {
  const secret = turnstileSecretKey();
  if (!secret) return { ok: true };

  const t = (token ?? "").trim();
  if (t.length < 10) return { ok: false, reason: "缺少人机验证凭据" };

  try {
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", t);
    if (remoteIp && remoteIp !== "unknown") form.set("remoteip", remoteIp);

    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body: form,
      cache: "no-store",
    });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (data.success) return { ok: true };
    return { ok: false, reason: (data["error-codes"] ?? []).join(",") || "验证未通过" };
  } catch (e) {
    // 网络/解析异常：放行（fail-open），但留一条日志便于排查
    console.warn("[duiyun] Turnstile 校验请求失败，已放行:", e instanceof Error ? e.message : e);
    return { ok: true };
  }
}
