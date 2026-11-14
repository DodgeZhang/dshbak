---
id: "7b1eda53-47a9-40c8-8e1a-f9dde563fa22"
title: "DS Bot 目录授权报错排查：权限档位与团队工作区机制"
description: "排查 DS Bot 在团队工作区外目录操作报\"需要用户授权\"的根因：权限档位（read-only/workspace-write/danger-full-access）与工作文件夹、团队工作区边界的交互，以及两条解决路线。"
status: "active"
created_at: "2026-11-14T06:27:08.196Z"
updated_at: "2026-11-14T06:27:08.196Z"
content_hash: "8e4374a772d9739b719616086fcf87f0059b725da5dee1b22d631e733d892661"
source_paths:
  []
session_ids:
  - "mnemon-run-v1-f2b33782-9284-4ac1-9549-5075fe18e820"
memory_body_ids:
  []
---

# DS Bot 目录授权报错排查

来源：2026-11-14 排查 Bot 指定 `D:\...\08-AI开发团队` 等工作目录时报「需要授权」的根因。证据来自 ds-bot 源码与 README，非用户口头断言。

## 结论（根因）

DS Bot 能否读写某目录，由两件事共同决定，并非存在一个单独的「目录授权」开关：

1. **权限档位（Permissions）**：每个 Bot 有自己的 dsh 权限预设，三档：
   - `read-only` → 中文「仅可查看」/ 英文 "Read only"：只能读，不能改文件
   - `workspace-write` → 中文「工作区内修改」/ 英文 "Workspace"：只能改自己工作文件夹内的东西
   - `danger-full-access` → 中文「完全权限」/ 英文 "Full access"：全盘可改

2. **工作文件夹（Working folder）**：Bot 默认在哪个目录干活。目录在「团队工作区」外、而 Bot 档位是 workspace-write 时，就会触发授权审批。

之前指定 `D:\...\08-AI开发团队` 失败，根因即：该目录在团队工作区外，而 Bot 档位是「工作区内修改」，无资格写外部目录，遂弹授权；未批准（或拒绝）即失败。

## 证据位置（源码）

- 报错原文来源：`ds-bot/src/host/folders.js`（第 169–182 行）
  - `Working in ${path} needs the user's approval, and there is no way to ask for it here, so nothing changed. The user can make this change in the settings.`
  - 以及 rejected / cancelled / no-answer 三个分支。
- 权限预设映射：`ds-bot/src/host/local-agents/engines.js` 第 82 行
  - `'danger-full-access': { acp: ['bypass','bypassPermissions','bypass-permissions'], claude: 'bypassPermissions', codex: 'danger-full-access' }`
- 界面档位标签：`ds-bot/client.js` 第 28581 行
  - `var LABELS = { "read-only": "Read only", "workspace-write": "Workspace", "danger-full-access": "Full access" }`
- 工作文件夹 UI：`ds-bot/client.js` 第 38063–38068 行（Bot 详情面板 "Working folder" 的 FolderMenu）
- 团队工作区设置路径：Settings → General → Locations → Team workspace（README 第 12 行描述）。

## 两条解决路线

- **路线 A（推荐，一次搞定）**：把团队工作区整体搬到 D 盘资料库。
  操作：设置（Settings）→ 通用（General）→ 位置（Locations）→ 团队工作区（Team workspace），从默认 `C:\Users\zhang\.dsh\bot\workspace` 改为 `D:\交投资料\相关文档`（或 `D:\交投资料`）。
  注意：改后 Bot 与群会换到新文件夹开新 part，旧文件夹文件保留不丢。
- **路线 B（按需提权）**：把要动代码的 Bot 权限档位改为「完全权限（Full access）」。
  操作：点开目标 Bot（如「编码开发」「架构方案」）→ 详情面板 → 权限（Permissions）→ 切到「完全权限」。

## 注意

- 保存 dsh 数据（`$DSH_HOME`、团队数据）的目录会被拒绝作为工作文件夹。
- 权限只能由用户本人设置，Bot 无法自行更改。
