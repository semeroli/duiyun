import type { MetadataRoute } from "next";
import { listPublished } from "@/lib/blogServer";

/**
 * 站点地图
 * ------------------------------------------------------------------
 * 给搜索引擎和「导航网站收录」用的：首页、工作台、博客列表，
 * 加上每一篇已发布的文章。
 *
 * 文章是运行时从数据库读的，所以整张表每次都现算（force-dynamic）——
 * 刚发布的文章下次抓取就能看到，不用等构建。
 * 数据库没准备好时 listPublished 会返回空数组，站点地图照样能出，
 * 只是少了文章那几条。
 */

export const dynamic = "force-dynamic";

const BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://lwdy.de5.net").replace(/\/+$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await listPublished(200);
  const now = new Date();

  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/studio`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    ...posts.map((p) => ({
      url: `${BASE}/blog/${encodeURIComponent(p.slug)}`,
      lastModified: new Date(p.updatedAt || p.publishedAt || Date.now()),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
