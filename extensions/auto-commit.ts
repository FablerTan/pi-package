import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execSync } from "node:child_process";

export default function (pi: ExtensionAPI) {
  pi.on("agent_end", async (_event, ctx) => {
    try {
      execSync("git rev-parse --git-dir", { stdio: "pipe" });
    } catch {
      ctx.ui?.setStatus("auto-commit", "⚠ 非 git 仓库，自动提交已停用");
      return;
    }

    try {
      const status = execSync(
        "git -c core.quotePath=false status --porcelain",
        { encoding: "utf-8", stdio: "pipe" }
      ).trim();
      if (!status) return;

      execSync("git add -A", { stdio: "pipe" });

      // 用 diff --stat 生成变更摘要
      const stat = execSync(
        "git -c core.quotePath=false diff --cached --stat",
        { encoding: "utf-8", stdio: "pipe" }
      ).trim();

      // --stat 最后一行是汇总，前面是每个文件的变更行数
      const summary = stat
        .split("\n")
        .slice(0, -1) // 去掉最后汇总行
        .map((l) => l.trim())
        .filter(Boolean)
        .join("; ");

      const msg = summary ? `auto: ${summary}` : "auto: commit";

      execSync(`git commit -m "${msg.replace(/"/g, '\\"')}"`, {
        stdio: "pipe",
      });

      ctx.ui?.setStatus("auto-commit", `✓ ${summary.slice(0, 60)}`);
    } catch {
      // 静默
    }
  });
}
