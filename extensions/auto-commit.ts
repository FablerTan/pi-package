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

      // 用 diff --numstat 提取文件变更（制表符分隔：增 删 路径）
      const numstat = execSync(
        "git -c core.quotePath=false diff --cached --numstat",
        { encoding: "utf-8", stdio: "pipe" }
      ).trim();

      const changes = numstat
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [add, del, ...fileParts] = line.split("\t");
          const file = fileParts.join("\t");
          const a = parseInt(add) || 0;
          const d = parseInt(del) || 0;
          const parts: string[] = [];
          if (a > 0) parts.push(`+${a}`);
          if (d > 0) parts.push(`-${d}`);
          return parts.length > 0
            ? `${file} (${parts.join(" ")})`
            : file;
        });

      const summary =
        changes.length <= 3
          ? changes.join(", ")
          : `${changes.slice(0, 2).join(", ")} 等 ${changes.length} 个文件`;

      const msg = summary ? `auto: ${summary}` : "auto: commit";

      execSync(`git commit -m "${msg.replace(/"/g, '\\"')}"`, {
        stdio: "pipe",
      });

      const statusLabel =
        changes.length <= 3
          ? summary
          : `✓ ${changes.length} files: ${changes[0]}, ...`;
      ctx.ui?.setStatus("auto-commit", statusLabel);
    } catch {
      // 静默
    }
  });
}
