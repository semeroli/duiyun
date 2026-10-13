/**
 * POST /api/auth/login  登录
 * ------------------------------------------------------------------
 * 两个刻意的取舍：
 *   ① 密码错与邮箱不存在返回**同一句话** —— 不然接口就成了「批量试邮箱是否注册」的工具。
 *   ② 校验失败也照样跑一次密码散列（见下），让「邮箱不存在」和「密码错」
 *      的响应耗时接近，堵掉按耗时猜邮箱的路子。
 * 防刷：同邮箱 15 分钟 10 次、同 IP 15 分钟 40 次。
 */

import {
  buildClearCookie,
  buildSessionCookie,
  createSession,
  isSecureRequest,
  normalizeEmail,
  overRateLimit,
  sameOrigin,
  verifyPassword,
} from "@/lib/auth";
import { getDb, now, type UserRow } from "@/lib/db";
import { clientIp, dbError, fail, ok, readJson, withCookie } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 邮箱不存在时用的假散列（格式与真实的一致），只为让耗时对齐 */
const DUMMY_HASH =
  "pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA$" + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("请求来源不对，已拒绝", 403);

  const ip = clientIp(req);
  if (await overRateLimit(`login:ip:${ip}`, 40, 15 * 60 * 1000)) {
    return fail("尝试太频繁了，请歇一会儿再登录", 429);
  }

  const body = await readJson(req);
  if (!body) return fail("请求体不是合法的 JSON");

  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) return fail("邮箱和密码都要填");

  if (await overRateLimit(`login:email:${email}`, 10, 15 * 60 * 1000)) {
    return fail("这个账号尝试次数太多了，请 15 分钟后再试", 429);
  }

  try {
    // getDb 也放在 try 里：绑定缺失时抛的错要能被下面的 dbError 接住
    const db = getDb();
    const row = await db
      .prepare(
        "SELECT id, email, nickname, password_hash, role, status, must_change_password FROM users WHERE email = ?"
      )
      .bind(email)
      .first<Pick<UserRow, "id" | "email" | "nickname" | "password_hash" | "role" | "status" | "must_change_password">>();

    // user 不存在也照样跑一遍散列，耗时对齐（上面注释②）
    const good = await verifyPassword(password, row ? row.password_hash : DUMMY_HASH);
    if (!row || !good) return fail("邮箱或密码不对", 401);

    if (row.status !== "active") return fail("这个账号已被停用，请联系管理员", 403);

    await db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").bind(now(), row.id).run();

    const token = await createSession(row.id, req.headers.get("user-agent"));
    return withCookie(
      ok({
        user: {
          id: row.id,
          email: row.email,
          nickname: row.nickname,
          role: row.role,
          mustChangePassword: row.must_change_password === 1,
        },
      }),
      buildSessionCookie(token, isSecureRequest(req))
    );
  } catch (e) {
    return fail(dbError(e, "登录没成功，请稍后再试"), 500);
  }
}

export async function GET() {
  return ok({ service: "对韵 · 登录", method: "POST", fields: ["email", "password"] });
}
