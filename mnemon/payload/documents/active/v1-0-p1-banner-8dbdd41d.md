---
id: "8dbdd41d-6431-4018-93ef-60bb050f5a84"
title: "值班提醒机器人 v1.0 收口：P1 banner 拼接缺陷与最终发布闭环"
description: "P1 interactive_menu() banner 隐式拼接致标题×46/109行，显式join修复并重打包onedir 18:25:14，E5复验21项全过、QA报告升「通过·v1.0可放行」，发布说明定稿v1.0正式发布。承接055cb971（P2/乱码勘误）、58b81714（v1.0发布定稿P2）。"
status: "active"
created_at: "2026-11-14T10:31:24.964Z"
updated_at: "2026-11-14T10:31:24.964Z"
content_hash: "0eeb099987652e4ac177e0d73b876f2ee0f867e6d67cc1a93f5875df429891a6"
source_paths:
  - "值班提醒机器人/QA复验报告.md"
  - "值班提醒机器人/发布说明.md"
  - "值班提醒机器人/duty_reminder.py"
session_ids:
  - "mnemon-run-v1-6eb6fb8a-17af-4fde-aa1e-a8c046242190"
memory_body_ids:
  []
---

# 值班提醒机器人 v1.0 收口：P1 banner 拼接缺陷与最终发布闭环

> 来源：2026-11-14 晚段 QA 收口 + 发布定稿。承接 `055cb971-bbd7-46f1-96f3-b3972d3653fb`（config 乱码勘误、P2 ⚠/GBK、验收口径）、`58b81714-0d7b-4fa6-b307-daadc3ca2917`（v1.0 发布定稿 P2）。本篇只记 P1 banner 缺陷的发现→修复→复验闭环与最终发布状态；根因/打包环境/排班细节见前述文档。

## 一、P1 banner 拼接缺陷（最初被 ⚠ 异常盖住）
- 现象：双击 `interactive_menu()` 第一眼刷屏——banner 实测刷成 **109 行**、标题「中心机房值班提醒机器人」重复 **46 次**。
- 根因：`interactive_menu()` 的 banner 由相邻字符串隐式拼接而成，运算符优先级坑导致 `* 46`（本应只修饰分隔线）错作用到整段 banner 文本。
- 影响：纯观感/验收口径项（推送、计划任务、周末回溯、sheet 定位等功能均不受影响），但双击首屏刷屏，QA 判定为 P1 阻塞发布，发布说明一度从 v1.0 压回 v1.0-rc 暂缓。

## 二、修复（已落地）
- `duty_reminder.py` 把 banner 改为显式列表 `join`：
  ```python
  banner = "\n".join([
      "=" * 46, f"  {APP_NAME}", "=" * 46,
      f"  目录：{base_dir()}", f"  config.json：…", …,
  ]) + "\n"
  ```
- 重打包 onedir：`duty_reminder.exe` **18:25:14**、5,811,698B、含 `_internal/`（102 文件）、`%TEMP%\_MEI` 残留 **0**。

## 三、E5 收口复验（最终二进制，21 项全 PASS）
- 双击 stdout=PIPE(GBK)：退出码 0、**483 bytes**、**标题 1 次**、`=` 92 个、**19 行**（非 109）、5 菜单项各 1 次、`[!]` 待办两项 + 缺 webhook/排班表提示、请输入序号在、无 gbk 异常、无 `_MEI` 拦截 ✅
- 双击 stdout→文件重定向：与 PIPE 字节级一致（483=483）✅
- `--test` 端到端：自动定位 sheet 读 15 行、假 webhook 收 1 条 markdown（含【测试消息】/带班领导/今日值班/巡检表）、`errcode:0`、周末回溯带班=伊力潘江 ✅
- 结论：**P1 已关闭，重打包未引入回归**。

## 四、最终发布状态
- QA 报告升「**通过（QA 发布闸门全绿，v1.0 可放行）**」，缺陷清单清空（P1 已修复复验关闭、P2 ⚠/GBK 已修复复验关闭、计划任务 `/TR` 嵌套引号建议项非阻塞）。
- `发布说明.md` 定稿 **v1.0 正式发布**（6/6 闸门全过、目录干净、`_MEI` 残留 0）。
- 部署前置（干爹侧，非代码缺陷，仍待办）：填 `config.json` 的 `webhook_url`、金山文档导出 `排班表.xlsx` 放同目录；补齐后双击 exe 选「1」测推送、「2」注册 09:00 即可上线。

## 源路径
- `值班提醒机器人/QA复验报告.md`、`值班提醒机器人/发布说明.md`、`值班提醒机器人/duty_reminder.py`
