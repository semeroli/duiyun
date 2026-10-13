import type { Metadata } from "next";
import Link from "next/link";
import SiteBackground from "@/components/SiteBackground";
import SiteHeader from "@/components/SiteHeader";
import { listPublished } from "@/lib/blogServer";
import { formatDate } from "@/lib/posts";

/**
 * 对韵博客 · 列表
 * 服务端直读 D1（不经接口）—— 列表页要能被搜索引擎抓到，靠客户端拉数据会长不出内容。
 * 每次请求都查（force-dynamic）：刚在后台点完发布，刷新列表就得看到。
 */

export const metadata: Metadata = {
  title: "对韵博客｜格律、典故与课堂用法",
  description: "讲对联的格律与典故，也讲怎么把对联工具用进语文课堂。",
  alternates: { canonical: "/blog" },
};

export const dynamic = "force-dynamic";

export default async function BlogIndex() {
  const posts = await listPublished(50);

  return (
    <div className="relative min-h-[100dvh]">
      <SiteBackground />
      <div className="relative z-10">
        <SiteHeader />

        <main className="mx-auto max-w-4xl px-4 py-10 md:px-6 md:py-14">
          <header className="mb-8">
            <div className="font-song text-[11px] tracking-[.38em] text-cinnabar">对韵博客</div>
            <h1 className="mt-2.5 font-song text-[28px] leading-snug tracking-[.08em] text-ink md:text-[36px]">
              从一副对联讲起
            </h1>
            <p className="mt-3 max-w-2xl text-[13.5px] leading-[1.9] text-inkSoft">
              讲格律怎么算、典故从哪来，也讲怎么把对联用进课堂。
            </p>
            <div className="divider-brush mt-6" />
          </header>

          {posts.length === 0 ? (
            <div className="paper-panel px-6 py-12 text-center">
              <p className="font-song text-[17px] tracking-wider text-ink">还没有发布的文章</p>
              <p className="mx-auto mt-2.5 max-w-md text-[13px] leading-[1.9] text-inkFaint">
                管理员登录后，右上角头像菜单里进「管理后台」，写完点发布就会出现在这里。
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                <Link
                  href="/studio"
                  className="inline-flex h-10 items-center rounded-md border border-transparent bg-cinnabar px-5 font-song text-[13px] tracking-wider text-white shadow-seal transition-all hover:brightness-110"
                >
                  先去对句
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-10 items-center rounded-md border border-lineStrong bg-panelSolid/60 px-5 font-song text-[13px] tracking-wider text-ink transition-colors hover:border-cinnabar/60 hover:bg-accentSoft"
                >
                  管理员登录
                </Link>
              </div>
            </div>
          ) : (
            <ul className="space-y-3.5">
              {posts.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/blog/${p.slug}`}
                    className="paper-panel group block relative overflow-hidden px-5 py-5 transition-transform hover:-translate-y-[2px] md:px-6"
                  >
                    <div className="pointer-events-none absolute inset-0 bamboo-veil opacity-[.26]" />
                    <div className="relative">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-song text-[11px] tracking-[.2em] text-inkFaint">
                        <span>{formatDate(p.publishedAt)}</span>
                        {p.viewCount > 0 && <span>· 读过 {p.viewCount} 次</span>}
                      </div>
                      <h2 className="mt-2 font-song text-[20px] leading-snug tracking-wide text-ink transition-colors group-hover:text-cinnabar md:text-[22px]">
                        {p.title}
                      </h2>
                      {p.summary && (
                        <p className="mt-2 text-[13px] leading-[1.9] text-inkSoft">{p.summary}</p>
                      )}
                      {p.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {p.tags.map((t) => (
                            <span
                              key={t}
                              className="rounded-full border border-line px-2 py-[2px] font-song text-[11px] text-inkFaint"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>
    </div>
  );
}
