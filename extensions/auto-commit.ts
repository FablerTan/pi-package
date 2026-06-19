import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execSync } from "node:child_process";

export default function (pi: ExtensionAPI) {
  pi.on("agent_end", async (event, ctx) => {
    try {
      execSync("git rev-parse --git-dir", { stdio: "pipe" });
    } catch {
      ctx.ui?.setStatus("auto-commit", "⚠ 非 git 仓库，自动提交已停用");
      return;
    }

    try {
      const status = execSync("git status --porcelain", {
        encoding: "utf-8",
        stdio: "pipe",
      }).trim();
      if (!status) return;

      const lines = status.split("\n").filter(Boolean);
      const files = lines.map((l) => l.slice(3).trim());
      const changeTypes = new Set(lines.map((l) => l[0]));
      const ops: string[] = [];
      if (changeTypes.has("M") || changeTypes.has("R")) ops.push("modify");
      if (changeTypes.has("A") || changeTypes.has("??")) ops.push("add");
      if (changeTypes.has("D")) ops.push("delete");

      // 从 assistant 回复提取摘要
      let summary = event.messages
        ?.filter((m) => m.role === "assistant")
        ?.map((m) => (typeof m.content === "string" ? m.content : ""))
        .pop()
        ?.trim()
        ?.replace(/^["'「『]|["'」』]$/g, "")
        ?.slice(0, 100) || "";

      // 太短没意义
      if (summary.length < 4) summary = "";

      const operation = ops.length > 0 ? `${ops.join("/")} ` : "";
      const fileSummary =
        files.length <= 3
          ? files.join(", ")
          : `${files.slice(0, 2).join(", ")} 等 ${files.length} 个文件`;

      const msg = summary
        ? `auto: ${operation}${summary} [${fileSummary}]`
        : `auto: ${operation}${fileSummary}`;

      execSync("git add -A", { stdio: "pipe" });
      execSync(`git commit -m "${msg.replace(/"/g, '\\"')}"`, { stdio: "pipe" });

      const label = summary || fileSummary;
      ctx.ui?.setStatus("auto-commit", `✓ ${label}`);
    } catch {
      // 静默
    }
  });
}
