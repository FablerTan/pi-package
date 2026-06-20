import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execSync } from "node:child_process";

const FILE_TOOLS = ["write", "edit", "bash"];

export default function (pi: ExtensionAPI) {
  let modified = false;

  pi.on("tool_call", async (event) => {
    if (FILE_TOOLS.includes(event.toolName)) {
      modified = true;
    }
  });

  pi.on("agent_end", async (event) => {
    if (!modified) return;
    modified = false;

    try {
      execSync("git rev-parse --git-dir", { stdio: "pipe" });
    } catch {
      return;
    }

    try {
      const status = execSync(
        "git -c core.quotePath=false status --porcelain",
        { encoding: "utf-8", stdio: "pipe" }
      ).trim();
      if (!status) return;

      execSync("git add -A", { stdio: "pipe" });

      const diff = execSync(
        "git -c core.quotePath=false diff --cached --stat",
        { encoding: "utf-8", stdio: "pipe" }
      ).trim();

      const userMsg = event.messages
        ?.filter((m) => m.role === "user")
        ?.map((m) => (typeof m.content === "string" ? m.content : ""))
        ?.join(" ")
        ?.trim()
        ?.slice(0, 200);

      const prompt = `根据以下上下文生成一句中文 commit 摘要（不超过30字，不要前缀），然后执行 git commit -m "摘要"：

用户意图：${userMsg}
文件变更：
${diff}`;

      const result = execSync(
        `pi --print -p "${prompt.replace(/"/g, '\\"')}"`,
        { encoding: "utf-8", stdio: "pipe", timeout: 30000 }
      );

      console.log(result.trim());
    } catch (e: any) {
      console.log(e.stderr || e.message);
    }
  });
}
