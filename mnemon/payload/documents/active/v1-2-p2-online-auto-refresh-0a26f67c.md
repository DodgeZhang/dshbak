---
id: "0a26f67c-9750-46eb-b5be-fb75d3a1a25c"
title: "值班提醒机器人 v1.2 P2 修复：online_auto_refresh 开关作用域收口 + 重打包交付"
description: "v1.2 P2 开关作用域修复（allow_online 参数化）与重打包交付口径，纠正在线读取定稿文档中开关的旧行为描述。"
status: "active"
created_at: "2026-11-14T12:15:32.658Z"
updated_at: "2026-11-14T12:15:32.658Z"
content_hash: "09162fd0fb6a8e41d6771a814ce2f825f3a77ac671167b81c96dd9d312b305c0"
source_paths:
  - "值班提醒机器人/duty_reminder.py"
  - "值班提醒机器人/gui.py"
  - "值班提醒机器人/config.json"
session_ids:
  - "mnemon-run-v1-3d29dca4-570d-4184-ac1e-062f72ef0b84"
memory_body_ids:
  []
---

# 值班提醒机器人 v1.2 P2 修复：开关作用域收口 + 重打包

> 来源：2026-11-14 晚段编码开发收尾。承接在线读取实现定稿 `109a3ccf-e7d7-4696-a8d8-30c7cc646ab2`（其"开关关闭跳过在线"为修复前口径，已被本篇纠正）与 v1.2 发布闸门追踪 `40299627-3458-4fe2-a03e-89bab30f2d09`。

## 一、P2 开关作用域修复（定稿口径）

`online_auto_refresh` 开关**只管辖 `--daily` 每日自动拉取**，手动刷新不受开关限。

- `_load_schedule_with_online(cfg, allow_online)` 增加 `allow_online` 参数，函数体内不再读 `online_auto_refresh`。
- `cmd_daily` 里判断 `auto = cfg.get("online_auto_refresh", True)` 后传 `allow_online=auto`：关开关 → 跳过在线、直接读本地。
- `cmd_test` 与 GUI「从在线刷新」显式传 `allow_online=True`：手动刷新/测试推送**始终走在线**，不受开关限。

mock 矩阵实测：`daily auto=True→fetch 1 次`、`daily auto=False→fetch 0 次`、`test auto=False→fetch 1 次`（手动不受限）。

## 二、重打包完成（含 P2 修复）

- CLI 版 `duty_reminder.exe`：console onedir（Subsystem=3）。
- GUI 版 `GUI版\duty_reminder_gui.exe`：windowed（Subsystem=2，`_internal` 含 tk/tcl，约 1011 文件）。
- config.json（`data_source=seafile`、`online_url`、`cache_xlsx`、`online_timeout=15`、`online_auto_refresh=true`）同步根目录与 `GUI版\` 两处。
- CLI `--date 2026-11-16` 实测走在线：带班=艾尼瓦尔、值班=鲁强。

## 三、待办

- 等 QA 对新 exe 跑开关矩阵 + 黄金锚点销账，绿了升 v1.2。
- P3 两条（`cmd_show` / GUI「刷新排班」读本地、`check_ready` 只查本地）交 PM 定口径：统一走在线 或 文档标清按钮分工。

## 相关文档

- 在线读取实现定稿：`109a3ccf-e7d7-4696-a8d8-30c7cc646ab2`
- v1.2 发布闸门追踪：`40299627-3458-4fe2-a03e-89bab30f2d09`
