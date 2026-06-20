import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const FILE_TOOLS = ["write", "edit"];
const MUTATING_CMDS = ["rm ", "mv ", "cp ", "mkdir ", "touch "];

export default function (pi: ExtensionAPI) {
  let modified = false;

  pi.on("tool_call", async (event) => {
    if (FILE_TOOLS.includes(event.toolName)) {
      modified = true;
    }
    if (event.toolName === "bash" && event.input?.command) {
      const cmd = event.input.command as string;
      if (MUTATING_CMDS.some((c) => cmd.startsWith(c))) {
        modified = true;
      }
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

      const numstat = execSync(
        "git -c core.quotePath=false diff --cached --numstat",
        { encoding: "utf-8", stdio: "pipe" }
      ).trim();

      const userMsg = event.messages
        ?.filter((m) => m.role === "user")
        ?.map((m) => (typeof m.content === "string" ? m.content : ""))
        ?.join(" ")
        ?.trim()
        ?.slice(0, 200) || "";

      const diff = execSync(
        "git -c core.quotePath=false diff --cached --stat",
        { encoding: "utf-8", stdio: "pipe" }
      ).trim();

      const script = resolve(process.cwd(), "scripts/commit.sh");
      const result = execSync(
        `"${script}" "${userMsg.replace(/"/g, '\\"')}" "${diff.replace(/"/g, '\\"')}"`,
        { encoding: "utf-8", stdio: "pipe", timeout: 60000 }
      );
      console.log(result.trim());
    } catch (e: any) {
      console.log(e.stderr || e.message);
    }
  });
}
