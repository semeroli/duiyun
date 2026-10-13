import Link from "next/link";

/**
 * 404 页
 * ------------------------------------------------------------------
 * 用 Next 默认那套会很跳（纯英文白底），所以自己写一个：
 * 说清「这一页没有了」，并给三条能走的路。
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col items-center justify-center px-4 text-center">
      <div className="font-song text-[11px] tracking-[.45em] text-inkFaint">四〇四</div>
      <h1 className="mt-4 font-song text-[30px] leading-snug tracking-[.08em] text-ink md:text-[40px]">
        这一页找不到了
      </h1>
      <p className="mt-4 max-w-md text-[13.5px] leading-[1.9] text-inkSoft">
        可能是网址抄错了一个字，也可能是这篇文章已经下架。下面三条路都能走回正轨。
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-2.5">
        <Link
          href="/studio"
          className="inline-flex h-11 items-center rounded-md border border-transparent bg-cinnabar px-6 font-song text-[14px] tracking-wider text-white shadow-seal transition-all hover:brightness-110"
        >
          去对联工作台
        </Link>
        <Link
          href="/blog"
          className="inline-flex h-11 items-center rounded-md border border-lineStrong bg-panelSolid/60 px-5 font-song text-[14px] tracking-wider text-ink transition-colors hover:border-cinnabar/60 hover:bg-accentSoft"
        >
          看对韵博客
        </Link>
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-md border border-transparent px-5 font-song text-[14px] tracking-wider text-inkFaint transition-colors hover:bg-accentSoft hover:text-ink"
        >
          回首页
        </Link>
      </div>
    </div>
  );
}
