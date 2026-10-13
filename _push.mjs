// 推送 main 到 GitHub。token 从 ~/.git-credentials 里取，绝不打印到终端。
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const credPath = process.env.USERPROFILE + "/.git-credentials";
const raw = readFileSync(credPath, "utf8");
const list = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
let token = "";
for (const line of list) {
  const m = line.match(/^https:\/\/([^:]+):([^@]+)@github\.com/);
  if (m) token = m[2];
}
if (!token) {
  console.error("没在 .git-credentials 里找到 github.com 的凭据");
  process.exit(2);
}
console.log("找到凭据，长度 =", token.length);

const cwd = "D:/WorkBuddykongjian2026/duiyun";
const url = `https://x-access-token:${token}@github.com/semeroli/duiyun.git`;

function run(args) {
  try {
    const out = execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout || "") + (e.stderr || "") };
  }
}

function scrub(s) {
  return String(s).split(token).join("***");
}

const head = run(["rev-parse", "HEAD"]).out.trim();
console.log("本地 HEAD =", head);

const push = run(["-c", "credential.helper=", "push", url, "refs/heads/main:refs/heads/main"]);
console.log("--- push 输出 ---");
console.log(scrub(push.out) || "(空)");
console.log("push 退出码 =", push.code);

const ls = run(["ls-remote", url, "refs/heads/main"]);
const line = scrub(ls.out).trim();
console.log("--- 远端核对 ---");
console.log(line || "(空)");
const remoteSha = (line.split(/\s+/)[0] || "");
console.log("远端 HEAD =", remoteSha);
console.log("一致吗 =", remoteSha === head ? "✅ 一致" : "❌ 不一致");
