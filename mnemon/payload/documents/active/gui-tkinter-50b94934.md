---
id: "50b94934-7d6a-4c90-a84d-da475d7f12f9"
title: "值班提醒机器人：GUI 实现交付与架构复核（tkinter 壳层 + 计划任务指向澄清）"
description: "值班提醒机器人 GUI 编码开发→架构复核阶段的实现落地（gui.py tkinter 壳层）、四条安全约定、关键实现要点、最终目录结构，以及「注册每日推送」按钮 exe 指向回退 sys.executable 的非阻塞澄清。承接 a28a16fa（管家拦 onefile 根因）、a9cbb58a（onedir 重打包）、58b81714（GUI 架构决策定版）。"
status: "active"
created_at: "2026-11-14T10:56:42.756Z"
updated_at: "2026-11-14T10:56:42.756Z"
content_hash: "590c0cc035a697322b6e354945ea377f7aba6e871f3fcd16079cddccff432213"
source_paths:
  - "值班提醒机器人/gui.py"
  - "值班提醒机器人/duty_reminder.py"
session_ids:
  - "mnemon-run-v1-19306888-86ec-4942-9805-a64783c8e297"
memory_body_ids:
  []
---

# 值班提醒机器人：GUI 实现交付与架构复核（tkinter 壳层 + 计划任务指向澄清）

> 来源：2026-11-14 GUI 编码开发→架构复核阶段。承接 `a28a16fa-2591-4c54-a55b-63ac71f85d0f`（腾讯电脑管家拦 PyInstaller onefile 自解压根因）、`a9cbb58a-f47d-4eaa-a5c9-13de2082ce6d`（onedir 重打包根治杀软拦截）、`58b81714-0d7b-4fa6-b307-daadc3ca2917`（GUI 架构决策定版）。排班规律仍引用 `8faa2a57-d3e2-4b3c-8517-a738e8a12e45`。

## 实现落定

- `gui.py`（332 行）以 tkinter 零新依赖实现五块版式：今日值班状态卡 / 配置区 / 操作按钮 / 运行日志 / 状态栏。
- 逻辑层 `duty_reminder.py`（383 行）一行未改，GUI 只做薄壳调用 `load_schedule` / `calc_duty` / `build_daily_message` / `send_wechat` / `cmd_*`。
- 打包沿用 onedir；GUI 版用 `--windowed`（无黑窗/无控制台）。

## 四条安全约定（gui.py 头部自文档化，改版勿删）

1. `--windowed` 无控制台，异常与日志同步落盘 `duty_gui.log`，关键错误弹窗提示。
2. 日志不落 webhook 明文，测试推送只记结果。
3. 注册/卸载计划任务属高危操作，按钮触发前必须弹确认框。
4. 沿用 onedir 打包 + `utf-8-sig` 读写，防回归。

## 关键实现要点（复用/改版必看）

- **print 失效**：用 `_LogRedirect` 把 `sys.stdout`/`sys.stderr` 重定向到日志文本框并落盘；跨线程仅通过 `widget.after(0, ...)` 在主线程写 UI，防 tkinter 崩溃。
- **按钮动作走子线程**：`_run_async` → `threading.Thread(daemon=True)`，防界面冻结；异常统一经 `_safe_run` 捕获并弹窗。
- **windowed 下外部命令**：`subprocess.run` + `CREATE_NO_WINDOW`（`0x08000000`），避免 `os.system` 闪黑窗。
- **`main()` 显式接住参数**：`--daily/--test/--date/--install/--uninstall/--cli` 均走核心逻辑层 CLI 分支；计划任务调 GUI exe `--daily` 时走 `cmd_daily` 静默推送、不弹 GUI。

## 目录结构（最终）

- 根目录 `值班提醒机器人\`：`duty_reminder.exe`（CLI，约 5.8MB）+ `_internal\` + `config.json` + `duty_reminder.py` + `gui.py` + 各说明文档。
- `GUI版\`：`duty_reminder_gui.exe`（约 5.9MB）+ `_internal\`（1063 条目）+ `config.json`。

## 架构复核结论（非阻塞，逻辑正确）

- `gui.py` 的 `_install` 先找 `base_dir()\duty_reminder.exe`；但 GUI 版打包后 `base_dir()` = `GUI版\`，该目录只有 `duty_reminder_gui.exe`、没有 `duty_reminder.exe` → 于是**回退到 `sys.executable`**（即 GUI exe 自身）。
- 因此计划任务 `/TR` 最终指向 `GUI版\duty_reminder_gui.exe --daily`，而 `main()` 已接住 `--daily` 走静默推送 —— **路径正确、非 bug**。
- 可选优化：`_install` 那句 `os.path.join(core.base_dir(), "duty_reminder.exe")` 在 GUI 版里永远找不到、每次都走 `sys.executable` 回退，建议改成显式 `sys.executable` 并加注释「计划任务用 GUI exe 的 `--daily` 静默分支」，消除误导、让代码自文档化。

## QA 必验点

真机点「注册每日推送」后，打开「任务计划程序 → 中心机房值班提醒机器人 → 操作」，确认 `/TR` 为 `…\GUI版\duty_reminder_gui.exe --daily`；若指到别处（如不存在的根目录 `duty_reminder.exe`）才是真问题。

## 相关文件

- `值班提醒机器人\gui.py`（GUI 壳层，332 行）
- `值班提醒机器人\duty_reminder.py`（核心逻辑层，383 行，未改动）
- `值班提醒机器人\UI改造技术方案.md`（定版方案）
