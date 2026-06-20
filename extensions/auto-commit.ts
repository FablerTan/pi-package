import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execSync } from "node:child_process";

export default function (pi: ExtensionAPI) {
  pi.on("agent_end", async (_event, ctx) => {
    try {
      execSync("git rev-parse --git-dir", { stdio: "pipe" });
    } catch {
      ctx.ui?.setStatus("auto-commit", "⚠ 非 git 仓库");
      return;
    }

    try {
      const status = execSync(
        "git -c core.quotePath=false status --porcelain",
        { encoding: "utf-8", stdio: "pipe" }
      ).trim();
      if (!status) return;

      // 本轮是 prompt 触发，不重复执行
      const userMsgs = _event.messages
        ?.filter((m) => m.role === "user")
        ?.map((m) => (typeof m.content === "string" ? m.content : ""))
        ?.join(" ")
        ?.trim() || "";
      if (userMsgs.startsWith("/write-docs") || userMsgs.startsWith("/git-commit")) return;

      // 暂存变更
      execSync("git add -A", { stdio: "pipe" });

      // 获取变更摘要
      const numstat = execSync(
        "git -c core.quotePath=false diff --cached --numstat",
        { encoding: "utf-8", stdio: "pipe" }
      ).trim();

      const files = numstat
        .split("\n")
        .filter(Boolean)
        .map((l) => l.split("\t").pop())
        .join(", ");

      // 先写文档，再提交
      pi.sendUserMessage(
        `/write-docs 文件变更：${files}\n\ngit diff --cached --numstat：\n${numstat}`,
        { deliverAs: "followUp" }
      );
      pi.sendUserMessage(
        `/git-commit 文件变更：${files}\n\ngit diff --cached --numstat：\n${numstat}`,
        { deliverAs: "followUp" }
      );
    } catch {
      // 静默
    }
  });
}
