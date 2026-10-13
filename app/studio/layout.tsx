/**
 * /studio 的页面级元信息。
 * 页面本体是客户端组件（"use client"），不能在它自己的文件里导出 metadata，
 * 所以放在这一层 layout 里。
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "对联工作台 · 对韵",
  description: "输入上联，对出下联，并从平仄、词性、意境、典故四个维度逐层解析。免登录直接用。",
  alternates: { canonical: "/studio" },
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
