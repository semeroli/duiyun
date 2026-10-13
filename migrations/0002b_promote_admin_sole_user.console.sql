UPDATE users SET role = 'admin' WHERE id = (SELECT MIN(id) FROM users);
SELECT id, email, nickname, role, status FROM users ORDER BY id;
