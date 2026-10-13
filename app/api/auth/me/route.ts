/**
 * GET /api/auth/me  当前登录者
 * ------------------------------------------------------------------
 * 前端打开页面先探一次：拿到 user 就显示昵称/后台入口，拿到 null 就显示「登录」。
 * 未登录**不算错误**（回 200 + user:null），省得前端把 401 当异常处理。
 *
 * ?selfcheck=1 附带一次 D1 连通性自检 —— 线上排查「登录不了」时，
 * 一眼能分清是「数据库没绑上」还是「密码不对」。
 */

import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);

  let dbProbe: { ok: boolean; reason?: string; users?: number } | undefined;
  if (url.searchParams.get("selfcheck") === "1") {
    try {
      const row = await getDb().prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
      dbProbe = { ok: true, users: row?.n ?? 0 };
    } catch (e) {
      dbProbe = { ok: false, reason: e instanceof Error ? e.message : "未知错误" };
    }
  }

  try {
    const user = await currentUser(req);
    return ok({ user, db: dbProbe });
  } catch (e) {
    // 到这里通常是 D1 没绑上；把原话带出来，别让前端只看到「500」
    return ok({ user: null, db: { ok: false, reason: e instanceof Error ? e.message : "未知错误" } });
  }
}
