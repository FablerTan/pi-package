import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execSync } from "node:child_process";
import { basename, extname } from "node:path";

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

      // 解析操作类型：+新增 -删除 ~修改
      const opMap = new Map<string, string>();
      for (const l of status.split("\n")) {
        const code = l.slice(0, 2).trim()[0];
        const path = l.slice(3).trim();
        if (code === "A" || code === "?") opMap.set(path, "+");
        else if (code === "D") opMap.set(path, "-");
        else opMap.set(path, "~");
      }

      execSync("git add -A", { stdio: "pipe" });

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
          const op = opMap.get(file) || "~";
          const a = parseInt(add) || 0;
          const d = parseInt(del) || 0;
          let stat: string;
          if (op === "+") stat = a > 0 ? `+${a}` : "new";
          else if (op === "-") stat = d > 0 ? `-${d}` : "del";
          else stat = `~${a > 0 ? `+${a}` : ""}${d > 0 ? `-${d}` : ""}`;
          return { file, name, stat: `${name} (${stat})` };
        });

      const summary =
        changes.length <= 3
          ? changes.map((c) => c.stat).join(", ")
          : changes
              .slice(0, 2)
              .map((c) => c.stat)
              .join(", ") + ` 等 ${changes.length} 个文件`;

      const msg =
        changes.length <= 3
          ? changes.map((c) => c.stat).join(", ")
          : `${changes.length} 个文件`;

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
