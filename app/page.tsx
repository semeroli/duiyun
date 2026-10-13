import type { Metadata } from "next";
import Link from "next/link";
import LatestPosts from "@/components/LatestPosts";
import SiteBackground from "@/components/SiteBackground";
import SiteHeader from "@/components/SiteHeader";

/**
 * 落地页（首页）
 * ------------------------------------------------------------------
 * 信息层级照「大厂官网」那套来：
 *   主标题一句说清是什么 → 一句话说清凭什么 → 两个按钮分流
 *   → 上手看一眼真实效果 → 能力/体裁/数据 → 内容（博客）→ 常见问题 → 页脚
 * 但皮是国风的：宣纸底、宋体标题、朱红印章、竹帘纹。
 *
 * 这个页面**刻意做成纯静态**（不读数据库）：
 *   ① 首页是被人和搜索引擎打得最多的一页，静态 = 快 = 收录好；
 *   ② 数据库哪天出问题，首页也绝不能跟着白屏。
 * 博客最新几篇交给客户端小部件去取（见 LatestPosts），取不到就整块不显示。
 */

export const metadata: Metadata = {
  title: "对韵 · 智能对联生成器｜一句话对出下联，四维解析平仄词性意境典故",
  description:
    "输入上联，AI 对出下联，并从平仄、词性、意境、典故四个维度逐层解析。免登录开箱即用，内置 89 副名联与 1555 条对仗词表，是创作工具，也是讲对联的教具。",
  alternates: { canonical: "/" },
};

/* ── 内容数据（改文案只动这里）───────────────────────────── */

const CAPABILITIES = [
  {
    icon: "✍️",
    title: "一句话对出下联",
    body: "写下上联，最多给出三个候选。库里正好有原配的名联就优先给原句 —— 比如「此木为柴山山出」，机关只有一种对法，模型容易对歪，库里的答案才可靠。",
  },
  {
    icon: "🎼",
    title: "四维逐一拆解",
    body: "平仄、词性、意境、典故四条线分开讲。平仄永远由本地算法判定，不交给模型 —— 模型算错格律还会讲得头头是道，这是最要命的地方。",
  },
  {
    icon: "📖",
    title: "当教具也够用",
    body: "「学习模式」在侧栏铺开平仄规则与对仗词表，课堂上一个屏就能讲完对仗的五条要求。整页还能直接打印成讲解稿。",
  },
];

const KINDS = [
  { name: "传统对", desc: "按格律来，讲平仄相对、词性相合，用典讲出处。", tag: "最常用" },
  { name: "谐音对", desc: "声韵上做文章，借同音字翻转意思，适合灯谜与巧对。", tag: "有巧劲" },
  { name: "金句对", desc: "不拘古法，讲意思和气势对得上，适合标语、寄语、题目。", tag: "最自由" },
];

const STATS = [
  { n: "89", unit: "副", label: "逐条校对的名联" },
  { n: "178", unit: "句", label: "可集句的句库" },
  { n: "1555", unit: "条", label: "对仗词表" },
  { n: "0", unit: "门槛", label: "不登录也能用" },
];

const FAQ = [
  {
    q: "要注册才能用吗？",
    a: "不用。对联工具任何时候打开就能用，注册只多出两件事：收藏存在云端（换设备还在），以及能在博客文章下面留言。这条底线不会改。",
  },
  {
    q: "为什么有时候给的是现成句子，有时候是 AI 写的？",
    a: "候选右上角会标来源。① 内置语料 是你这句正好在名联库里，给的是原配，最可靠；② 集句 是取库里真实存在的句子，按平仄和词性配成对，句子一定通顺有出处，但意思未必和你的上联呼应，适合当格律范本；③ AI 生成 最贴题，需要站点接上模型服务。",
  },
  {
    q: "平仄是用什么韵？",
    a: "依古韵，并且带入了入声字修正（比如「一」「白」「竹」在普通话里平声，古韵里是仄声）。所以你会看到「一行白鹭上青天」标成仄声起 —— 这是对的，不是算错。",
  },
  {
    q: "收藏会丢吗？",
    a: "不登录时收藏存在你自己的浏览器里，换设备看不到、清浏览器数据会丢。登录之后才会同步到云端，两边都留一份。",
  },
];

/* ── 页面 ────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="relative min-h-[100dvh]">
      <SiteBackground />

      {/* 结构化数据：帮搜索引擎和导航站认出「这是一个在线工具」 */}
      <script
        type="application/ld+json"
        // 内容是我们自己写死的常量，不涉及用户输入，无注入风险
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "对韵 · 智能对联生成器",
            url: "https://lwdy.de5.net/",
            applicationCategory: "EducationalApplication",
            operatingSystem: "Web",
            inLanguage: "zh-CN",
            description:
              "输入上联，对出下联，并从平仄、词性、意境、典故四个维度逐层解析的中文对联辅助工具。",
            offers: { "@type": "Offer", price: "0", priceCurrency: "CNY" },
          }),
        }}
      />

      <div className="relative z-10">
        <SiteHeader />

        <main>
          {/* ── 主视觉 ───────────────────────────────── */}
          <section className="mx-auto max-w-6xl px-4 pb-6 pt-12 text-center md:px-6 md:pt-20">
            <div className="mb-5 flex items-center justify-center gap-3">
              <span className="h-[1px] w-8 bg-lineStrong" />
              <span className="font-song text-[12px] tracking-[.45em] text-inkFaint">对韵</span>
              <span className="h-[1px] w-8 bg-lineStrong" />
            </div>

            <h1 className="mx-auto max-w-3xl font-song text-[34px] leading-[1.25] tracking-[.06em] text-ink text-balance md:text-[56px] md:leading-[1.18]">
              写好一句上联，
              <br className="hidden md:block" />
              <span className="text-cinnabar">剩下的交给对韵</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-[14px] leading-[1.95] text-inkSoft md:text-[16px]">
              输入上联，为你对出下联，并从
              <span className="mx-0.5 text-cinnabar">平仄</span>、
              <span className="mx-0.5 text-cinnabar">词性</span>、
              <span className="mx-0.5 text-cinnabar">意境</span>、
              <span className="mx-0.5 text-cinnabar">典故</span>
              四个维度逐层拆开讲。既是创作工具，也是讲对联的教具。
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/studio"
                className="inline-flex h-12 items-center justify-center rounded-md border border-transparent bg-cinnabar px-7 font-song text-base tracking-wider text-white shadow-seal transition-all hover:brightness-110 hover:shadow-lift active:translate-y-[1px]"
              >
                免费开始对句
              </Link>
              <Link
                href="/blog"
                className="inline-flex h-12 items-center justify-center rounded-md border border-lineStrong bg-panelSolid/60 px-6 font-song text-base tracking-wider text-ink transition-colors hover:border-cinnabar/60 hover:bg-accentSoft active:translate-y-[1px]"
              >
                看对韵博客
              </Link>
            </div>
            <p className="mt-3.5 text-[12px] text-inkFaint">不用注册，不用装东西，打开就写。</p>

            {/* 真实效果示例（不是截图，是可读的对联本身） */}
            <ExampleCard />
          </section>

          {/* ── 能力 ─────────────────────────────────── */}
          <Section
            eyebrow="能做什么"
            title="不是随便凑一句，是讲得出道理的对句"
            sub="每一副都会说清「为什么这么对」。说不清道理的对句，只能算文字游戏。"
          >
            <div className="grid gap-4 md:grid-cols-3">
              {CAPABILITIES.map((c) => (
                <article key={c.title} className="paper-panel relative overflow-hidden p-5">
                  <div className="pointer-events-none absolute inset-0 bamboo-veil opacity-[.3]" />
                  <div className="relative">
                    <span aria-hidden className="text-2xl">
                      {c.icon}
                    </span>
                    <h3 className="mt-3 font-song text-lg tracking-wider text-ink">{c.title}</h3>
                    <p className="mt-2.5 text-[13px] leading-[1.9] text-inkSoft">{c.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </Section>

          {/* ── 三种体裁 ─────────────────────────────── */}
          <Section
            eyebrow="三种体裁"
            title="格律、巧劲、气势，各走各的路"
            sub="同一个上联，换个体裁就是另一种对法。工具里一键切换。"
          >
            <div className="grid gap-3 md:grid-cols-3">
              {KINDS.map((k) => (
                <div
                  key={k.name}
                  className="rounded-md border border-line bg-panelSolid/60 p-4 transition-colors hover:border-cinnabar/45"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-song text-[15px] tracking-[.16em] text-ink">{k.name}</h3>
                    <span className="rounded-full border border-cinnabar/40 bg-cinnabar/10 px-2 py-[2px] font-song text-[12px] text-cinnabarInk">
                      {k.tag}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] leading-[1.85] text-inkSoft">{k.desc}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* ── 数据底气 ─────────────────────────────── */}
          <Section eyebrow="底子" title="答案有出处，不是硬凑的" sub="">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {STATS.map((s) => (
                <div key={s.label} className="paper-panel px-4 py-5 text-center">
                  <div className="font-song text-[30px] leading-none text-cinnabar">
                    {s.n}
                    <span className="ml-0.5 text-[13px] text-inkFaint">{s.unit}</span>
                  </div>
                  <div className="mt-2 text-[12px] tracking-wide text-inkSoft">{s.label}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* ── 博客 ─────────────────────────────────── */}
          <Section
            eyebrow="对韵博客"
            title="从一副对联讲起"
            sub="讲格律、讲典故、讲怎么在课堂上用。写好了就会出现在这里。"
            right={
              <Link
                href="/blog"
                className="font-song text-[13px] tracking-wider text-cinnabar hover:underline"
              >
                看全部 →
              </Link>
            }
          >
            <LatestPosts limit={3} />
          </Section>

          {/* ── 常见问题 ─────────────────────────────── */}
          <Section eyebrow="常见问题" title="你可能想先问清楚" sub="">
            <div className="space-y-2.5">
              {FAQ.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-md border border-line bg-panelSolid/60 px-4 py-3.5 transition-colors open:border-cinnabar/40"
                >
                  <summary className="cursor-pointer list-none font-song text-[14px] tracking-wide text-ink marker:content-none">
                    <span className="mr-2 text-cinnabar">问</span>
                    {f.q}
                  </summary>
                  <p className="mt-3 border-t border-line pt-3 text-[13px] leading-[1.9] text-inkSoft">
                    {f.a}
                  </p>
                </details>
              ))}
            </div>
          </Section>

          {/* ── 收尾行动 ─────────────────────────────── */}
          <section className="mx-auto max-w-6xl px-4 pb-16 md:px-6">
            <div className="paper-panel relative overflow-hidden px-6 py-10 text-center md:py-14">
              <div className="pointer-events-none absolute inset-0 bamboo-veil opacity-[.32]" />
              <div className="relative">
                <h2 className="font-song text-[24px] leading-snug tracking-[.08em] text-ink md:text-[32px]">
                  临屏对句，落笔成联
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-[13px] leading-[1.9] text-inkSoft">
                  不用注册，不用装东西。写下你的上联，看看能对出什么。
                </p>
                <Link
                  href="/studio"
                  className="mt-6 inline-flex h-12 items-center justify-center rounded-md border border-transparent bg-cinnabar px-7 font-song text-base tracking-wider text-white shadow-seal transition-all hover:brightness-110 hover:shadow-lift"
                >
                  进入对联工作台
                </Link>
              </div>
            </div>
          </section>
        </main>

        <SiteFooter />
      </div>
    </div>
  );
}

/* ── 局部组件 ────────────────────────────────────────────── */

function Section({
  eyebrow,
  title,
  sub,
  right,
  children,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-9 md:px-6 md:py-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-song text-[12px] tracking-[.38em] text-cinnabar">{eyebrow}</div>
          <h2 className="mt-2 font-song text-[22px] leading-snug tracking-[.08em] text-ink md:text-[28px]">
            {title}
          </h2>
          {sub && <p className="mt-2 max-w-2xl text-[13px] leading-[1.9] text-inkSoft">{sub}</p>}
        </div>
        {right}
      </div>
      <div className="divider-brush mb-6" />
      {children}
    </section>
  );
}

/** 首页那张「看一眼就懂」的示范卡：内容是写死的名句，不用等接口 */
function ExampleCard() {
  return (
    <div className="mx-auto mt-12 max-w-3xl text-left">
      <div className="paper-panel relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bamboo-veil opacity-[.28]" />
        <div className="relative px-5 py-6 md:px-8 md:py-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-song text-[12px] tracking-[.3em] text-inkFaint">示范一副</span>
            <span className="rounded-full border border-okInk/40 bg-okInk/[.08] px-2 py-[2px] font-song text-[12px] text-okInk">
              内置语料 · 原配
            </span>
          </div>

          <div className="mt-5 space-y-3 text-center">
            <div>
              <div className="mb-1 font-song text-[12px] tracking-[.3em] text-inkFaint">上联</div>
              <p className="font-song text-[22px] leading-relaxed tracking-[.22em] text-ink md:text-[28px]">
                两个黄鹂鸣翠柳
              </p>
            </div>
            <div className="mx-auto h-[1px] w-16 bg-lineStrong" />
            <div>
              <div className="mb-1 font-song text-[12px] tracking-[.3em] text-cinnabar">下联</div>
              <p className="font-song text-[22px] leading-relaxed tracking-[.22em] text-ink md:text-[28px]">
                一行白鹭上青天
              </p>
            </div>
          </div>

          <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
            {[
              { k: "平仄", v: "仄仄平平平仄仄 ／ 平平仄仄仄平平（依古韵，「一」「白」为入声，算仄）" },
              { k: "词性", v: "两个／一行（数量）、黄鹂／白鹭（名）、鸣／上（动）、翠／青（形）、柳／天（名）" },
              { k: "意境", v: "有声有色、由近及远。上联写枝头生机，下联写天际高远，一低一高成势。" },
              { k: "典故", v: "出自杜甫《绝句》。诗人一句一景，四句四幅画，此为前两句。" },
            ].map((row) => (
              <div key={row.k} className="rounded-md border border-line bg-panelSolid/70 px-3.5 py-3">
                <div className="font-song text-[12px] tracking-[.24em] text-cinnabar">{row.k}</div>
                <p className="mt-1.5 text-[13px] leading-[1.85] text-inkSoft">{row.v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-[12px] text-inkFaint">
        ↑ 这就是工具里的输出样式。换成你的上联，四个维度照样一条条讲给你。
      </p>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-line bg-panelSolid/50">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-9 text-center md:px-6">
        <div className="flex items-center gap-3">
          <span className="h-[1px] w-8 bg-line" />
          <span
            className="seal-face flex h-[42px] w-[42px] items-center justify-center rounded-[5px] font-song text-[15px]"
            style={{ transform: "rotate(-9deg)" }}
            aria-hidden
          >
            对韵
          </span>
          <span className="h-[1px] w-8 bg-line" />
        </div>
        <p className="text-[12px] leading-relaxed text-inkFaint">
          对韵 · 智能对联生成器 ｜ 平仄依古韵（含入声字修正），词性依常用对仗词表
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {[
            { href: "/studio", label: "对联工作台" },
            { href: "/blog", label: "对韵博客" },
            { href: "/login", label: "登录" },
            { href: "/register", label: "注册" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-song text-[12px] tracking-wider text-inkSoft transition-colors hover:text-cinnabar"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
