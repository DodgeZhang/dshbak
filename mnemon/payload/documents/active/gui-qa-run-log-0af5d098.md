---
id: "0af5d098-b497-4862-965b-cc0a40427407"
title: "值班提醒机器人：GUI QA修复迭代（run.log改名+缺配置提示+全局异常钩子）与在线读取适配器设计"
description: "GUI 编码开发 QA 修复迭代落地：P1 日志名 duty_gui.log→run.log（PM 硬口径）、P2 缺配置中文提示与全局异常钩子、裁剪4项、_install 显式 sys.executable 优化落地、重打包产物，以及在线读取 fetch_online 适配器设计（数据源未定暂缓）。"
status: "active"
created_at: "2026-11-14T11:35:19.410Z"
updated_at: "2026-11-14T11:35:19.410Z"
content_hash: "879eb491a09e61b6b72caf81e2e4cef7225d3a0b105009e7d1f00b94827782cd"
source_paths:
  - "值班提醒机器人/gui.py"
  - "值班提醒机器人/duty_reminder.py"
session_ids:
  - "mnemon-run-v1-dc0b1210-298d-43a2-956f-1b1523f475e7"
memory_body_ids:
  []
---

# 值班提醒机器人：GUI QA 修复迭代与在线读取适配器设计

> 来源：2026-11-14 GUI 编码开发 QA 复验阶段。承接 `50b94934-7d6a-4c90-a84d-da475d7f12f9`（GUI 实现交付与架构复核）与 `e45ce875-4119-4526-bce6-3ef16691692f`（GUI 架构决策定版）。

## 一、QA 修复迭代（P1/P2）落地

- **P1 日志名（PM 18:50 硬口径）**：`LOG_PATH` 由 `duty_gui.log` 改为 **`run.log`**（`gui.py:32` + 文件头注释同步改）。此改动使 `50b94934` 中「四条安全约定第 1 条落盘 `duty_gui.log`」的说法过时，以 `run.log` 为准。
- **P2 必补·缺配置中文提示**：`_show_readiness_hint()` 启动时用 `core.check_ready` 检测，缺 webhook/排班表时日志区输出一句「当前缺配置：…请在配置区补齐后点保存配置」。
- **P2 必补·全局异常钩子**：`_global_excepthook` + `root.report_callback_exception` 挂接，未捕获异常写 `run.log` + 弹窗，windowed 无控制台也能追溯。
- **裁剪 4 项（按 PM 裁定不做）**：就绪状态条 / 查指定日期控件 / `push_hour` 可编辑 / `config.json.bak` 备份——本版不动，待需求调研回写「后续版本」。

## 二、`_install` 优化落地（消除 50b94934 的「可选优化」）

- `_install` 不再找不存在的 `duty_reminder.exe`，改为**显式 `sys.executable`（GUI exe 自身）**并加注释「计划任务用 GUI exe 的 `--daily` 静默分支」，自文档化。
- 计划任务 `/TR` 最终指向 `…\GUI版\duty_reminder_gui.exe --daily`，走 `gui.main()` 的 `--daily` 分支 → `core.cmd_daily` 静默推送、不弹 GUI。

## 三、重打包产物

- GUI exe 时间戳 **19:06:29**、PE Subsystem=2（windowed 无黑窗）、onedir `_internal` **1011 文件**（含 tk/tcl）。
- 实测 `--daily`：走 core 静默逻辑、退出码 0、无 GUI 窗口残留（报「找不到排班表」为预期）。`--daily` 不落 `run.log` 属正常（core 静默分支不写 GUI 日志）。
- 二进制里 ASCII 搜不到 `--daily` 是正常现象：PyInstaller 把字符串压进 PYZ（zlib），以实测行为为准。

## 四、在线读取（fetch_online 适配器设计，数据源未定暂缓）

- **适配器接口**：`fetch_online()` 做成数据源无关适配器，金山/腾讯/本地 xlsx 三选一，失败自动回退缓存再回退本地；GUI 加「从在线链接刷新」按钮 + 保留「导出 xlsx」兜底。
- **内核零回归**：在线数据转 `{date:(leader,duty)}` 字典复用 `calc_duty`，复用现有 `load_schedule()` 入口，不碰已验证的排班内核。
- **安全红线**：https + 域名白名单、超时 15s、降级回退、刷新可选项；`scode`/webhook 均不落 `run.log`。
- **数据源实测**：腾讯文档链接是空模板（`newEmptyDoc=1` + `templateId`、`isBlankPage:true`）无数据可读；金山 kdocs 链接有真实文件 ID，走导出接口读 sheet 已验证可行。

## 相关文件

- `值班提醒机器人\gui.py`（GUI 壳层，333 行；LOG_PATH、`_show_readiness_hint`、`_global_excepthook`、`_install` 均在此）
- `值班提醒机器人\duty_reminder.py`（核心逻辑层，未改动）
