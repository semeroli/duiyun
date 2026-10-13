import type { MetadataRoute } from "next";

/**
 * robots.txt
 * ------------------------------------------------------------------
 * 后台、账号页、接口一律不许抓 —— 后台被搜索引擎收录是纯粹的麻烦。
 * 站点地图指向 /sitemap.xml（见 app/sitemap.ts）。
 */

const BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://lwdy.de5.net").replace(/\/+$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/login", "/register"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
