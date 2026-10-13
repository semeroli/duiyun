import type { Metadata } from "next";
import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";
import SiteBackground from "@/components/SiteBackground";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "登录 · 对韵",
  description: "登录对韵，把收藏与生成历史存到云端。不登录也能直接用对联工具。",
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col">
      <SiteBackground />
      <div className="relative z-10 flex min-h-[100dvh] flex-col">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center px-4 py-10">
          {/* AuthForm 里用了 useSearchParams 读 ?next=，必须包一层 Suspense，
              否则 Next 在构建时会因为「无法静态预渲染」直接失败 */}
          <Suspense fallback={<div className="h-[420px] w-full max-w-[420px] animate-pulse paper-panel" />}>
            <AuthForm mode="login" />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
