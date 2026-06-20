import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execSync } from "node:child_process";
import { basename } from "node:path";

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

  pi.on("agent_end", async () => {
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

      const files = numstat
        .split("\n")
        .filter(Boolean)
        .map((l) => {
          const [add, del, ...fp] = l.split("\t");
          const name = basename(fp.join("\t"));
          const a = parseInt(add) || 0;
          const d = parseInt(del) || 0;
          return `${name} ${a > 0 ? `+${a}` : ""}${d > 0 ? `-${d}` : ""}`.trim();
        })
        .join(", ");

      execSync(`git commit -m "${files}"`, { stdio: "pipe" });

      console.log(`\n📦 auto-commit: ${files}`);
    } catch (e: any) {
      console.log(e.stderr || e.message);
    }
  });
}
