/**
 * /api/posts/[id]  单篇文章的修改与删除（仅管理员）
 * ------------------------------------------------------------------
 * PATCH  改标题 / 摘要 / 正文 / 标签 / 状态
 * GET    读全文（管理员编辑时用，草稿也能读到）
 * DELETE 删除（连带评论一起删，靠外键 ON DELETE CASCADE）
 *
 * 暂不做物理删除的「回收站」—— 文章量小，删错了直接从备份恢复。
 * 如果以后觉得风险大，把 DELETE 改成 status='trashed' 即可，表结构不用动。
 */

import { currentUser } from "@/lib/auth";
import { getDb, now } from "@/lib/db";
import { fail, ok, readJson, str } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin(req: Request) {
  const me = await currentUser(req);
  if (!me) return { error: fail("请先登录", 401) };
  if (me.role !== "admin") return { error: fail("只有管理员能操作", 403) };
  return { me };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { id } = await ctx.params;
  try {
    const row = await getDb()
      .prepare("SELECT * FROM posts WHERE id = ?")
      .bind(Number(id))
      .first<Record<string, unknown>>();
    if (!row) return fail("这篇文章不存在", 404);
    return ok({ post: row });
  } catch (e) {
    return fail(`读取失败：${e instanceof Error ? e.message : "未知错误"}`, 500);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const body = await readJson(req);
  if (!body) return fail("请求体不是合法的 JSON");

  const { id } = await ctx.params;
  const db = getDb();

  try {
    const cur = await db
      .prepare("SELECT id, status, published_at FROM posts WHERE id = ?")
      .bind(Number(id))
      .first<{ id: number; status: string; published_at: number | null }>();
    if (!cur) return fail("这篇文章不存在", 404);

    // 逐字段拼 SET：只更新传了值的字段，没传的保持原样
    const sets: string[] = [];
    const values: unknown[] = [];
    const put = (col: string, v: unknown) => {
      sets.push(`${col} = ?`);
      values.push(v);
    };

    if (body.title !== undefined) {
      const t = str(body.title, 120);
      if (t.length < 2) return fail("标题至少 2 个字");
      put("title", t);
    }
    if (body.summary !== undefined) put("summary", str(body.summary, 200));
    if (body.content !== undefined) {
      const c = str(body.content, 100_000);
      if (!c.trim()) return fail("正文不能为空");
      put("content_md", c);
    }
    if (body.tags !== undefined) put("tags", str(body.tags, 200));
    if (body.slug !== undefined) put("slug", str(body.slug, 80));

    if (body.status !== undefined) {
      const st = body.status === "published" ? "published" : "draft";
      put("status", st);
      // 第一次发布时才盖发布时间；已经发过的改回草稿再发，不覆盖原时间
      if (st === "published" && !cur.published_at) put("published_at", now());
    }

    if (!sets.length) return fail("没有要改的内容");

    put("updated_at", now());
    values.push(Number(id));

    await db.prepare(`UPDATE posts SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
    return ok({ id: Number(id), updated: sets.length - 1 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    if (/UNIQUE/i.test(msg)) return fail("这个网址标识（slug）已经被别的文章占了", 409);
    return fail(`保存失败：${msg}`, 500);
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin(req);
  if (error) return error;

  const { id } = await ctx.params;
  try {
    await getDb().prepare("DELETE FROM posts WHERE id = ?").bind(Number(id)).run();
    return ok({ deleted: Number(id) });
  } catch (e) {
    return fail(`删除失败：${e instanceof Error ? e.message : "未知错误"}`, 500);
  }
}
