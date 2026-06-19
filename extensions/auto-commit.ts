import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execSync } from "node:child_process";

interface PendingCommit {
  files: string[];
  ops: string[];
}

let pending: PendingCommit | null = null;

export default function (pi: ExtensionAPI) {
  pi.on("agent_end", async (event, ctx) => {
    try {
      execSync("git rev-parse --git-dir", { stdio: "pipe" });
    } catch {
      return;
    }

    // ========== Turn 2：pi 已生成摘要，执行 commit ==========
    if (pending) {
      const { files, ops } = pending;
      pending = null;

      // 从 pi 的 assistant 回复中提取摘要
      const summary = event.messages
        ?.filter((m) => m.role === "assistant")
        ?.map((m) => (typeof m.content === "string" ? m.content : ""))
        .pop()
        ?.trim()
        .replace(/^["'「『]|["'」』]$/g, "") // 去掉引号
        ?.slice(0, 80);

      const operation = ops.length > 0 ? `${ops.join("/")} ` : "";
      const fileSummary =
        files.length <= 3
          ? files.join(", ")
          : `${files.slice(0, 2).join(", ")} 等 ${files.length} 个文件`;

      const msg = summary
        ? `auto: ${operation}${summary} [${fileSummary}]`
        : `auto: ${operation}${fileSummary}`;

      try {
        execSync("git add -A", { stdio: "pipe" });
        execSync(`git commit -m "${msg.replace(/"/g, '\\"')}"`, { stdio: "pipe" });
        const label = summary || fileSummary;
        // 底部通知
        ctx.ui?.notify(`✓ auto-commit: ${label}`, "info");
        // 底部状态栏（持续显示）
        ctx.ui?.setStatus("auto-commit", `✓ ${label}`);
      } catch {
        // commit 失败，静默
      }
      return;
    }

    // ========== Turn 1：检测变更，请求 pi 生成摘要 ==========
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

      const userMessages = event.messages
        ?.filter((m) => m.role === "user")
        ?.map((m) => (typeof m.content === "string" ? m.content : ""))
        ?.join(" ")
        ?.trim() || "";

      // 本轮是自动摘要请求，不重复触发
      if (userMessages.startsWith("[auto-commit]")) return;

      const fileSummary =
        files.length <= 5
          ? files.join(", ")
          : `${files.slice(0, 3).join(", ")} 等 ${files.length} 个文件`;

      // 暂存待 commit 信息
      pending = { files, ops };

      // 请求 pi 生成一句话摘要
      const prompt = `[auto-commit] 用一句中文（不超过30字，不要标点）总结以下操作的意图：

${userMessages.slice(0, 200)}
文件变更：${fileSummary}`;
      pi.sendUserMessage(prompt);
    } catch {
      pending = null;
    }
  });

  // 会话关闭时清理状态，避免残留
  pi.on("session_shutdown", () => {
    pending = null;
  });
}
