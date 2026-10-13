/**
 * POST /api/auth/register  注册
 * ------------------------------------------------------------------
 * 注册即登录（省掉「注册成功请再去登录」这一趟）。
 * 邮箱大小写不敏感；密码 8 位以上且必须字母 + 数字。
 * 防刷：同一 IP 每小时最多 5 次注册（D1 计数，Worker 无状态所以不能放内存）。
 */

import {
  buildSessionCookie,
  checkPassword,
  createSession,
  hashPassword,
  isSecureRequest,
  normalizeEmail,
  normalizeNickname,
  overRateLimit,
  sameOrigin,
} from "@/lib/auth";
import { getDb, now, type UserRow } from "@/lib/db";
import { clientIp, fail, ok, readJson, withCookie } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("请求来源不对，已拒绝", 403);

  const ip = clientIp(req);
  if (await overRateLimit(`register:ip:${ip}`, 5, 60 * 60 * 1000)) {
    return fail("这个网络注册太频繁了，请过一小时再试", 429);
  }

  const body = await readJson(req);
  if (!body) return fail("请求体不是合法的 JSON");

  const email = normalizeEmail(body.email);
  if (!email || email.length > 120) return fail("请填一个正确的邮箱");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail("邮箱格式看起来不对，检查一下 @ 前后");

  const pw = (body.password ?? body.pass) as unknown;
  const pc = checkPassword(pw);
  if (!pc.ok) return fail(pc.reason ?? "密码不符合要求");

  const nickname = normalizeNickname(body.nickname, email);
  const db = getDb();

  try {
    const exists = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: number }>();
    if (exists) return fail("这个邮箱已经注册过了，直接登录吧", 409);

    const passwordHash = await hashPassword(pw as string);
    const t = now();
    await db
      .prepare(
        "INSERT INTO users (email, nickname, password_hash, role, status, must_change_password, created_at, last_login_at) " +
          "VALUES (?, ?, ?, 'user', 'active', 0, ?, ?)"
      )
      .bind(email, nickname, passwordHash, t, t)
      .run();

    // 邮箱唯一，插完按邮箱回查最稳（不依赖 last_rowid / RETURNING 这些方言特性）
    const row = await db
      .prepare("SELECT id, email, nickname, role, must_change_password FROM users WHERE email = ?")
      .bind(email)
      .first<Pick<UserRow, "id" | "email" | "nickname" | "role" | "must_change_password">>();
    if (!row) return fail("注册没成功，请稍后再试", 500);

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
    const msg = e instanceof Error ? e.message : "未知错误";
    // 唯一索引冲突 = 并发下两个请求同时过了上面的 exists 检查
    if (/UNIQUE/i.test(msg)) return fail("这个邮箱已经注册过了，直接登录吧", 409);
    return fail(`注册失败：${msg}`, 500);
  }
}

/**
 * GET 只用来做「这个接口在不在」的自检。
 * 为什么不直接回 405：SPA 兜底会把 404 伪装成 200 + HTML，
 * 排查时「接口存在但方法不对」和「接口根本不存在」会长得一样，
 * 所以留一个能一眼分辨的 JSON。
 */
export async function GET() {
  return ok({ service: "对韵 · 注册", method: "POST", fields: ["email", "password", "nickname?"] });
}
