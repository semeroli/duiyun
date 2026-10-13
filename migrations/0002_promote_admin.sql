-- 把某个账号提升为管理员
-- ===================================================================
-- 用途：站点刚上线时，第一个管理员只能这样造出来（安全考虑：
--       注册接口永远只发 'user' 角色，不允许自己把自己变成管理员）。
--
-- 怎么用：
--   ① 先在网站上正常注册一个账号（/register），用你常用的邮箱；
--   ② 回来把下面那句里的邮箱换成你注册用的那个；
--   ③ 整段粘到 D1 控制台执行；
--   ④ 刷新页面，右上角头像菜单里就会出现「管理后台」。
--
-- ⚠️ 邮箱不区分大小写，写大写小写都能匹配上。
-- ===================================================================

UPDATE users SET role = 'admin' WHERE email = '把你注册用的邮箱写在这里';

-- 执行完用这句核对（应看到 role = admin）：
SELECT id, email, nickname, role, status FROM users ORDER BY id;

-- ───────────────────────────────────────────────────────────────────
-- 附带几条常用的后台操作（需要时再执行，平时不用管）
-- ───────────────────────────────────────────────────────────────────

-- 取消某人的管理员权限
-- UPDATE users SET role = 'user' WHERE email = 'xxx@example.com';

-- 封停某人的账号（他已有的登录态会立刻失效）
-- UPDATE users SET status = 'banned' WHERE email = 'xxx@example.com';
-- DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = 'xxx@example.com');

-- 忘记密码时：把 must_change_password 置 1，再手动设一个临时密码散列
-- （散列必须先在本机生成，不能手写。暂时没做这个工具，
--   最简单的办法是让用户重新注册一个账号，或者用下面这句直接删号重来）
-- DELETE FROM users WHERE email = 'xxx@example.com';

-- 清掉所有过期登录态（顺手做一次体检用）
-- DELETE FROM sessions WHERE expires_at < CAST(strftime('%s','now') AS INTEGER) * 1000;

-- 清掉限流计数（如果自己把自己限住了）
-- DELETE FROM rate_limits;
