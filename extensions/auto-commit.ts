import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execSync } from "node:child_process";
import { basename } from "node:path";

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
          const name = basename(file);
          const a = parseInt(add) || 0;
          const d = parseInt(del) || 0;
          const parts: string[] = [];
          if (a > 0) parts.push(`+${a}`);
          if (d > 0) parts.push(`-${d}`);
          return { file, name, stat: parts.length > 0 ? `${name} (${parts.join(" ")})` : name };
        });

      const summary =
        changes.length <= 3
          ? changes.map((c) => c.stat).join(", ")
          : changes
              .slice(0, 2)
              .map((c) => c.stat)
              .join(", ") + ` 等 ${changes.length} 个文件`;

      // commit 信息用完整路径，状态栏用文件名
      const commitMsg =
        changes.length <= 3
          ? changes.map((c) => c.stat).join(", ")
          : `${changes.length} 个文件`;
      const msg = commitMsg;

      execSync(`git commit -m "${msg.replace(/"/g, '\\"')}"`, {
        stdio: "pipe",
      });

      const time = new Date().toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      const statusLabel =
        changes.length <= 3
          ? `已提交 ${summary} · ${time}`
          : `已提交 ${changes.length} 个文件 · ${time}`;
      ctx.ui?.setStatus("auto-commit", statusLabel);
    } catch {
      // 静默
    }
  });
}
