-- 对韵 · 数据库结构 v1
-- ===================================================================
-- 用途：Cloudflare D1（SQLite）
-- 执行：Cloudflare 控制台 → 存储和数据库 → D1 → 选库 → 控制台(Query) → 整段粘进去执行
-- 说明：只在第一次建库时执行一次。重复执行会报「表已存在」，属正常。
--
-- 🔴 这一份是「给人读的」，带注解，**不要直接往控制台粘**！
--    控制台粘贴时换行有可能丢失，整段被压成一行；而 SQLite 的行注解
--    `--` 会吃掉「本行剩余全部内容」⇒ 注解后面那句 CREATE TABLE 就成了
--    半句，报 `incomplete input: SQLITE_ERROR`。
--    往控制台粘请用 → migrations/0001_init.console.sql（全篇无注解）。
--    两个文件必须同步改：改完结构两处都要动。
--    这个坑有可复现的实验记录，见仓库根目录 _sqlcheck.mjs。
-- ===================================================================

-- 外键约束：D1 默认就是开启的，这里无需再执行 PRAGMA
-- （下面这行故意注释掉：D1 控制台里执行 PRAGMA 有可能报错，会打断整段粘贴）
-- PRAGMA foreign_keys = ON;

-- ─────────────────────────────── 用户 ───────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  email                TEXT    NOT NULL COLLATE NOCASE,        -- 登录名，唯一（大小写不敏感）
  nickname             TEXT    NOT NULL,                        -- 显示名
  -- 密码散列，格式： pbkdf2$迭代次数$salt(base64)$hash(base64)
  -- 绝不存在明文；散列参数写在串里，将来升级迭代次数不用改表
  password_hash        TEXT    NOT NULL,
  role                 TEXT    NOT NULL DEFAULT 'user',         -- 'user' | 'admin'
  status               TEXT    NOT NULL DEFAULT 'active',       -- 'active' | 'banned'
  must_change_password INTEGER NOT NULL DEFAULT 0,              -- 1 = 下次登录必须改密（管理员重置后用）
  created_at           INTEGER NOT NULL,                        -- Unix 毫秒
  last_login_at        INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ─────────────────────────────── 会话 ───────────────────────────────
-- 只存 token 的 SHA-256，泄漏库也拿不到可用 cookie
CREATE TABLE IF NOT EXISTS sessions (
  token_hash   TEXT    PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  user_agent   TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ─────────────────────────────── 文章 ───────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT    NOT NULL,                                -- 网址标识，如 yinlian-rumen
  title        TEXT    NOT NULL,
  summary      TEXT,                                            -- 列表页摘要
  content_md   TEXT    NOT NULL DEFAULT '',                     -- Markdown 正文
  tags         TEXT    NOT NULL DEFAULT '',                     -- 逗号分隔
  status       TEXT    NOT NULL DEFAULT 'draft',                -- 'draft' | 'published'
  author_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  published_at INTEGER,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  view_count   INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_slug   ON posts(slug);
CREATE INDEX        IF NOT EXISTS idx_posts_listed ON posts(status, published_at DESC);

-- ─────────────────────────────── 评论 ───────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL REFERENCES posts(id)    ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  parent_id  INTEGER REFERENCES comments(id)          ON DELETE CASCADE,  -- 两级回复
  content    TEXT    NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'visible',                 -- 'visible' | 'hidden'
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);

-- ─────────────────────────── 云端收藏（与浏览器本地收藏对应）────────
CREATE TABLE IF NOT EXISTS favorites (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_key   TEXT    NOT NULL,        -- 去重键：upper|lower|kind 的 sha256
  data       TEXT    NOT NULL,        -- 原 FavoriteItem 的 JSON（含 AI 写的解析，原样存）
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, item_key)
);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id, created_at DESC);

-- ─────────────────────────── 生成历史 ───────────────────────────
CREATE TABLE IF NOT EXISTS histories (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  upper        TEXT    NOT NULL,
  kind         TEXT    NOT NULL,
  picked_lower TEXT,                  -- 用户最终选用的下联（可为空）
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_histories_user ON histories(user_id, created_at DESC);

-- ─────────────────────────── 限流（防刷）───────────────────────────
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket       TEXT    PRIMARY KEY,   -- 如 'login:email:xx@yy.com'
  count        INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);

-- ─────────────────────────── 结构版本 ───────────────────────────
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR REPLACE INTO meta(key, value) VALUES ('schema_version', '1');
