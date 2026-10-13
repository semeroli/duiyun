"use client";

/**
 * 管理后台（写文章的地方）
 * ==================================================================
 * 只有 role='admin' 能用。三道门：
 *   ① 这一层：不是管理员直接不渲染编辑器（顺手把界面说清楚，别让人对着空屏猜）；
 *   ② 接口层：/api/posts 的写操作都查 role（见 app/api/posts/route.ts）；
 *   ③ 数据库层：数据本身带 author_id。
 * 前端这层只是「别浪费人时间」，真正的关卡在后面两层。
 *
 * 编辑器是「Markdown 源码 + 实时预览」两栏，不引富文本库 ——
 * 王老师写教文章，Markdown 的记法（# 标题、**加粗**、- 列表）比工具条更好记。
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import SiteBackground from "./SiteBackground";
import SiteHeader from "./SiteHeader";
import { useAuth } from "./AuthProvider";
import { renderMarkdown } from "@/lib/markdown";
import { formatDate, type PostAdminItem } from "@/lib/posts";

interface Draft {
  id?: number;
  title: string;
  slug: string;
  summary: string;
  tags: string;
  content: string;
  status: "draft" | "published";
}

const EMPTY: Draft = { title: "", slug: "", summary: "", tags: "", content: "", status: "draft" };

export default function AdminClient() {
  const { user, loading } = useAuth();
  const [posts, setPosts] = useState<PostAdminItem[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const res = await fetch("/api/posts?scope=all&limit=100", { cache: "no-store" });
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) throw new Error("接口不可用");
      const json = (await res.json()) as { ok: boolean; data?: { posts: PostAdminItem[] }; error?: string };
      if (!json.ok) throw new Error(json.error ?? "读取失败");
      setPosts(json.data?.posts ?? []);
    } catch (e) {
      setPosts([]);
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "读取失败" });
    }
  }, []);

  useEffect(() => {
    if (user?.role === "admin") void loadList();
  }, [user, loadList]);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);

  const previewHtml = useMemo(
    () => (draft ? renderMarkdown(draft.content) : ""),
    [draft?.content] // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function openPost(id: number) {
    setBusy(true);
    try {
      const res = await fetch(`/api/posts/${id}`, { cache: "no-store" });
      const json = (await res.json()) as {
        ok: boolean;
        data?: { post: Record<string, unknown> };
        error?: string;
      };
      if (!json.ok || !json.data?.post) throw new Error(json.error ?? "读取失败");
      const p = json.data.post;
      setDraft({
        id: Number(p.id),
        title: String(p.title ?? ""),
        slug: String(p.slug ?? ""),
        summary: String(p.summary ?? ""),
        tags: String(p.tags ?? ""),
        content: String(p.content_md ?? ""),
        status: p.status === "published" ? "published" : "draft",
      });
      setShowPreview(false);
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "读取失败" });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!draft) return;
    if (draft.title.trim().length < 2) {
      setMsg({ kind: "err", text: "标题至少 2 个字" });
      return;
    }
    if (!draft.content.trim()) {
      setMsg({ kind: "err", text: "正文不能为空" });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title: draft.title,
        slug: draft.slug,
        summary: draft.summary,
        tags: draft.tags,
        content: draft.content,
        status: draft.status,
      };
      const res = await fetch(draft.id ? `/api/posts/${draft.id}` : "/api/posts", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) throw new Error("接口不可用");
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "保存失败");
      setMsg({ kind: "ok", text: draft.status === "published" ? "已保存并发布" : "已存成草稿" });
      setDraft(null);
      await loadList();
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "保存失败" });
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: PostAdminItem) {
    if (!window.confirm(`确定删除《${p.title}》吗？\n\n删除后这篇文章和它下面的评论都会消失，无法撤销。`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/posts/${p.id}`, { method: "DELETE", cache: "no-store" });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "删除失败");
      setMsg({ kind: "ok", text: "已删除" });
      await loadList();
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "删除失败" });
    } finally {
      setBusy(false);
    }
  }

  /* ── 未登录 / 不是管理员 ───────────────────────────── */
  if (loading) {
    return (
      <Shell>
        <div className="h-40 animate-pulse rounded-md border border-line bg-panelSolid/50" />
      </Shell>
    );
  }
  if (!user) {
    return (
      <Shell>
        <Notice
          title="请先登录"
          body="管理后台只对管理员开放。用管理员邮箱登录后再回来。"
          primary={{ href: "/login?next=/admin", label: "去登录" }}
          secondary={{ href: "/studio", label: "去对联工作台" }}
        />
      </Shell>
    );
  }
  if (user.role !== "admin") {
    return (
      <Shell>
        <Notice
          title="这个账号不是管理员"
          body={`当前登录的是「${user.nickname}」（${user.email}）。如果要写文章，需要用管理员的邮箱登录；如果账号本该是管理员，需要有人在数据库里把 role 改成 admin。`}
          primary={{ href: "/studio", label: "去对联工作台" }}
          secondary={{ href: "/blog", label: "看看博客" }}
        />
      </Shell>
    );
  }

  /* ── 编辑器 ─────────────────────────────────────────── */
  if (draft) {
    return (
      <Shell>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-song text-[22px] tracking-[.1em] text-ink">
            {draft.id ? "编辑文章" : "新建文章"}
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="h-9 rounded-md border border-lineStrong bg-panelSolid/60 px-4 font-song text-[13px] text-ink transition-colors hover:border-cinnabar/60 hover:bg-accentSoft md:hidden"
            >
              {showPreview ? "回到编辑" : "看预览"}
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="h-9 rounded-md border border-transparent px-3 font-song text-[13px] text-inkFaint transition-colors hover:bg-accentSoft hover:text-ink"
            >
              取消
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setDraft({ ...draft, status: "draft" })}
              className={`h-9 rounded-md border px-4 font-song text-[13px] transition-colors disabled:opacity-50 ${
                draft.status === "draft"
                  ? "border-cinnabar/50 bg-accentSoft text-cinnabarInk"
                  : "border-lineStrong bg-panelSolid/60 text-ink hover:border-cinnabar/60"
              }`}
            >
              存草稿
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setDraft({ ...draft, status: "published" })}
              className={`h-9 rounded-md border px-4 font-song text-[13px] transition-colors disabled:opacity-50 ${
                draft.status === "published"
                  ? "border-cinnabar/50 bg-accentSoft text-cinnabarInk"
                  : "border-lineStrong bg-panelSolid/60 text-ink hover:border-cinnabar/60"
              }`}
            >
              发布
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="h-9 rounded-md border border-transparent bg-cinnabar px-5 font-song text-[13px] text-white shadow-seal transition-all hover:brightness-110 disabled:opacity-55"
            >
              {busy ? "保存中…" : "保存"}
            </button>
          </div>
        </div>

        <p className="mb-4 rounded-md border border-line bg-panelSolid/50 px-3.5 py-2.5 text-[12px] leading-relaxed text-inkSoft">
          先点「存草稿」或「发布」选定状态，再点「保存」。状态按钮上高亮的就是当前选择。
        </p>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="space-y-3.5">
            <Field label="标题">
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="如：入声字怎么认 —— 三个好记的规律"
                className={INPUT}
              />
            </Field>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <Field label="网址标识" hint="留空自动生成">
                <input
                  value={draft.slug}
                  onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                  placeholder="ru-sheng-zi"
                  className={`${INPUT} font-mono text-[13px]`}
                />
              </Field>
              <Field label="标签" hint="逗号分隔">
                <input
                  value={draft.tags}
                  onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                  placeholder="平仄, 入声, 基础"
                  className={INPUT}
                />
              </Field>
            </div>

            <Field label="摘要" hint="列表页与分享卡片显示，留空自动取正文开头">
              <textarea
                value={draft.summary}
                onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                rows={2}
                className={`${INPUT} resize-y py-2 leading-relaxed`}
              />
            </Field>

            <Field label="正文（Markdown）">
              <textarea
                value={draft.content}
                onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                rows={20}
                placeholder={"# 一级小标题\n\n正文段落。**加粗**、*着重*、`行内代码`。\n\n- 列表项\n- 列表项\n\n> 引用一段\n\n[链接文字](https://example.com)"}
                className={`${INPUT} resize-y py-2.5 font-kai text-[14px] leading-[1.95]`}
              />
            </Field>

            <details className="rounded-md border border-line bg-panelSolid/50 px-3.5 py-3 text-[12px] leading-relaxed text-inkFaint">
              <summary className="cursor-pointer font-song text-[12px] tracking-wider text-inkSoft">
                写作记法速查（点开）
              </summary>
              <ul className="mt-2.5 space-y-1">
                <li>
                  <code className="rounded bg-accentSoft px-1 text-cinnabarInk"># 标题</code> 一级小标题，
                  <code className="rounded bg-accentSoft px-1 text-cinnabarInk">## 次一级</code> 往下类推
                </li>
                <li>
                  <code className="rounded bg-accentSoft px-1 text-cinnabarInk">**加粗**</code>、
                  <code className="rounded bg-accentSoft px-1 text-cinnabarInk">*着重*</code>、
                  <code className="rounded bg-accentSoft px-1 text-cinnabarInk">~~删除线~~</code>
                </li>
                <li>
                  <code className="rounded bg-accentSoft px-1 text-cinnabarInk">- 一句一行</code> 无序列表；
                  行首写 <code className="rounded bg-accentSoft px-1 text-cinnabarInk">1. </code> 有序列表
                </li>
                <li>
                  <code className="rounded bg-accentSoft px-1 text-cinnabarInk">&gt; 开头</code> 是引用块
                </li>
                <li>
                  <code className="rounded bg-accentSoft px-1 text-cinnabarInk">---</code> 单独一行是分隔线
                </li>
                <li>
                  图片要贴外链地址：
                  <code className="rounded bg-accentSoft px-1 text-cinnabarInk">![说明](https://…)</code>
                  （本站暂时不存图片文件）
                </li>
              </ul>
            </details>
          </section>

          <section className="lg:sticky lg:top-24 lg:self-start">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-song text-[12px] tracking-[.24em] text-inkFaint">实时预览</span>
              <span className="text-[12px] text-inkFaint">与读者看到的样式一致</span>
            </div>
            <div
              className={`paper-panel max-h-[70vh] overflow-y-auto px-5 py-6 ${
                showPreview ? "" : "hidden md:block"
              }`}
            >
              {draft.title && (
                <h1 className="mb-4 font-song text-[22px] leading-snug tracking-[.06em] text-ink">
                  {draft.title}
                </h1>
              )}
              {draft.content.trim() ? (
                <div className="md-body" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              ) : (
                <p className="text-[13px] text-inkFaint">左边写了字，这里就会出现排版后的样子。</p>
              )}
            </div>
          </section>
        </div>
      </Shell>
    );
  }

  /* ── 文章列表 ───────────────────────────────────────── */
  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-song text-[22px] tracking-[.1em] text-ink">管理后台</h1>
          <p className="mt-1 text-[13px] text-inkFaint">
            登录为 {user.nickname}（{user.email}）
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/blog"
            className="h-9 rounded-md border border-lineStrong bg-panelSolid/60 px-4 font-song text-[13px] leading-9 text-ink transition-colors hover:border-cinnabar/60 hover:bg-accentSoft"
          >
            看前台博客
          </Link>
          <button
            type="button"
            onClick={() => setDraft({ ...EMPTY })}
            className="h-9 rounded-md border border-transparent bg-cinnabar px-5 font-song text-[13px] text-white shadow-seal transition-all hover:brightness-110"
          >
            写新文章
          </button>
        </div>
      </div>

      {posts === null ? (
        <div className="h-40 animate-pulse rounded-md border border-line bg-panelSolid/50" />
      ) : posts.length === 0 ? (
        <div className="paper-panel px-6 py-12 text-center">
          <p className="font-song text-[16px] tracking-wider text-ink">还没有文章</p>
          <p className="mt-2 text-[13px] text-inkFaint">点右上角「写新文章」开始第一篇。</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {posts.map((p) => (
            <li
              key={p.id}
              className="paper-panel flex flex-wrap items-center gap-3 px-4 py-3.5 md:px-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-[1px] font-song text-[12px] ${
                      p.status === "published"
                        ? "border-okInk/40 bg-okInk/[.08] text-okInk"
                        : "border-line text-inkFaint"
                    }`}
                  >
                    {p.status === "published" ? "● 已发布" : "○ 草稿"}
                  </span>
                  <button
                    type="button"
                    onClick={() => void openPost(p.id)}
                    className="min-w-0 truncate text-left font-song text-[15px] text-ink transition-colors hover:text-cinnabar"
                  >
                    {p.title}
                  </button>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 font-song text-[12px] text-inkFaint">
                  <span>
                    {p.status === "published" ? formatDate(p.publishedAt) : `改于 ${formatDate(p.updatedAt)}`}
                  </span>
                  {p.viewCount > 0 && <span>读过 {p.viewCount}</span>}
                  <span className="font-mono">/{p.slug}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {p.status === "published" && (
                  <Link
                    href={`/blog/${p.slug}`}
                    className="rounded-md px-2.5 py-1.5 font-song text-[12px] text-inkSoft transition-colors hover:bg-accentSoft hover:text-ink"
                  >
                    看
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => void openPost(p.id)}
                  className="rounded-md px-2.5 py-1.5 font-song text-[12px] text-inkSoft transition-colors hover:bg-accentSoft hover:text-ink"
                >
                  编辑
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(p)}
                  className="rounded-md px-2.5 py-1.5 font-song text-[12px] text-inkFaint transition-colors hover:bg-accentSoft hover:text-cinnabarInk disabled:opacity-50"
                >
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

/* ── 局部件 ─────────────────────────────────────────────── */

const INPUT =
  "w-full rounded-md border border-lineInput bg-panelSolid px-3 py-2.5 font-kai text-[14px] text-ink transition-colors placeholder:text-inkFaint/70 focus:border-cinnabar/60";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between">
        <span className="font-song text-[13px] tracking-wider text-inkSoft">{label}</span>
        {hint && <span className="text-[12px] text-inkFaint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[100dvh]">
      <SiteBackground />
      <div className="relative z-10">
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-11">{children}</main>
      </div>
    </div>
  );
}

function Notice({
  title,
  body,
  primary,
  secondary,
}: {
  title: string;
  body: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <div className="paper-panel relative overflow-hidden px-6 py-10 text-center">
      <div className="pointer-events-none absolute inset-0 bamboo-veil opacity-[.3]" />
      <div className="relative">
        <h1 className="font-song text-[20px] tracking-[.1em] text-ink">{title}</h1>
        <p className="mx-auto mt-3 max-w-lg text-[13px] leading-[1.9] text-inkSoft">{body}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          <Link
            href={primary.href}
            className="inline-flex h-10 items-center rounded-md border border-transparent bg-cinnabar px-5 font-song text-[13px] tracking-wider text-white shadow-seal transition-all hover:brightness-110"
          >
            {primary.label}
          </Link>
          {secondary && (
            <Link
              href={secondary.href}
              className="inline-flex h-10 items-center rounded-md border border-lineStrong bg-panelSolid/60 px-5 font-song text-[13px] tracking-wider text-ink transition-colors hover:border-cinnabar/60 hover:bg-accentSoft"
            >
              {secondary.label}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
