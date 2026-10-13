/**
 * 网址片段解码（安全版）
 * ------------------------------------------------------------------
 * Next.js 给的动态段 params 通常**已经解码过**，再 decodeURIComponent 一次
 * 对普通字符串是无害的空操作；但如果 slug 里真带着一个裸露的 `%`
 * （作者手填的），decodeURIComponent 会直接抛 URIError，整页 500。
 * 所以这里包一层：解不开就原样返回，绝不因为一个网址去炸掉页面。
 */
export function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
