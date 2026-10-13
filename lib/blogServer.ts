/**
 * 博客的服务端读操作（只能被服务端组件 / 路由引用）
 * ==================================================================
 * 🔴 刻意与 lib/posts.ts 分开：那个文件被客户端组件（LatestPosts）
 *    引用，一旦把它和 getDb 放一起，`@opennextjs/cloudflare` 就会被打进
 *    浏览器包里 —— 轻则体积暴涨，重则构建报错。
 *
 * 所有函数**出错都不抛**，返回 null / 空数组：
 * 数据库没建表、没绑定、查不到，都只是「没内容」，不该让页面 500。
 */

import { getDb, type PostRow } from "./db";
import { toListItem, type PostListItem } from "./posts";

export interface PostDetail extends PostListItem {
  contentMd: string;
  authorName: string | null;
}

export async function listPublished(limit = 30, offset = 0): Promise<PostListItem[]> {
  try {
    const rows = await getDb()
      .prepare(
        `SELECT id, slug, title, summary, tags, status, author_id, published_at, created_at, updated_at, view_count
           FROM posts
          WHERE status = 'published'
          ORDER BY COALESCE(published_at, created_at) DESC
          LIMIT ? OFFSET ?`
      )
      .bind(limit, offset)
      .all<Omit<PostRow, "content_md">>();
    return rows.results.map(toListItem);
  } catch {
    return [];
  }
}

export async function getPostBySlug(slug: string): Promise<PostDetail | null> {
  try {
    const row = await getDb()
      .prepare(
        `SELECT p.*, u.nickname AS author_name
           FROM posts p LEFT JOIN users u ON u.id = p.author_id
          WHERE p.slug = ? AND p.status = 'published'`
      )
      .bind(slug)
      .first<PostRow & { author_name: string | null }>();
    if (!row) return null;
    return {
      ...toListItem(row),
      contentMd: row.content_md,
      authorName: row.author_name,
    };
  } catch {
    return null;
  }
}

/** 浏览量 +1。失败无所谓，绝不因为它让正文页 500 */
export async function bumpViewCount(id: number): Promise<void> {
  try {
    await getDb().prepare("UPDATE posts SET view_count = view_count + 1 WHERE id = ?").bind(id).run();
  } catch {
    /* 忽略 */
  }
}
