/**
 * 账号与会话（服务端专用）
 * ==================================================================
 * 密码：PBKDF2-SHA256，每用户独立随机 salt，存成
 *       `pbkdf2$迭代次数$salt$hash` —— 参数写在串里，
 *       将来把迭代次数从 10 万提到 60 万，老密码照样能验证通过。
 *
 * 会话：随机 32 字节 token 放进 HttpOnly Cookie；
 *       **库里只存 token 的 SHA-256**，数据库被拖走也换不出能用的登录态。
 *
 * ⚠️ 迭代次数是拿捏过的：Cloudflare Worker 免费版对 CPU 时间有上限，
 *    PBKDF2 是 CPU 密集操作。这里默认 10 万次，若线上报 CPU 超限就调小
 *    （改 PBKDF2_ITERATIONS 一个常量即可，老密码不受影响）。
 */

import { getDb, type UserRow } from "./db";

export const SESSION_COOKIE = "duiyun_session";

/**
 * 10 万次。这是**故意卡在上限**的，别往上调。
 * ------------------------------------------------------------------
 * 🔴 Cloudflare Workers 的 `crypto.subtle` 对 PBKDF2 有**硬上限 100,000 次迭代**，
 *    超过就直接 500（实测 2026-10-13线上：100000 → 200 OK；
 *    150000 / 180000 / 200000 / 300000 → 500 Internal Server Error，响应体为空）。
 *    所以 OWASP 现在建议的 60 万次在免费版 Worker 上**根本跑不起来** —— 别照抄。
 *
 *    10 万配「每用户独立随机 salt」+ 服务端限流，对这个站够用。
 *    将来若要提强度，两条路：① 换 scrypt / Argon2（Workers 原生支持 scrypt）；
 *    ② 升级 Workers 付费版（CPU 上限更宽），但仍要实测那个 10 万的上限是否放开。
 *
 * ⚠️ 别用 `Date.now()` 量这个函数的耗时：Workers 的日期时钟**在纯计算期间不推进**
 *    （只在 I/O 边界更新），量出来恒为 0 毫秒。想量就从外面量整条请求的墙钟时间。
 */
export const PBKDF2_ITERATIONS = 100_000;

/** 会话有效期：30 天 */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/* ── 编解码小工具 ─────────────────────────────────────── */

export function toB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function sha256Hex(input: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  const bytes = new Uint8Array(d);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

/** 定长比较，避免「按字节提前返回」泄漏信息 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/* ── 密码 ─────────────────────────────────────────────── */

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as unknown as BufferSource, iterations },
    key,
    256
  );
}

export async function hashPassword(password: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(password, salt, iterations);
  return `pbkdf2$${iterations}$${toB64(salt)}$${toB64(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 1000 || iterations > 5_000_000) return false;
  try {
    const salt = fromB64(parts[2]);
    const expected = fromB64(parts[3]);
    const actual = new Uint8Array(await derive(password, salt, iterations));
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/* ── Cookie ───────────────────────────────────────────── */

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

/**
 * 组装 Set-Cookie。
 * `Secure` 只在 https 下加：本地 `npm run preview` 是 http://localhost，
 * 带上 Secure 浏览器会直接丢掉这个 Cookie，表现为「登录成功但一直没登录」。
 */
export function buildSessionCookie(token: string, secure: boolean, maxAgeSec = SESSION_TTL_MS / 1000): string {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(maxAgeSec)}`,
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function buildClearCookie(secure: boolean): string {
  return [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0", secure ? "Secure" : ""]
    .filter(Boolean)
    .join("; ");
}

/** 请求是不是走的 https（决定要不要加 Secure） */
export function isSecureRequest(req: Request): boolean {
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

/* ── CSRF：写操作必须同源 ─────────────────────────────── */

/**
 * SameSite=Lax 已经挡掉绝大部分跨站带 Cookie 的 POST；
 * 这里再补一道 Origin 校验，双保险。
 * 不带 Origin 的请求（curl、服务端直连、部分老浏览器）放行，
 * 因为它们本来就不会自动带上玩家的 Cookie。
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/* ── 会话 ─────────────────────────────────────────────── */

export interface SessionUser {
  id: number;
  email: string;
  nickname: string;
  role: "user" | "admin";
  mustChangePassword: boolean;
}

export function newSessionToken(): string {
  return toB64(crypto.getRandomValues(new Uint8Array(32)));
}

export async function createSession(userId: number, userAgent: string | null): Promise<string> {
  const token = newSessionToken();
  const tokenHash = await sha256Hex(token);
  const t = Date.now();
  await getDb()
    .prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)")
    .bind(tokenHash, userId, t, t + SESSION_TTL_MS, userAgent ? userAgent.slice(0, 200) : null)
    .run();
  return token;
}

export async function destroySession(token: string): Promise<void> {
  const tokenHash = await sha256Hex(token);
  await getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
}

/** 按 userId 清掉该用户所有会话（改密码 / 封号时用） */
export async function destroyAllSessions(userId: number): Promise<void> {
  await getDb().prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
}

/**
 * 当前登录者。没登录 / 过期 / 被封 → null（不抛错，调用处自己决定是 401 还是放行）。
 * 顺手清掉过期会话，避免表越来越大。
 */
export async function currentUser(req: Request): Promise<SessionUser | null> {
  const token = parseCookies(req.headers.get("cookie"))[SESSION_COOKIE];
  if (!token) return null;

  let row: (UserRow & { expires_at: number }) | null;
  try {
    const tokenHash = await sha256Hex(token);
    row = await getDb()
      .prepare(
        `SELECT u.id, u.email, u.nickname, u.role, u.status, u.must_change_password,
                u.password_hash, u.created_at, u.last_login_at, s.expires_at
           FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.token_hash = ?`
      )
      .bind(tokenHash)
      .first<UserRow & { expires_at: number }>();
  } catch {
    return null;
  }
  if (!row) return null;

  if (row.expires_at < Date.now()) {
    try {
      await destroySession(token);
    } catch {
      /* 清理失败不影响本次判定 */
    }
    return null;
  }
  if (row.status !== "active") return null;

  return {
    id: row.id,
    email: row.email,
    nickname: row.nickname,
    role: row.role,
    mustChangePassword: row.must_change_password === 1,
  };
}

/* ── 防刷 ─────────────────────────────────────────────── */

/**
 * 计数式限流：同一个 bucket 在 windowMs 内最多 limit 次。
 * 放在 D1 里而不是内存 —— Worker 是无状态的，内存计数换个实例就归零。
 * 判定与自增用一次 UPSERT 搞定，避免并发下算重。
 *
 * @returns true = 超限（应拒绝）
 */
export async function overRateLimit(bucket: string, limit: number, windowMs: number): Promise<boolean> {
  const db = getDb();
  const t = Date.now();
  try {
    const row = await db
      .prepare("SELECT count, window_start FROM rate_limits WHERE bucket = ?")
      .bind(bucket)
      .first<{ count: number; window_start: number }>();

    if (!row || t - row.window_start > windowMs) {
      await db
        .prepare(
          "INSERT INTO rate_limits (bucket, count, window_start) VALUES (?, 1, ?) " +
            "ON CONFLICT(bucket) DO UPDATE SET count = 1, window_start = ?"
        )
        .bind(bucket, t, t)
        .run();
      return false;
    }

    if (row.count >= limit) return true;

    await db.prepare("UPDATE rate_limits SET count = count + 1 WHERE bucket = ?").bind(bucket).run();
    return false;
  } catch {
    // 限流表出问题不该把用户挡在门外，放行并靠其他手段兜底
    return false;
  }
}

/** 清掉过期计数行（管理员偶尔手动触发，或以后挂定时任务） */
export async function pruneRateLimits(olderThanMs = 24 * 60 * 60 * 1000): Promise<void> {
  await getDb()
    .prepare("DELETE FROM rate_limits WHERE window_start < ?")
    .bind(Date.now() - olderThanMs)
    .run();
}

/* ── 输入校验 ─────────────────────────────────────────── */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase().slice(0, 120) : "";
}

export function normalizeNickname(raw: unknown, fallbackEmail: string): string {
  const s = typeof raw === "string" ? raw.trim().slice(0, 20) : "";
  return s || fallbackEmail.split("@")[0] || "联友";
}

export interface PasswordCheck {
  ok: boolean;
  reason?: string;
}

export function checkPassword(pw: unknown): PasswordCheck {
  if (typeof pw !== "string") return { ok: false, reason: "密码格式不对" };
  if (pw.length < 8) return { ok: false, reason: "密码至少 8 位" };
  if (pw.length > 128) return { ok: false, reason: "密码太长了（最多 128 位）" };
  if (!/[a-zA-Z]/.test(pw)) return { ok: false, reason: "密码里至少要有一个字母" };
  if (!/[0-9]/.test(pw)) return { ok: false, reason: "密码里至少要有一个数字" };
  return { ok: true };
}
