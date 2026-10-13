/**
 * /api/posts  文章
 * ------------------------------------------------------------------
 * GET   列表（公开，只出「已发布」）
 * POST  新建（仅管理员）
 *
 * 列表刻意**不带正文** —— 首页与列表页只需要标题和摘要，
 * 带上 Markdown 正文会让响应体大好几十倍。
 *
 * 注：route.ts 只允许导出 HTTP 方法与少数配置项，
 *     所以类型和转换函数都在 lib/posts.ts 里，这里只 import。
 */

import { currentUser } from "@/lib/auth";
import { getDb, now, slugify } from "@/lib/db";
import { fail, ok, readJson, str } from "@/lib/http";
import { toAdminItem, toListItem, type PostListRow } from "@/lib/posts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIST_COLS =
  "id, slug, title, summary, tags, status, author_id, published_at, created_at, updated_at, view_count";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 10));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  // ?scope=all —— 后台用：草稿也要看得见，所以必须管理员
  if (url.searchParams.get("scope") === "all") {
    const me = await currentUser(req);
    if (!me) return fail("请先登录", 401);
    if (me.role !== "admin") return fail("只有管理员能看全部文章", 403);
    try {
      const rows = await getDb()
        .prepare(`SELECT ${LIST_COLS} FROM posts ORDER BY updated_at DESC LIMIT ? OFFSET ?`)
        .bind(limit, offset)
        .all<PostListRow>();
      return ok({ posts: rows.results.map(toAdminItem), total: rows.results.length, limit, offset });
    } catch (e) {
      return fail(`读取失败：${e instanceof Error ? e.message : "未知错误"}`, 500);
    }
  }

  try {
    const db = getDb();
    const rows = await db
      .prepare(
        `SELECT ${LIST_COLS}
           FROM posts
          WHERE status = 'published'
          ORDER BY COALESCE(published_at, created_at) DESC
          LIMIT ? OFFSET ?`
      )
      .bind(limit, offset)
      .all<PostListRow>();

    const total = await db
      .prepare("SELECT COUNT(*) AS n FROM posts WHERE status = 'published'")
      .first<{ n: number }>();

    return ok({ posts: rows.results.map(toListItem), total: total?.n ?? 0, limit, offset });
  } catch (e) {
    // 数据库还没建表 / 没绑定时会走到这里。用 ok + degraded 而不是 fail：
    // 前端按「暂无文章」渲染即可，首页不该因为数据库没好就冒出一块红色报错
    return ok({
      posts: [],
      total: 0,
      degraded: true,
      reason: e instanceof Error ? e.message : "数据库暂不可用",
    });
  }
}

export async function POST(req: Request) {
  const me = await currentUser(req);
  if (!me) return fail("请先登录", 401);
  if (me.role !== "admin") return fail("只有管理员能发文章", 403);

  const body = await readJson(req);
  if (!body) return fail("请求体不是合法的 JSON");

  const title = str(body.title, 120);
  const contentMd = str(body.content, 100_000);
  if (title.length < 2) return fail("标题至少 2 个字");
  if (!contentMd.trim()) return fail("正文不能为空");

  const summary = str(body.summary, 200) || contentMd.replace(/[#>*`\n\r]/g, " ").trim().slice(0, 80);
  const tags = str(body.tags, 200);
  const publish = body.status === "published" ? "published" : "draft";

  const db = getDb();
  try {
    // slug 手填优先，没填就从标题生成；撞了自动加序号
    const base = str(body.slug, 80) || slugify(title);
    let slug = base;
    for (let i = 2; i <= 30; i++) {
      const dup = await db.prepare("SELECT id FROM posts WHERE slug = ?").bind(slug).first<{ id: number }>();
      if (!dup) break;
      slug = `${base}-${i}`;
    }

    const t = now();
    await db
      .prepare(
        "INSERT INTO posts (slug, title, summary, content_md, tags, status, author_id, published_at, created_at, updated_at, view_count) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)"
      )
      .bind(slug, title, summary, contentMd, tags, publish, me.id, publish === "published" ? t : null, t, t)
      .run();

    return ok({ slug, status: publish });
  } catch (e) {
    return fail(`发布失败：${e instanceof Error ? e.message : "未知错误"}`, 500);
  }
}
