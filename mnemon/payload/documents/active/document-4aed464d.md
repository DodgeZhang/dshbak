---
id: "4aed464d-1c2a-4e83-b0ff-06aec5ecc327"
title: "值班提醒机器人：在线读取（数据源无关）技术方案与数据源待确认"
description: "「在线读取」可插拔架构：金山/腾讯/本地 xlsx 三选一适配器、回退链、刷新时机与一致性裁定，以及数据源待确认（腾讯文档空模板 vs 权威金山 kdocs）。承接 GUI 架构 e45ce875 与 v1.1 收口 39e4cfd2。"
status: "active"
created_at: "2026-11-14T11:35:11.672Z"
updated_at: "2026-11-14T11:35:11.672Z"
content_hash: "9e5a88b0bd5a89045a6f54fe541624e703b1e6864eaad5bd00343418a3656ce0"
source_paths:
  - "值班提醒机器人/在线读取技术方案.md"
  - "值班提醒机器人/config.json"
session_ids:
  - "mnemon-run-v1-f6e6aaef-59c8-423f-b39b-fbae05af18a1"
memory_body_ids:
  []
---

# 值班提醒机器人：在线读取（数据源无关）技术方案与数据源待确认

> 来源：2026-11-14 架构阶段，落盘于 `在线读取技术方案.md`。承接 GUI 架构决策 `e45ce875-4119-4526-bce6-3ef16691692f`（壳层UI / 保留CLI / run.log），与 GUI v1.1 收口 `39e4cfd2-cbf1-4df1-8a89-8f9b39ea3cf9`、QA 放行 `915e4849-a9d8-4a55-8c4c-df905543a85b` 同项目。本篇只记「在线读取」块的方案与待确认事实，不重复 GUI 已收口结论。

## 一、方案总原则：数据源无关，不绑定单一链接

做成可插拔适配器，无论最终用金山还是腾讯文档都能接，避免返工：

- 数据源三选一：金山文档 / 腾讯文档 / 本地 xlsx。
- 回退链：在线拉取 → 缓存 → 本地 xlsx（在线不可用时逐级回退）。
- `--daily` 静默分支兼容，不弹 GUI。

## 二、两个架构决策（需求调研点③④，已定）

- **③ 刷新时机**：UI 手动「从在线刷新」按钮 + `--daily` 推送前自动拉一次（`data_source=online` 时），排班调整次日自动生效，不靠人工天天点。
- **④ 一致性裁定**：**以在线为准**，拉取成功即覆盖缓存；仅在线不可用时退回缓存/本地。

## 三、数据源待确认（关键前置事实，勿抢跑写接口）

1. 本轮新给的腾讯文档链接实测为**空模板**（`isBlankPage:true` / `newEmptyDoc=1` / `templateId=…`），无排班数据，接上去也是空读。
2. 既有记忆（用户先前明确纠正）：排班数据以在线金山文档 `kdocs.cn/l/choxOglCxDpc` 为准，本地 xlsx 是旧的。
3. 两者对不上 → 待用户回一句确认：① 用金山文档 `kdocs.cn/l/choxOglCxDpc`（按金山导出接口实现）；② 还是腾讯文档用户正要往里填数据（先做腾讯适配器、有数据再验）；③ 或贴正确链接。

## 四、开发前置（数据源确认后照此落地）

- `datasource.py` 适配器接口 + `fetch_schedule` 回退链。
- 安全运维红线：`https` + 域名白名单。
- 确认前「第①项（读取可行性分支）定死前先待着、别抢跑写接口」。

## 相关文档

- GUI 架构决策（壳层UI / 保留CLI / run.log）：`e45ce875-4119-4526-bce6-3ef16691692f`
- GUI v1.1 文档侧收口定稿与勘误：`39e4cfd2-cbf1-4df1-8a89-8f9b39ea3cf9`
- GUI v1.1 QA 发布闸门最终放行：`915e4849-a9d8-4a55-8c4c-df905543a85b`
- onedir 重打包（绕开腾讯管家 onefile 拦截）：`a9cbb58a-f47d-4eaa-a5c9-13de2082ce6d`

## 源路径

- `值班提醒机器人/在线读取技术方案.md`
- `值班提醒机器人/config.json`（结构：webhook_url / xlsx_path / push_hour / monthly_last_days / monthly_tasks，webhook 为空）
