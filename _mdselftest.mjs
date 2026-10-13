/**
 * lib/markdown.ts 的离线自测
 * ------------------------------------------------------------------
 * 这个模块是纯函数、零依赖，所以能直接用 node 跑（Node 22 自带 TS 类型擦除）。
 * 不用起整个站点，改一行正则就能立刻验证。
 *   node _mdselftest.mjs
 */

const { renderMarkdown } = await import("./lib/markdown.ts");

const cases = [
  {
    name: "常规语法",
    md: "# 大标题\n\n正文**加粗**、*着重*、~~删除~~、`代码`。\n\n- 甲\n- 乙\n\n1. 一\n2. 二\n\n> 引用\n\n---\n",
    must: ["<h2>大标题</h2>", "<strong>加粗</strong>", "<em>着重</em>", "<del>删除</del>", "<code>代码</code>", "<ul class=\"md-list\">", "<ol class=\"md-list\">", "md-quote", "md-hr"],
  },
  {
    name: "带括号的合法链接（之前会被截断）",
    md: "看[对联通论](https://zh.wikipedia.org/wiki/对联_(文学))吧。",
    must: ["href=\"https://zh.wikipedia.org/wiki/对联_(文学)\"", ">对联通论</a>"],
  },
  {
    name: "javascript: 链接降级成纯文字",
    md: "点击 [这个链接](javascript:alert(1)) 结束。",
    must: ["点击 这个链接 结束。"],
    mustNot: ["href=\"javascript:", "这个链接)"],
  },
  {
    name: "HTML 被整段转义",
    md: "<script>alert('x')</script>\n\n<img src=x onerror=alert(1)>\n",
    must: ["&lt;script&gt;", "&lt;img src=x onerror=alert(1)&gt;"],
    mustNot: ["<script>", "<img src=x"],
  },
  {
    name: "代码块原样保留且转义",
    md: "```js\nconst a = 1 < 2;\n```\n",
    must: ["md-pre", "const a = 1 &lt; 2;"],
  },
  {
    name: "图片只放行 https",
    md: "![图](http://a.com/x.png) ![坏](javascript:alert(1))",
    must: ["src=\"http://a.com/x.png\""],
    mustNot: ["md-img\" alt=\"坏"],
  },
];

let bad = 0;
for (const c of cases) {
  const html = renderMarkdown(c.md);
  const miss = (c.must ?? []).filter((s) => !html.includes(s));
  const hit = (c.mustNot ?? []).filter((s) => html.includes(s));
  const pass = !miss.length && !hit.length;
  if (!pass) bad++;
  console.log(`${pass ? "✅" : "❌"} ${c.name}`);
  if (miss.length) console.log(`     缺少: ${JSON.stringify(miss)}`);
  if (hit.length) console.log(`     不该有: ${JSON.stringify(hit)}`);
}

console.log(bad === 0 ? "\n全部通过" : `\n${bad} 项未通过`);
process.exit(bad === 0 ? 0 : 1);
