---
id: "1e7a141d-a1f9-48e7-b361-61fc74c9a7ad"
title: "ds-bot 本地团队状态管理与 /api 浏览器会话认证（操作手册）"
description: "ds-bot（DSH Bot 团队插件）本地运维手册：state.json 结构、机器人/分组删除的 API 调用与认证方式（browser-session 凭据、HMAC 签名 cookie）、状态迁移规则与备份还原步骤。涉及「管理/清理/恢复 Bot 团队」「调用 127.0.0.1:7445 的 ds-bot API」「ds-bot state 迁移」时召回。"
status: "active"
created_at: "2026-11-13T18:02:51.316Z"
updated_at: "2026-11-13T18:02:51.316Z"
content_hash: "e39e8639b246bc1e2ca30968774d389bb464817f213b9cfa6ff0dfbae3de9c07"
source_paths:
  []
session_ids:
  - "mnemon-run-v1-839f8d4a-42a9-446a-bfeb-aeda6a2bbc65"
memory_body_ids:
  []
---

# ds-bot 本地团队状态管理与 /api 浏览器会话认证

来源：2026-11-14 在 DSH desktop profile 下清理 Bot 团队的实操（port 7445，client-connection 认证）。相关文件均在安装包/插件目录，非仓库源码。

## 1. 状态文件与备份
- 团队状态：`C:\Users\Dodge\.dsh\bot\state.json`（`governs` 全局唯一，含 `bots` / `rooms` / `sections` / `mainBotIds` 等键）。
- 备份命名：`state.json.bak-YYYYMMDDHHMMSS`，删除前先复制一份放在同目录，恢复=覆盖回 `state.json`。
- 顶层键（实测）：`revision, workspaceId, mainBotId, mainBotIds, bots, rooms, privateArchives, exchangeTurns, questions, views, closedCards, btwCards, browserHolds, sideChats, agents, sections, secrets, capabilities, secretRequests, connectorRequests, mailRequests, colors, models, defaultModel, permissions, modelsKey, prefs, browser, memory, readOnly, im, computer, liveKey, activity, work, memoryNews, memoryReviews, learning, learningSettled, connectors, capabilityStatuses, phone, imStatus, imVia, computerLive`。
- `bots` 为数组，每项形如 `session-<uuid> | <昵称> | <职能> | `；删除单个 bot 走 API 比手改 JSON 安全（会同时清理 rooms 成员与归档）。

## 2. 直接调用本地 API（127.0.0.1:7445）
- `/api` 全部请求由 `@deepseek-ai/dsh-client-connection` 的 `HostConnectionService.admit()` 做 Host/Origin + 签名 cookie 校验；无凭据直接请求返回 `401 unauthorized`（body `unauthorized`，12 字节），错误 Host 返回 403。
- 浏览器入口用一次性 launch token 换 cookie：`GET <host>/connect?token=TOKEN` → `Set-Cookie: dsh-auth-<base64url(sha256(authority))>=v2.<body>.<hmac>`，`HttpOnly; SameSite=Strict; Path=/`，默认 30 天。
- 签名 secret 来自凭据库记录 `client-connection/browser-session`（`kind: grant`，payload `{version:1, secret: <base64url 32B>}`），由 `initializeSecret()` 首次激活时生成并持久化；Cookie body 为 `{version:2, authority, id, issuedAt, expiresAt}`，签名为 `HMAC-SHA256(secret, body)`。
- 脚本化调用流程：读凭据库取 secret → 取进程 launch token（`processLaunchToken`，进程内 WeakMap，无法离线推导，实际做法是从运行中的 Host 进程/浏览器已发 cookie 复用）→ 或直接复用浏览器里现成的 `dsh-auth-*` cookie 值发请求。**不要**把 secret 或 cookie 值写进文档/记忆。
- 已验证可用的端点形态：`POST/GET http://127.0.0.1:7445/api/...` 携带该 cookie 后返回 200（实测一次 bots 列表响应 27617 字节）。

## 3. 团队清理步骤（已实际成功）
1. 备份 `state.json` → `state.json.bak-<ts>`。
2. 用带认证 cookie 的请求列出 bots，逐个删除非主 Bot（实测 7 个 `session-*` 全部返回 200，剩 `mainBotIds` 里的那一个）。
3. 删除 `sections` 里的分组（实测 `delete section sec-xxxx 交投运维 200 true`）。
4. 复核：`bots` 只剩主 Bot，`sections`/`rooms` 为空。被删 bot 的会话与记忆进归档，不再出现在侧边栏。

## 4. store.js 状态迁移规则（读源确认，避免手改 JSON 踩坑）
`ds-bot/src/host/store.js` 的 `load` 是 `loaded ??= (async …)` 记忆化；载入时自动迁移，且有 LEGACY 注释：
- 删除遗留键：`state.closedViews`、`state.btwCards`（旧版把侧栏卡片存在主文件，现按 part 存在 `btw/` 目录）。
- 房间级清理：`botRounds`、`lateRounds`、`quietNoticed`、`quietShown`、`relays`、`relayLimit` 全部删除。
- 房间补齐：旧组按「轮流」模式处理，`room.admin` 取 `mainBotIds` 中的成员，`mode` 非法则回 `'everyone'`，补 `notice`。
- 成员清洗：`room.members` 过滤掉已被删除的 bot，admin 不在成员内则置 null。
- 长文本外置：`state.exchanges` 中超过 `TEXT_KEPT` 的 `text` 截断并记 `entry.length`；群聊行整段文本移入独立文件（`rt.keepGroupLine`），只有写方 host 生成。
- 多写者安全：`writer = holder === undefined && stuck === undefined`；外部改动检测到时把本机状态另存为 aside 文件再 `adopt`，锁回归后对比文件决定是否沿用内存状态。
- `roster.js` 的 `saveSection({id,name,collapsed,color,items,add,remove})`、`saveForDelete()` 是分组增删的落地函数；`side.js`/`btw.js`/`store.js` 均用同样的 `rt.load = () => (ready ??= …)` 惰性载入模式。

## 5. 复用提示
- 任何「改 ds-bot 团队/分组/房间」的需求：先备份 state.json，再走 API（认证见第 2 节），最后复核键集合，别直接编辑 JSON（迁移逻辑会在下次载入改写它）。
- 若要恢复被删团队：停 Host 后把备份覆盖回 `state.json`（不要与现有文件并存），再启动，让 store.js 自行迁移。
