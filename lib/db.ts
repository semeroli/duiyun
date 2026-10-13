/**
 * D1 数据库访问层
 * ==================================================================
 * 只做两件事：拿到绑定、给出表结构对应的 TS 类型。
 * SQL 全部留在调用处，方便对照 migrations/0001_init.sql 一起读。
 *
 * 🔴 为什么用 getCloudflareContext 而不是 process.env.DB ——
 *    OpenNext 启动时会拿「构建期烘焙」的值把 process.env 补齐，
 *    于是「绑定压根不存在」和「绑定存在但值为空」在 process.env 里
 *    长得一模一样（都是 undefined / 空串），线上排查会白费半天。
 *    getCloudflareContext().env 才是运行时真实绑定。
 *
 * 注：本仓库没装 @cloudflare/workers-types（为了不再动 package.json），
 *     所以下面自己声明了 D1 的最小结构类型 —— 只覆盖用得到的几个方法。
 *     样子与官方一致，将来装了官方类型包，把这些 interface 删掉即可。
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

/* ── D1 的最小结构类型 ─────────────────────────────────── */

export interface D1Result<T> {
  results: T[];
  success: boolean;
}

export interface D1Stmt {
  bind(...values: unknown[]): D1Stmt;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<{ success: boolean }>;
}

export interface D1Like {
  prepare(query: string): D1Stmt;
  batch(statements: D1Stmt[]): Promise<unknown>;
}

/**
 * 取 D1 句柄。
 * 报错信息写成「人能照着排查」的话 —— 这个函数一旦抛错，
 * 上层接口就会 500，看日志的人得能立刻知道去哪儿看。
 */
export function getDb(): D1Like {
  let env: unknown;
  try {
    env = getCloudflareContext().env;
  } catch (e) {
    throw new Error(
      `拿不到 Cloudflare 运行环境（本地 next dev 属于正常，请用 npm run preview 起本地 Worker）：${
        e instanceof Error ? e.message : "未知原因"
      }`
    );
  }
  const db = (env as { DB?: D1Like }).DB;
  if (!db) {
    throw new Error(
      "没有拿到 D1 绑定 DB —— 查三处：① wrangler.jsonc 的 d1_databases 里 binding 是否叫 DB；" +
        "② 数据库是否建在这个 Worker 所属的同一个账号下；③ 改完配置是否重新部署过。"
    );
  }
  return db;
}

/* ── 表结构对应的类型（字段名与 0001_init.sql 完全一致）── */

export interface UserRow {
  id: number;
  email: string;
  nickname: string;
  password_hash: string;
  role: "user" | "admin";
  status: "active" | "banned";
  must_change_password: number;
  created_at: number;
  last_login_at: number | null;
}

export interface PostRow {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  content_md: string;
  tags: string;
  status: "draft" | "published";
  author_id: number | null;
  published_at: number | null;
  created_at: number;
  updated_at: number;
  view_count: number;
}

export interface CommentRow {
  id: number;
  post_id: number;
  user_id: number;
  parent_id: number | null;
  content: string;
  status: "visible" | "hidden";
  created_at: number;
}

/**
 * 时间戳一律用 Unix 毫秒（与前端 `Date.now()` 同口径，
 * 也和 lib/storage.ts 里收藏项的 `at` 一致）。
 */
export function now(): number {
  return Date.now();
}

/** 给 posts 用的短标识（人可读、网址友好）：带中文也能用，但统一转小写横线 */
export function slugify(input: string): string {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{Script=Han}a-z0-9-]/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  return s || `post-${Date.now().toString(36)}`;
}
