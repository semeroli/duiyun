import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "对韵 · 智能对联生成器",
  description:
    "面向学习与创作的中文对联辅助工具：输入上联，AI 对出下联，并从平仄、词性、意境、典故四个维度逐层解析。素雅文人风，开箱即用。",
  keywords: ["对联", "楹联", "对仗", "平仄", "春联", "传统文化", "语文教学", "AI 对联"],
  authors: [{ name: "对韵" }],
  openGraph: {
    title: "对韵 · 智能对联生成器",
    description: "输入上联，对出下联，四维解析平仄 / 词性 / 意境 / 典故。",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF7F2" },
    { media: "(prefers-color-scheme: dark)", color: "#171310" },
  ],
};

/**
 * 主题在首屏渲染前就从 localStorage 读出来，避免「先亮后暗」的闪白。
 * 这段脚本必须内联（不能放到客户端组件里），否则会晚一帧。
 */
const THEME_BOOTSTRAP = `(function(){try{
var s=JSON.parse(localStorage.getItem('duiyun:settings:v1')||'{}');
if(s&&s.theme){document.documentElement.setAttribute('data-theme',s.theme);}
}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" data-theme="silk" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* 标题：思源宋体 / Noto Serif SC */}
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* 正文：霞鹜文楷 LXGW WenKai（拿不到时自动退到系统楷体） */}
        <link
          href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/style.css"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
