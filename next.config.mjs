/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  // 线上部署时用 `node server.js` 直接起，不依赖 npm start 的参数拼接
  output: process.env.NEXT_OUTPUT_STANDALONE === "1" ? "standalone" : undefined,
  experimental: {
    // html-to-image / pinyin-pro 都是纯前端包，保持默认打包即可
    optimizePackageImports: ["framer-motion"],
  },
};

export default nextConfig;
