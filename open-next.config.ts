// 对韵 · OpenNext for Cloudflare 配置
// ---------------------------------------------------------------
// 官方模板默认启用了 R2 做「增量缓存」，那是给有 ISR / 动态缓存的站点用的。
// 对韵首页是构建期就定死的静态页，/api/generate 每次都要实时调用 AI，
// 全程用不到增量缓存 —— 所以这里保持空配置，**不用创建 R2 桶**。
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
