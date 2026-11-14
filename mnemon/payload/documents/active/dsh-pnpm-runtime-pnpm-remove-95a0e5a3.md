---
id: "95a0e5a3-6d63-4fef-8798-6f42dc769d37"
title: "DSH 插件正规卸载失败根因（pnpm runtime 缺失）与手工复刻 pnpm remove 流程"
description: "DSH desktop profile 下插件卸载按钮报错的诊断与手工卸载手册：pnpm.mjs MODULE_NOT_FOUND、runtime 目录蒸发、事务回滚 changed:false、\"停用\"与\"卸载\"差异、cordis 补丁式 profile 结构，以及备份→清 5 处登记→搬包→复核→重启刷新清单的完整流程与复核清单。涉及「DSH 插件卸载失败 / pnpm 找不到 / 手工移除插件 / ds-bot 卸载 / node_modules 清理」时召回。"
status: "active"
created_at: "2026-11-14T05:15:39.178Z"
updated_at: "2026-11-14T05:15:39.178Z"
content_hash: "d0c33bdc5dd051d7ee9475b3db6052f545f79cd79d9725c255365cdaf9979696"
source_paths:
  []
session_ids:
  - "mnemon-run-v1-b0810969-fa0d-4fba-b76d-dc06427cc80e"
memory_body_ids:
  []
---

# DSH 插件正规卸载失败根因（pnpm runtime 缺失）与手工复刻 pnpm remove 流程

来源：2026-11-14 在 DSH desktop profile（`C:\Users\Dodge\.dsh\profiles\desktop\`）手工卸载 `ds-bot@0.3.6` 的实操与逐项复核。证据来自 profile 配置文件、`node_modules` 状态文件、`.plugin-manager/logs/operation-*/pnpm.log` 及运行时 `list_plugins` 清单。所有路径均为 profile 安装目录，非仓库源码。

## 何时用
- DSH 插件管理器里点「卸载」报错 / `changed:false` / package.json 没动。
- 报 `Cannot find module …\pnpm\bin\pnpm.mjs` 或 `MODULE_NOT_FOUND`。
- 系统里 pnpm 不可用、又必须把某个插件的依赖登记和包文件彻底清干净。
- 需要判断「停用」和「卸载」到底改了哪些地方。

## 环境与关键事实
- Profile 根：`C:\Users\Dodge\.dsh\profiles\desktop\`；关键文件：`package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`cordis.yml`、`cordis.patch.yml`、`node_modules\.modules.yaml`。
- `pnpm-lock.yaml`：`lockfileVersion: '9.0'`；`pnpm-workspace.yaml`：`nodeLinker: hoisted`、`autoInstallPeers: false`、`minimumReleaseAgeExclude` 白名单按包逐条列出（含 `ds-bot@0.3.1 || 0.3.6`）。
- `cordis.yml` 是空根 `[]`，注释明确：配置树由 `package.json` 的 `dsh.profile.bundles` → `cordis.patch.yml` → 任意 `--patch` overlay **逐层补丁**组成；要改配置应编辑 `cordis.patch.yml`，而非 `cordis.yml`。
- `ds-bot@0.3.6` 依赖 `mailparser@3.12.4`、`imapflow@2.9.1`、`nodemailer@10.2.1`、`ws@8.18.3`、`pngjs@7.0.0`、`jpeg-js`、`playwright-core`、`libmime`、`@zone-eu/mailsplit`、`encoding-japanese` 等，hoisted 布局下多数落在 `node_modules\ds-bot\node_modules\` 并在 `.modules.yaml` 有独立登记。
- 运行时 Node.js `v24.21.0`。

## 根因诊断（证据链）
1. 插件管理器的卸载走内置 pnpm：`C:\Users\Dodge\AppData\Local\Programs\DeepSeek Harness\resources\runtime\primary-runtime\dependencies\pnpm\bin\pnpm.mjs`。该 `resources\runtime` 整个目录已不存在，调用即 `MODULE_NOT_FOUND`（见 `.plugin-manager\logs\operation-0zNqBk\pnpm.log`，`requireStack: []`）。
2. `pnpm remove` 是**事务式**：一旦启动失败就整体回滚，因此表现为 `changed:false`、package.json 未被改动、依赖与包文件原封不动。
3. 排查确认系统里无可用 pnpm 兜底：`Get-Command pnpm` 为空；常见 bundle 路径、corepack 缓存 `pnpm.cjs`、npx 缓存 `pnpm.mjs` 全无 → 标准流程无法自行跑完，只能手工复刻净效果。
4. 之前点过的「停用」只把 `ds-bot` 从 `package.json` 的 `dsh.profile.bundles` 摘除，**`dependencies` 登记与 `node_modules\ds-bot` 都还在**，所以卸载时它仍会冒出来。这就是"停用≠卸载"。

## 操作流程：手工复刻 `pnpm remove` 净效果
顺序固定：先备份 → 清登记 → 搬包 → 复核。

**0) 备份**（可逆前提）：把 5 个状态/配置文件 `package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`cordis.patch.yml`、`node_modules\.modules.yaml` 拷到带时间戳的备份目录（本次 `.ds-bot-uninstall-backup-20261114-130617`）。整包稍后也搬进同目录的 `ds-bot-package\`。

**1) 清 5 处登记/文件**（本次净删：package.json 1 行、pnpm-workspace.yaml 1 行、pnpm-lock.yaml 27 行、.modules.yaml 27 行）：
- `package.json`：删 `dependencies` 中 `ds-bot` 一行；确认 `dsh.profile.bundles` 亦无 ds-bot（停用通常已处理）。
- `pnpm-lock.yaml`：删 importer 的 `ds-bot` 依赖行、对应的 `packages` 解析块与 `snapshots` 依赖块（共 27 行，4615→4588）；保留 `importers` / `packages` / `snapshots` 两个顶级段头结构完整。
- `pnpm-workspace.yaml`：删 `minimumReleaseAgeExclude` 里的 `ds-bot@0.3.1 || 0.3.6` 项。
- `node_modules\.modules.yaml`：删 `ds-bot@0.3.6` 登记项及其 9 个 hoist 记录（`mailparser`、`imapflow`、`nodemailer`、`ws`、`pngjs`、`@zone-eu/mailsplit`、`encoding-japanese`、`libmime` 等指向 `node_modules\ds-bot\node_modules\…` 的条目，共 27 行）；删完检查方括号配平。
- 把 `node_modules\ds-bot` 整包（686 files / 10.7 MB）移动到备份目录下的 `ds-bot-package\`，而非直接删除。

**2) 复核清单**（本次 13 项 `ALL_CHECKS_PASSED`）：
`package.json` 可解析为 JSON / 无 ds-bot 依赖 / bundles 无 ds-bot / 其余 28 个依赖完好 / profile 配置与 state 文件零 `ds-bot` 残留 / `.modules.yaml` 括号配平 / `pnpm-lock` 两个顶级段头齐全 / `pnpm-lock` 行数 = 4615−27 = 4588 / `node_modules\ds-bot` 已移除 / `node_modules` 下无 `ds-bot*` 条目 / 备份含 5 个配置文件 / 备份含整包 / 备份包文件数 = 686。

**3) 运行时清单复核**：`list_plugins` 插件条目总数 51→50，`ds-bot@0.3.6` 那条消失，连带它的 `bot` / `web-search-auto` 行以及 `web`、`ui-settings-general` 两处 override 一并退场。

## 重要坑：静态 profile ≠ 运行态内存
改完静态文件后，**运行中的 DSH 内存仍挂旧插件清单**。本次 `list_plugins` 的 275 条 active 行是内存态；因 ds-bot 本就 disabled、未占 active 行，该数字不变属正常，不代表没删干净。需**重启 DSH** 才刷新界面缓存，插件列表里才会彻底不见该插件。判断"是否清干净"应看静态文件 + 清单条目总数，而非 active 行数。

## 相关文档
- `1e7a141d-a1f9-48e7-b361-61fc74c9a7ad` — 《ds-bot 本地团队状态管理与 /api 浏览器会话认证（操作手册）》：讲 `C:\Users\Dodge\.dsh\bot\state.json` 的团队/机器人状态、127.0.0.1:7445 的 `/api` 调用与 browser-session/HMAC 认证、状态迁移与备份还原。**是另一知识点**（插件运行期数据 vs. 插件包级安装登记），两者互不涉及，按需分别召回。
