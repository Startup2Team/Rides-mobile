const fs = require("node:fs");

for (const file of ["package-lock.json", "yarn.lock"]) {
  fs.rmSync(file, { force: true });
}

const userAgent = process.env.npm_config_user_agent || "";
const execPath = process.env.npm_execpath || "";
const isPnpm =
  userAgent.startsWith("pnpm/") ||
  /(?:^|[\\/])pnpm(?:[\\/]|\.c?js$|\.mjs$)/i.test(execPath);

if (!isPnpm) {
  console.error("Use pnpm instead");
  process.exit(1);
}
