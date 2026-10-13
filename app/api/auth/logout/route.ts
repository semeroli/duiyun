/**
 * POST /api/auth/logout  登出
 * ------------------------------------------------------------------
 * 不只清浏览器 Cookie，**同时把库里的会话行删掉** ——
 * 否则那个 token 在 30 天内依然有效，等于没登出。
 */

import { buildClearCookie, destroySession, isSecureRequest, parseCookies, sameOrigin, SESSION_COOKIE } from "@/lib/auth";
import { fail, ok, withCookie } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("请求来源不对，已拒绝", 403);

  const secure = isSecureRequest(req);
  const token = parseCookies(req.headers.get("cookie"))[SESSION_COOKIE];
  if (token) {
    try {
      await destroySession(token);
    } catch {
      // 库里删不掉也要把 Cookie 清掉，否则用户会以为自己没登出成功
    }
  }
  return withCookie(ok({ loggedOut: true }), buildClearCookie(secure));
}

export async function GET() {
  return ok({ service: "对韵 · 登出", method: "POST" });
}
