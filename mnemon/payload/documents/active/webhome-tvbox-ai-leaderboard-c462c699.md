---
id: "c462c699-982b-4180-8f44-7b53e2a558d3"
title: "开发项目目录索引（webhome / tvbox / ai-leaderboard）"
description: "用户提供的项目目录索引，映射项目别名到绝对路径，已写入「AI开发团队」群公告；后续说\"改 xx 项目\"时按此定位目录。"
status: "active"
created_at: "2026-11-14T06:20:38.584Z"
updated_at: "2026-11-14T06:20:38.584Z"
content_hash: "dddb562ee4a84b46b00704429a472dca0cafef0c8f4c783a06dd98abc8f16253"
source_paths:
  []
session_ids:
  - "mnemon-run-v1-97831b87-e4ac-4ed5-9e83-593246ee6a77"
memory_body_ids:
  []
---

# 开发项目目录索引

来源：用户 2026-11-14 提供，作为「AI开发团队」群的目录索引，已由大肥鱼整合进该群公告。以后用户只说「改 webhome 的首页」这类指令时，按此索引定位代码目录。

## 索引（最终版，含 tvbox-cnb）

- `webhome` → `D:\交投资料\相关文档\07-Git文件\Github\WebHTV\webhtv`
- `tvbox-git` → `D:\交投资料\相关文档\07-Git文件\Github\tvbox`
- `tvbox-cnb` → `D:\交投资料\相关文档\07-Git文件\Cnb\tvbox`
- `ai-leaderboard-daily` → `D:\交投资料\相关文档\07-Git文件\Github\ai-leaderboard-daily`

## 使用约定

- 多项目场景采用「写进群 notice」方式，每个 Bot 进群都能读到，无需逐个设置 work_dir，也无需每次重复报路径。
- 真要动手改代码的角色是「编码开发」「架构方案」，其余角色（调研/测试/文档）用到时照索引找即可。

## 前提（硬约束）

- 上述目录须先在设置里授权给 Bot 使用；此前建 Bot 指定 D 盘目录失败就是卡在未授权。目录未授权时写入 notice 也读不到。
- 授权建议：给 `D:\交投资料\相关文档\07-Git文件` 整条开权限，或下面具体子目录逐个开。

## 相关文档

- 用户职业背景 / 工作资料根目录 / 检索顺序：见 `4feaaa83-bc86-4afb-a72f-2d58fbc55527`。
