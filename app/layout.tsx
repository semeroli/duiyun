import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  // 分享/收录用的绝对地址基准（不设的话 og:image 会变成 http://localhost:3000）
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://lwdy.de5.net"),
  title: "对韵 · 智能对联生成器",
  description:
    "面向学习与创作的中文对联辅助工具：输入上联，AI 对出下联，并从平仄、词性、意境、典故四个维度逐层解析。素雅文人风，开箱即用。",
  keywords: ["对联", "楹联", "对仗", "平仄", "春联", "传统文化", "语文教学", "AI 对联"],
  authors: [{ name: "对韵" }],
  // 图标：public/ 下的一整套（由 _icons/ 生成，改图标请改那边再重新渲染）
  //   favicon.svg  —— 矢量，浏览器标签页/书签优先用它
  //   favicon.ico  —— 16/32/48 三帧打包，老浏览器与「导航网站收录」抓的就是它
  //   后面几档 PNG —— 高分辨率屏、安卓桌面、iOS 主屏
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: [{ url: "/favicon.ico" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "对韵 · 智能对联生成器",
    description: "输入上联，对出下联，四维解析平仄 / 词性 / 意境 / 典故。",
    type: "website",
    siteName: "对韵",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "对韵 · 智能对联生成器" }],
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
