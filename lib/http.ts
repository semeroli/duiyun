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

/**
 * 把数据库错误翻成人话。
 * ------------------------------------------------------------------
 * 两条考虑：
 *   ① **不要把 `D1_ERROR: no such table: users` 这种原文吐给用户** ——
 *      既看不懂，也等于免费告诉别人「这台服务器上跑的是 SQLite、表名长这样」。
 *   ② 但也别把线索全掐掉，否则出事时无从查起。
 * 所以：原文进服务器日志（`console.error`），页面上只给人话。
 * 想自己看原始错误，用 `/api/auth/me?selfcheck=1`。
 */
export function dbError(e: unknown, fallback: string): string {
  const raw = e instanceof Error ? e.message : String(e);
  console.error("[duiyun] 数据库操作失败:", raw);
  if (/no such table/i.test(raw)) {
    return "站点数据库还没建好，请稍后再试（管理员需要先在 Cloudflare D1 控制台执行建表语句）";
  }
  if (/D1_ERROR|Network connection lost|storage/i.test(raw)) {
    return "数据库这会儿连不上，请稍后再试";
  }
  return fallback;
}

