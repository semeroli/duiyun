/**
 * Markdown → HTML（安全子集，服务端专用）
 * ==================================================================
 * 为什么不装 marked / remark：
 *   ① 那类库默认允许裸 HTML，直接 dangerouslySetInnerHTML 就是 XSS 入口，
 *      要安全就得再引一套 sanitize（DOMPurify 之流），依赖越滚越多；
 *   ② 博客只给自己人写，需要的语法就那么几种。
 * 所以这里**先整段转义，再识别语法** —— 转义在前 ⇒ 原文里写什么标签都只会
 * 显示成文字，安全是结构上保证的，不靠过滤器兜底。
 *
 * 支持的语法（够写教学文章）：
 *   # ## ### 标题（渲染成 h2/h3/h4，h1 留给文章标题本身）
 *   **粗** *斜* ~~删除线~~ `行内代码`
 *   - 无序列表 / 1. 有序列表 / > 引用 / --- 分隔线
 *   ```代码块``` / [文字](链接) / ![说明](https://图片地址)
 *
 * 不支持表格、脚注、任务列表 —— 需要时再加，别为了「像 Markdown」把面铺太开。
 */

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** 只放行这四种链接，其余一律变成 #（挡掉 `javascript:` 这类） */
function safeUrl(url: string): string | null {
  if (/^https?:\/\//i.test(url)) return url;
  if (/^mailto:/i.test(url)) return url;
  if (/^\/(?!\/)/.test(url)) return url; // 站内绝对路径
  if (url.startsWith("#")) return url;
  return null;
}

function inline(text: string): string {
  let s = text;

  // 行内代码先抽走，避免里面的 * 和 _ 被当成强调
  const codes: string[] = [];
  s = s.replace(/`([^`]+)`/g, (_m, c: string) => {
    codes.push(c);
    return `\u0000${codes.length - 1}\u0000`;
  });

  // 地址允许带一层括号 —— 否则维基那种 `.../对联_(文学)` 会被第一个 ) 截断，
  // 而 `javascript:alert(1)` 这种又会被切出个孤零零的右括号留在正文里。
  const URL_PART = "((?:[^()\\s]|\\([^()\\s]*\\))+)";

  // 图片要在链接之前处理，否则 ![]() 会被链接规则吃掉前半截
  s = s.replace(
    new RegExp(`!\\[([^\\]]*)\\]\\(${URL_PART}\\)`, "g"),
    (m, alt: string, url: string) => {
      const u = safeUrl(url);
      if (!u || !/^https?:\/\//i.test(u)) return m;
      return `<img src="${u}" alt="${alt}" loading="lazy" class="md-img" />`;
    }
  );

  s = s.replace(new RegExp(`\\[([^\\]]+)\\]\\(${URL_PART}\\)`, "g"), (m, label: string, url: string) => {
    const u = safeUrl(url);
    if (!u) return label;
    const ext = /^https?:\/\//i.test(u) ? ' target="_blank" rel="noopener noreferrer nofollow"' : "";
    return `<a href="${u}"${ext}>${label}</a>`;
  });

  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  // 单星号强调：前后不能紧挨字母/星号，避免 * 号在数学式里乱配
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?=[^*\w]|$)/g, "$1<em>$2</em>");

  s = s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => `<code>${codes[Number(i)]}</code>`);
  return s;
}

export function renderMarkdown(md: string): string {
  const src = escapeHtml((md || "").replace(/\r\n?/g, "\n"));
  const lines = src.split("\n");
  const out: string[] = [];
  let para: string[] = [];

  const flush = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(" "))}</p>`);
      para = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ── 代码块 ``` ──
    const fence = /^```\s*([a-z0-9+#-]*)\s*$/i.exec(line);
    if (fence) {
      flush();
      const lang = fence[1];
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      out.push(
        `<pre class="md-pre"><code${lang ? ` class="lang-${lang}"` : ""}>${buf.join("\n")}</code></pre>`
      );
      continue;
    }

    // ── 空行 ──
    if (!line.trim()) {
      flush();
      continue;
    }

    // ── 分隔线 ──
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      flush();
      out.push('<hr class="md-hr" />');
      continue;
    }

    // ── 标题（# → h2，因为 h1 留给文章标题）──
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      const level = Math.min(5, h[1].length + 1);
      out.push(`<h${level}>${inline(h[2].trim())}</h${level}>`);
      continue;
    }

    // ── 引用 ──
    if (/^&gt;\s?/.test(line)) {
      flush();
      const buf: string[] = [];
      while (i < lines.length && /^&gt;\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^&gt;\s?/, ""));
        i++;
      }
      i--;
      out.push(`<blockquote class="md-quote">${inline(buf.join(" "))}</blockquote>`);
      continue;
    }

    // ── 列表（连续同类项才并成一张表）──
    const ul = /^[-*]\s+(.*)$/.exec(line);
    const ol = /^\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      flush();
      const ordered = !!ol;
      const items: string[] = [];
      while (i < lines.length) {
        const m = ordered ? /^\d+[.)]\s+(.*)$/.exec(lines[i]) : /^[-*]\s+(.*)$/.exec(lines[i]);
        if (!m) break;
        items.push(`<li>${inline(m[1])}</li>`);
        i++;
      }
      i--;
      out.push(`<${ordered ? "ol" : "ul"} class="md-list">${items.join("")}</${ordered ? "ol" : "ul"}>`);
      continue;
    }

    // ── 普通段落 ──
    para.push(line.trim());
  }

  flush();
  return out.join("\n");
}

/** 从正文里截一段纯文字当摘要（列表页/分享卡片用） */
export function excerpt(md: string, len = 90): string {
  const plain = (md || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*`~_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > len ? `${plain.slice(0, len)}…` : plain;
}
