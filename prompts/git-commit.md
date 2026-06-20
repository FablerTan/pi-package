---
description: 根据文件变更信息生成 commit message 并提交
argument-hint: "<文件变更信息>"
---

根据提供的文件变更信息，生成简洁的 git commit message 并提交。

## 步骤
1. 回顾本轮对话做了什么
2. 根据文件变更生成一句中文 commit 摘要（不超过 50 字）
3. 执行 `git commit -m "<摘要>"`

## 格式
commit message 直接写摘要，不要前缀（如 auto:），需要手动执行 git commit。

文件变更已暂存（git add -A 已完成），只需 commit。
