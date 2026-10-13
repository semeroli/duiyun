import type { Metadata } from "next";
import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";
import SiteBackground from "@/components/SiteBackground";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "注册 · 对韵",
  description: "注册对韵账号，把喜欢的对联收藏到云端。不注册也能直接用对联工具。",
  robots: { index: false },
};

export default function RegisterPage() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col">
      <SiteBackground />
      <div className="relative z-10 flex min-h-[100dvh] flex-col">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center px-4 py-10">
          <Suspense fallback={<div className="h-[520px] w-full max-w-[420px] animate-pulse paper-panel" />}>
            <AuthForm mode="register" />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
