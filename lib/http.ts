/**
 * 接口返回的统一格式（服务端专用）
 * ==================================================================
 *   { ok: true,  data: ... }
 *   { ok: false, error: "人话错误信息" }
 *
 * 一律给中文人话 —— 前端直接把 error 显示出来即可，不用再翻译一遍。
 * 刻意不 import NextResponse：这一层保持与框架无关，
 * 将来换 Hono / 换 Worker 原生 fetch handler 都不用改。
 */

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  // 接口一律不进 CDN / 浏览器缓存，避免「登录了却还是旧状态」
  "cache-control": "no-store",
};

export function ok<T>(data: T, init?: { status?: number; headers?: Record<string, string> }): Response {
  return new Response(JSON.stringify({ ok: true, data }), {
    status: init?.status ?? 200,
    headers: { ...JSON_HEADERS, ...(init?.headers ?? {}) },
  });
}

export function fail(error: string, status = 400, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { ...JSON_HEADERS, ...(headers ?? {}) },
  });
}

/** 追加/覆盖 Set-Cookie（一个响应可能要下发多条 Cookie，所以是 append 语义） */
export function withCookie(res: Response, cookie: string): Response {
  const headers = new Headers(res.headers);
  headers.append("set-cookie", cookie);
  return new Response(res.body, { status: res.status, headers });
}

/** 读 JSON 请求体，坏 JSON 直接给一句人话 */
export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const v = await req.json();
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** 只保留汉字、字母、数字（昵称/正文的通用清洗；正文另有 Markdown 转义） */
export function str(v: unknown, max = 2000): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** 请求来源信息，日志与限流用 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}
