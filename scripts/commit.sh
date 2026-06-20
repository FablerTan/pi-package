#!/bin/bash
# 独立 pi 进程：生成 commit 摘要并执行 git commit
# 用法: ./commit.sh "用户意图" "文件diff"

USER_INTENT="$1"
GIT_DIFF="$2"

PROMPT="根据以下上下文生成一句中文 commit 摘要（不超过30字），然后执行 git commit -m \"摘要\"。
用户意图：${USER_INTENT}
文件变更：
${GIT_DIFF}"

echo "$PROMPT" | pi -p
