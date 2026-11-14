---
id: "541f27a9-46e6-4c01-b642-1fc4a6b1256b"
title: "值班提醒机器人：GUI 版 P1/P2 修复收口（run.log 改名 + 缺配置提示 + 全局异常钩子）"
description: "GUI 版 P0 入口分流之后的收尾修复轮：日志名 duty_gui.log→run.log、缺配置中文提示、全局异常钩子，以及 _install 显式 sys.executable 落地；重打包产物 19:06:29。修正 50b94934 中已过期的 duty_gui.log 口径。"
status: "active"
created_at: "2026-11-14T11:08:17.897Z"
updated_at: "2026-11-14T11:08:17.897Z"
content_hash: "9c66860dda6bb70c97f9833f7c063df2278be0329f82d679736982b78b048e61"
source_paths:
  - "值班提醒机器人/gui.py"
session_ids:
  - "mnemon-run-v1-d2d51475-e8db-47b8-a744-0af1d054ad7a"
memory_body_ids:
  []
---

# 值班提醒机器人：GUI 版 P1/P2 修复收口（run.log + 缺配置提示 + 全局异常钩子）

> 来源：2026-11-14 晚段 P0 入口分流完成后的收尾修复轮。承接 `50b94934-7d6a-4c90-a84d-da475d7f12f9`（GUI 实现交付与架构复核）、`4002c165-b190-459d-a22a-f007eafca3f5`（GUI 版安全验收）。本轮的最终交付产物与 P0 无关，是 QA/PM 定裁的收口项。

## 重要口径更正（未来改版必看）

- 日志文件名已从 `duty_gui.log` **改为 `run.log`**（`gui.py:32` 的 `LOG_PATH`，文件头注释同步）。`50b94934` 与 `4002c165` 中「四条安全约定/红线」写的 `duty_gui.log` 已过期，以 `run.log` 为准。

## 本轮修复项

1. **P1 日志名**：`duty_gui.log` → `run.log`（`gui.py:32` + 头部注释）。
2. **P2 缺配置中文提示**：新增 `_show_readiness_hint()`，启动时用 `core.check_ready` 检测，缺 webhook/排班表时在日志区输出一句「当前缺配置：…请在配置区补齐后点保存配置」。
3. **P2 全局异常钩子**：新增 `_global_excepthook` + 挂接 `root.report_callback_exception`，未捕获异常写 `run.log` 并 `messagebox.showerror` 弹窗——windowed 无控制台也能追溯。
4. **_install 架构优化落地**：`_install` 不再找不存在的根目录 `duty_reminder.exe`，改为**显式 `sys.executable`（GUI exe 自身）**并加注释「计划任务用 GUI exe 的 `--daily` 静默分支」。计划任务 `/TR` 最终指向 `…\GUI版\duty_reminder_gui.exe --daily`。

## 按 PM 裁定不做（裁剪项，待后续版本）

就绪状态条 / 查指定日期控件 / `push_hour` 可编辑 / `config.json.bak` 备份——本版不动，等需求调研/文档专员回写「后续版本」。

## 重打包产物（最终）

- GUI exe 时间戳 **2026-11-14 19:06:29**、Subsystem=2（windowed）、onedir `_internal` 1011 文件（含 tk/tcl）。
- `--daily` 分流实测：走 core `cmd_daily` 静默推送、退出码 0、无 GUI 窗口残留；`run.log` 在 `--daily` 分支不生成属正常（该分支不写 GUI 日志）。

## QA 定向复验点（3 条）

① `run.log` 命名；② 缺配置中文提示（源码级可核 `_show_readiness_hint`）；③ 全局异常钩子（源码级可核 `_global_excepthook`）。发布 v1.1 待 QA 绿灯，勿提前升版。

## 相关文件

- `值班提醒机器人\gui.py`（GUI 壳层，本轮后约 333 行）
- `值班提醒机器人\duty_reminder.py`（核心逻辑层，未改动）
