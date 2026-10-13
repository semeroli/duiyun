import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteBackground from "@/components/SiteBackground";
import SiteHeader from "@/components/SiteHeader";
import { bumpViewCount, getPostBySlug } from "@/lib/blogServer";
import { renderMarkdown } from "@/lib/markdown";
import { formatDate } from "@/lib/posts";
import { safeDecode } from "@/lib/safeDecode";

/**
 * 对韵博客 · 文章详情
 * ------------------------------------------------------------------
 * 正文走 lib/markdown.ts 的「先转义、再识别语法」渲染 ——
 * 作者在后台写什么都不会变成可执行的标签。
 */

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(safeDecode(slug));
  if (!post) return { title: "文章不存在 · 对韵博客", robots: { index: false } };
  return {
    title: `${post.title} · 对韵博客`,
    description: post.summary ?? undefined,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.summary ?? undefined,
      type: "article",
      url: `/blog/${post.slug}`,
    },
  };
}

export default async function BlogPost({ params }: Params) {
  const { slug } = await params;
  const post = await getPostBySlug(safeDecode(slug));
  if (!post) notFound();

  // 浏览量 +1：不 await 到影响渲染，失败也不管
  void bumpViewCount(post.id);

  const html = renderMarkdown(post.contentMd);

  return (
    <div className="relative min-h-[100dvh]">
      <SiteBackground />
      <div className="relative z-10">
        <SiteHeader />

        <main className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-14">
          <nav className="mb-6 font-song text-[12px] text-inkFaint">
            <Link href="/blog" className="transition-colors hover:text-cinnabar">
              对韵博客
            </Link>
            <span className="mx-2 opacity-60">/</span>
            <span className="text-inkSoft">正文</span>
          </nav>

          <article className="paper-panel relative overflow-hidden px-5 py-8 md:px-10 md:py-11">
            <div className="pointer-events-none absolute inset-0 bamboo-veil opacity-[.2]" />
            <div className="relative">
              <header className="mb-7">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-song text-[12px] tracking-[.2em] text-inkFaint">
                  <span>{formatDate(post.publishedAt)}</span>
                  {post.authorName && <span>· {post.authorName}</span>}
                  {post.viewCount > 0 && <span>· 读过 {post.viewCount} 次</span>}
                </div>
                <h1 className="mt-3 font-song text-[26px] leading-[1.35] tracking-[.06em] text-ink md:text-[34px]">
                  {post.title}
                </h1>
                {post.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {post.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-line px-2 py-[2px] font-song text-[12px] text-inkFaint"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="divider-brush mt-6" />
              </header>

              {/* 内容来自本后台作者，且 lib/markdown.ts 已做整段转义 */}
              <div className="md-body" dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          </article>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/blog"
              className="inline-flex h-10 items-center rounded-md border border-lineStrong bg-panelSolid/60 px-4 font-song text-[13px] text-ink transition-colors hover:border-cinnabar/60 hover:bg-accentSoft"
            >
              ← 回到博客
            </Link>
            <Link
              href="/studio"
              className="inline-flex h-10 items-center rounded-md border border-transparent bg-cinnabar px-5 font-song text-[13px] tracking-wider text-white shadow-seal transition-all hover:brightness-110"
            >
              去对联工作台
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
