"use client";

/**
 * 首页的「最新文章」小部件
 * ------------------------------------------------------------------
 * 首页是纯静态的（不读数据库），所以这块由浏览器自己去拉 /api/posts。
 *
 * 三种结果都要好看：
 *   有文章   → 列出标题 + 摘要 + 日期
 *   没文章   → 「还没发文章」，不是空白也不是报错
 *   接口挂了 → 同上（`degraded`），首页绝不能因为数据库没准备好就破个洞
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDate, type PostListItem } from "@/lib/posts";

export default function LatestPosts({ limit = 3 }: { limit?: number }) {
  const [posts, setPosts] = useState<PostListItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/posts?limit=${limit}`, { cache: "no-store" });
        const ct = res.headers.get("content-type") ?? "";
        if (!ct.includes("application/json")) throw new Error("no api");
        const json = (await res.json()) as { ok: boolean; data?: { posts?: PostListItem[] } };
        if (alive) setPosts(json.data?.posts ?? []);
      } catch {
        if (alive) setPosts([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [limit]);

  if (posts === null) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: limit }).map((_, i) => (
          <div key={i} className="h-[132px] animate-pulse rounded-md border border-line bg-panelSolid/50" />
        ))}
      </div>
    );
  }

  if (!posts.length) {
    return (
      <div className="paper-panel px-5 py-8 text-center">
        <p className="font-song text-[15px] tracking-wider text-ink">还没发文章</p>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-[1.9] text-inkFaint">
          这一栏会自动显示最新发布的文章。第一篇正在写，先去看看对联工具吧。
        </p>
        <Link
          href="/studio"
          className="mt-4 inline-flex h-9 items-center rounded-md border border-lineStrong bg-panelSolid/60 px-4 font-song text-[13px] text-ink transition-colors hover:border-cinnabar/60 hover:bg-accentSoft"
        >
          去对句
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {posts.map((p) => (
        <Link
          key={p.id}
          href={`/blog/${p.slug}`}
          className="paper-panel group relative overflow-hidden p-5 transition-transform hover:-translate-y-[2px]"
        >
          <div className="pointer-events-none absolute inset-0 bamboo-veil opacity-[.28]" />
          <div className="relative flex h-full flex-col">
            <div className="font-song text-[12px] tracking-[.2em] text-inkFaint">
              {formatDate(p.publishedAt)}
            </div>
            <h3 className="mt-2 font-song text-[16px] leading-snug tracking-wide text-ink transition-colors group-hover:text-cinnabar">
              {p.title}
            </h3>
            {p.summary && (
              <p className="mt-2 line-clamp-3 text-[13px] leading-[1.85] text-inkSoft">{p.summary}</p>
            )}
            <span className="mt-auto pt-3 font-song text-[12px] text-cinnabar opacity-0 transition-opacity group-hover:opacity-100">
              读全文 →
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
