// 生成单文件预览页 _icons/preview.html（图片全部内嵌，可直接打开/分享）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONCEPTS } from "./icons.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "out");
const IDS = ["A", "B", "C", "D"];
const INSTALLED = process.env.INSTALLED_ID || "A";

const b64 = (p) => fs.readFileSync(p).toString("base64");
const uri = (id, name) => `data:image/png;base64,${b64(path.join(OUT, id, name))}`;
const svgUri = (id) => `data:image/svg+xml;base64,${Buffer.from(fs.readFileSync(path.join(OUT, id, "favicon.svg"), "utf8")).toString("base64")}`;

const card = (id) => {
  const c = CONCEPTS[id];
  const isPick = id === INSTALLED;
  return `
  <section class="card${isPick ? " pick" : ""}">
    ${isPick ? `<div class="badge">已装到项目里</div>` : `<div class="badge ghost">备选</div>`}
    <div class="row">
      <img class="big" src="${uri(id, "icon-512.png")}" alt="${c.name}" width="132" height="132" />
      <div class="txt">
        <h3>${id} · ${c.name}</h3>
        <p class="tag">${c.tag}</p>
        <p class="desc">${c.desc}</p>
      </div>
    </div>

    <div class="label">真实尺寸（不是放大图）</div>
    <div class="sizes">
      <figure><img src="${uri(id, "favicon-16x16.png")}" width="16" height="16" alt="16" /><figcaption>16px<br><span>标签页</span></figcaption></figure>
      <figure><img src="${uri(id, "favicon-32x32.png")}" width="32" height="32" alt="32" /><figcaption>32px<br><span>书签栏</span></figcaption></figure>
      <figure><img src="${uri(id, "favicon-48x48.png")}" width="48" height="48" alt="48" /><figcaption>48px<br><span>桌面快捷</span></figcaption></figure>
    </div>

    <div class="label">在浏览器标签页上（浅色 / 深色）</div>
    <div class="tabs">
      <div class="tabbar light"><div class="tab active"><img src="${uri(id, "favicon-16x16.png")}" width="16" height="16" alt="" /><span>对韵 · 智能对联生成器</span><b>×</b></div><div class="tab"><span>新标签页</span></div></div>
      <div class="tabbar dark"><div class="tab active"><img src="${uri(id, "favicon-16x16.png")}" width="16" height="16" alt="" /><span>对韵 · 智能对联生成器</span><b>×</b></div><div class="tab"><span>新标签页</span></div></div>
    </div>
  </section>`;
};

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>对韵 · 图标设计</title>
<link rel="icon" href="${svgUri(INSTALLED)}" />
<style>
  :root{
    --paper:#FAF7F2; --ink:#1F1A15; --ink2:#6B5F52; --ink3:#96897A;
    --seal:#A8271C; --gold:#B08D4F; --line:#E6DDCF; --card:#fff;
  }
  *{box-sizing:border-box}
  body{
    margin:0; padding:40px 20px 64px; background:var(--paper); color:var(--ink);
    font-family:"Noto Serif SC","Songti SC","SimSun",Georgia,serif; line-height:1.7;
  }
  .wrap{max-width:860px;margin:0 auto}
  header{text-align:center;padding-bottom:26px;border-bottom:2px solid var(--ink);margin-bottom:30px}
  h1{font-size:30px;margin:0 0 8px;letter-spacing:.12em}
  h1 em{font-style:normal;color:var(--seal)}
  header p{margin:0;color:var(--ink2);font-size:14px}
  .note{background:#fff;border:1px solid var(--line);border-left:4px solid var(--seal);padding:14px 18px;margin:0 0 30px;font-size:14px;color:var(--ink2)}
  .note b{color:var(--ink)}
  h2{font-size:17px;margin:38px 0 16px;padding-left:12px;border-left:4px solid var(--seal);letter-spacing:.06em}
  .card{position:relative;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:22px 24px 20px;margin-bottom:20px}
  .card.pick{border-color:var(--seal);box-shadow:0 6px 22px rgba(168,39,28,.10)}
  .badge{position:absolute;top:-11px;right:18px;background:var(--seal);color:#fff;font-size:12px;padding:2px 12px;border-radius:999px;letter-spacing:.08em}
  .badge.ghost{background:#EDE6DA;color:var(--ink3)}
  .row{display:flex;gap:22px;align-items:flex-start}
  .big{border-radius:22px;flex:0 0 auto}
  .txt h3{margin:2px 0 4px;font-size:19px;letter-spacing:.04em}
  .tag{display:inline-block;margin:0 0 8px;font-size:12px;color:var(--seal);border:1px solid #E7C9C4;border-radius:999px;padding:1px 10px}
  .desc{margin:0;font-size:14px;color:var(--ink2)}
  .label{margin:18px 0 10px;font-size:12px;color:var(--ink3);letter-spacing:.1em}
  .sizes{display:flex;gap:34px;align-items:flex-end}
  .sizes figure{margin:0;text-align:center}
  .sizes img{display:block;margin:0 auto 8px;image-rendering:pixelated}
  .sizes figcaption{font-size:12px;color:var(--ink2)}
  .sizes figcaption span{color:var(--ink3);font-size:11px}
  .tabs{display:flex;flex-direction:column;gap:10px}
  .tabbar{display:flex;gap:4px;padding:8px 8px 0;border-radius:10px 10px 0 0;align-items:flex-end}
  .tabbar.light{background:#DEDAD4}
  .tabbar.dark{background:#202124}
  .tab{display:flex;align-items:center;gap:7px;padding:7px 12px;border-radius:9px 9px 0 0;font-size:12px;max-width:270px;color:#8a8378}
  .tabbar.dark .tab{color:#9aa0a6}
  .tab.active{background:var(--paper);color:var(--ink)}
  .tabbar.dark .tab.active{background:#35363a;color:#e8eaed}
  .tab img{border-radius:3px}
  .tab span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tab b{margin-left:auto;font-weight:400;opacity:.5}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .panel{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px 18px;font-size:13px;color:var(--ink2)}
  .panel b{color:var(--ink);display:block;margin-bottom:6px;font-size:14px}
  .navcard{display:flex;gap:12px;align-items:center;background:#fff;border:1px solid var(--line);border-radius:10px;padding:12px 14px}
  .navcard img{border-radius:8px}
  .navcard .t{font-size:14px;color:var(--ink)}
  .navcard .u{font-size:12px;color:var(--ink3)}
  .home{display:flex;gap:26px;align-items:center;flex-wrap:wrap}
  .phone{width:118px}
  .phone img{width:96px;height:96px;border-radius:22px;display:block;box-shadow:0 8px 20px rgba(0,0,0,.18)}
  .phone .n{font-size:12px;color:var(--ink2);text-align:center;margin-top:8px}
  code{background:#F3EEE6;border:1px solid var(--line);border-radius:5px;padding:1px 6px;font-size:12.5px;font-family:Consolas,Monaco,monospace;color:#5A4A38}
  table{width:100%;border-collapse:collapse;font-size:13.5px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line)}
  th{color:var(--ink3);font-weight:400;font-size:12px;letter-spacing:.08em}
  footer{margin-top:40px;padding-top:18px;border-top:1px solid var(--line);text-align:center;font-size:12.5px;color:var(--ink3)}
  @media print{body{padding:0} .card{break-inside:avoid}}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>对韵 · <em>图标设计</em></h1>
    <p>四套国风方案 · 同一套「朱砂 / 墨 / 米白」配色 · 汉字全部转成矢量路径</p>
  </header>

  <div class="note">
    <b>先说三件已经办好的事：</b>① 图标不是「画一张图」，而是<b>一整套</b>十个文件（标签页、书签、手机桌面、导航站收录各用不同尺寸）；
    ② 汉字用<b>真实字体轮廓转成路径</b>写进 SVG——你给的那份参考代码用的是 <code>&lt;text&gt;</code> 加字体回退，
    服务器和导航站抓取时字可能变形甚至不显示，这个不会；
    ③ 方案 <b>${INSTALLED}</b> 已经装进项目并本地验证通过（下面每个方案的实尺寸图都是真渲染出来的，不是放大图）。
  </div>

  <h2>四套方案</h2>
  ${IDS.map(card).join("")}

  <h2>收录 / 分享时长什么样</h2>
  <div class="grid2">
    <div class="panel"><b>导航网站收录卡片</b>
      <div class="navcard">
        <img src="${uri(INSTALLED, "favicon-48x48.png")}" width="48" height="48" alt="" />
        <div><div class="t">对韵 · 智能对联生成器</div><div class="u">lwdy.de5.net</div></div>
      </div>
      <p style="margin:10px 0 0">收录站抓的是网站根目录的 <code>/favicon.ico</code>——这一条已经放好了，而且里面装了 16 / 32 / 48 三档。</p>
    </div>
    <div class="panel"><b>手机桌面 / 苹果主屏</b>
      <div class="home">
        <div class="phone"><img src="${uri(INSTALLED, "icon-192.png")}" alt="" /><div class="n">对韵</div></div>
        <div style="flex:1;min-width:150px">
          <p style="margin:0">安卓桌面用 192/512 的大图，苹果主屏用 <code>apple-touch-icon.png</code>（180px）。</p>
          <p style="margin:8px 0 0">另外还出了一版 <b>满幅底</b>的 <code>icon-maskable-512.png</code>，好让安卓把它裁成圆形/方形都不露白边。</p>
        </div>
      </div>
    </div>
  </div>

  <h2>一共生成了哪些文件</h2>
  <table>
    <tr><th>文件</th><th>用在哪</th></tr>
    <tr><td><code>favicon.svg</code></td><td>矢量图，现代浏览器标签页 / 书签优先用它</td></tr>
    <tr><td><code>favicon.ico</code></td><td>里面打包了 16 / 32 / 48 三档；<b>导航站收录抓的就是它</b></td></tr>
    <tr><td><code>favicon-16x16.png</code> <code>favicon-32x32.png</code> <code>favicon-48x48.png</code></td><td>标签页、书签栏、桌面快捷</td></tr>
    <tr><td><code>apple-touch-icon.png</code></td><td>iPhone / iPad 添加到主屏</td></tr>
    <tr><td><code>icon-192.png</code> <code>icon-512.png</code></td><td>安卓桌面、分享卡片</td></tr>
    <tr><td><code>icon-maskable-512.png</code></td><td>安卓自适应图标（满幅底，不被裁出白边）</td></tr>
    <tr><td><code>site.webmanifest</code></td><td>装成 App 用；站名「对韵」、背景宣纸白</td></tr>
  </table>

  <footer>
    生成脚本在项目里的 <code>_icons/</code>：改配色或换字只需动 <code>icons.mjs</code>，再跑一次就行。<br>
    想换方案：<code>node _icons/build-icons.mjs --install B</code>（把 B 换成 A/B/C/D 任一）。
  </footer>
</div>
</body>
</html>`;

fs.writeFileSync(path.join(HERE, "preview.html"), html, "utf8");
console.log(`preview.html 已生成（${(Buffer.byteLength(html) / 1024).toFixed(0)} KB），当前标记为「已装进项目」的是方案 ${INSTALLED}`);
