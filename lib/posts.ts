/**
 * 文章相关的共享类型与转换（服务端 / 客户端都能引，但只放纯函数）
 * ==================================================================
 * 单独成文件的原因：Next.js 的 route.ts **只允许导出 HTTP 方法与
 * 少数几个配置项**，多导出一个函数就会在构建时报
 * 「does not match the required types of a Next.js Route」。
 * 所以类型和转换函数都放这里。
 */

import type { PostRow } from "./db";

/** 列表用的精简结构（不含正文，省流量） */
export interface PostListItem {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  tags: string[];
  publishedAt: number | null;
  updatedAt: number;
  viewCount: number;
}

/** 后台列表用：多带一个状态，草稿也要能看到 */
export interface PostAdminItem extends PostListItem {
  status: "draft" | "published";
}

export type PostListRow = Omit<PostRow, "content_md">;

export function toListItem(r: PostListRow): PostListItem {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    tags: r.tags ? r.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    publishedAt: r.published_at,
    updatedAt: r.updated_at,
    viewCount: r.view_count,
  };
}

export function toAdminItem(r: PostListRow): PostAdminItem {
  return { ...toListItem(r), status: r.status };
}

/** 列表页统一的时间写法：2026年10月13日 */
export function formatDate(ts: number | null | undefined): string {
  if (!ts) return "未发布";
  const d = new Date(ts);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}
