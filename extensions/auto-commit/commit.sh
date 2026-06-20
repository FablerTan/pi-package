#!/bin/bash
# 从 pi 配置读取 DeepSeek API Key，生成 commit 摘要并提交

API_KEY=$(jq -r '.deepseek.key // empty' ~/.pi/agent/auth.json 2>/dev/null)

if [ -z "$API_KEY" ]; then
  echo "git commit: ❌ 找不到 API Key"
  exit 1
fi

USER_INTENT="$1"
GIT_DIFF="$2"
API_URL="https://api.deepseek.com/v1/chat/completions"

PROMPT="根据以下上下文生成一句中文 git commit 摘要（不超过 30 字，不要前缀和标点）：
用户意图：${USER_INTENT}
文件变更：
${GIT_DIFF}"

SUMMARY=$(curl -s "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d "$(jq -n \
    --arg prompt "$PROMPT" \
    '{
      model: "deepseek-chat",
      messages: [{role: "user", content: $prompt}],
      max_tokens: 80,
      temperature: 0.3
    }')" | jq -r '.choices[0].message.content // empty')

if [ -z "$SUMMARY" ]; then
  echo "git commit: ❌ 摘要生成失败"
  exit 1
fi

git add -A
git commit -m "$SUMMARY"
echo "git commit -m \"$SUMMARY\""
