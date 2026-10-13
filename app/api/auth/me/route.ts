/**
 * GET /api/auth/me  当前登录者
 * ------------------------------------------------------------------
 * 前端打开页面先探一次：拿到 user 就显示昵称/后台入口，拿到 null 就显示「登录」。
 * 未登录**不算错误**（回 200 + user:null），省得前端把 401 当异常处理。
 *
 * 两个诊断开关（线上排查用，前端不会去调）：
 *   ?selfcheck=1        查一次 D1 连通性 —— 一眼分清「数据库没绑上」还是「表没建」
 *   ?hash=1&it=100000   量一次密码加密耗时 —— 免费版 Worker 有 CPU 上限，
 *                       得知道 10 万次迭代扛不扛得住，不能靠猜
 */

import { currentUser, hashPassword, PBKDF2_ITERATIONS } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 密码体检的次数上限：它是纯烧 CPU 的接口，不能让人反复打 */
const HASH_PROBE_LIMIT = 8;
let hashProbeRuns = 0;

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

  let hashProbe: unknown;
  if (url.searchParams.get("hash") === "1") {
    if (hashProbeRuns >= HASH_PROBE_LIMIT) {
      hashProbe = { skipped: `本实例已测满 ${HASH_PROBE_LIMIT} 次，不再重复` };
    } else {
      hashProbeRuns++;
      const it = Math.min(1_000_000, Math.max(1000, Number(url.searchParams.get("it")) || PBKDF2_ITERATIONS));
      const t0 = Date.now();
      await hashPassword("duiyun-probe-password-2026", it);
      hashProbe = { iterations: it, ms: Date.now() - t0 };
    }
  }

  try {
    const user = await currentUser(req);
    return ok({ user, db: dbProbe, hashProbe });
  } catch (e) {
    // 到这里通常是 D1 没绑上；把原话带出来，别让前端只看到「500」
    return ok({ user: null, db: { ok: false, reason: e instanceof Error ? e.message : "未知错误" } });
  }
}
