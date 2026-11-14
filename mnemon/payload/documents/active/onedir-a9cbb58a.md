---
id: "a9cbb58a-f47d-4eaa-a5c9-13de2082ce6d"
title: "值班提醒机器人（中心机房）onedir 重打包根治杀软拦截（已完成验证）"
description: "中心机房值班提醒机器人 onefile→onedir 重打包的根因确认、dsh 内置 runtime 打包环境、utf-8-sig 编码修复与端到端验证结论。承接文档 a82f102f，排班规律引用 8faa2a57。以后用户要求重打包/换 webhook/再排班时召回。"
status: "active"
created_at: "2026-11-14T10:04:27.647Z"
updated_at: "2026-11-14T10:04:27.647Z"
content_hash: "9520ae54bfdd7ba66d52aa96e3c492feff9c8e7b080413522ac042cb9cf95287"
source_paths:
  - "值班提醒机器人/duty_reminder.py"
  - "值班提醒机器人/config.json"
  - "值班提醒机器人/使用说明.md"
session_ids:
  - "mnemon-run-v1-77064da1-d8af-444a-8f80-2dabaf623b20"
memory_body_ids:
  []
---

# 值班提醒机器人（中心机房）onedir 重打包根治杀软拦截（已完成验证）

> 来源：2026-11-14 晚段交付。承接最终版文档 `a82f102f-4942-4d2b-aac7-ccfcc16ddc21`（读导出 xlsx + 双击交互菜单）；排班规律仍引用 `8faa2a57-d3e2-4b3c-8517-a738e8a12e45`（《中心机房值班表排班规律》）。

## 根因（本次确认，非猜测）

onefile 单文件版启动时先把程序自解压到 `%TEMP%\_MEI*`，腾讯电脑管家 QQPCRTP 实时防护拦截该临时目录创建，引导器随即直接退出 → 双击秒退/起不来。已排除 TEMP 指向异常/不可写、磁盘空间不足、`_MEI*` 残留冲突（残留目录数为 0）。

## 根治方案（已落地，非仅建议）

- PyInstaller 由 onefile 改 **onedir**：`duty_reminder.exe` 5.8MB + 同级 `_internal\`（86 文件），不再运行时解压临时目录，绕开管家拦截。
- 打包环境用 **dsh 内置 runtime**：Python 3.12.14 + openpyxl 3.1.5 + PyInstaller 6.22.3，无需在真机 Python 3.13.2（原无 pyinstaller/openpyxl）另装环境。
- config 读取改用 `utf-8-sig`：兼容记事本带 BOM 存盘，`xlsx_path`/`monthly_tasks` 中文不再乱码。

## 目录结构（最终）

exe、`_internal\`、`config.json` 均在 `值班提醒机器人\` 根目录同一层（exe 从 `dist\` 挪回根目录，路径基准用 `base_dir()` 钉在 exe 同目录）。

## 端到端验证结论

- 缺文件时留窗口给中文提示、退出码 0（非崩溃），双击不再闪退。
- 测试排班表跑 exe：自动定位排班 sheet（日期列=B、带班/白班列=C、值班/24H列=D，7 行全读入）。
- **11/16 周一 → 带班领导=伊力潘江、值班=鲁强**，与已知排班一致；11/21、11/22 周末回溯无回归。

## 环境备忘（复用前必看）

- PowerShell 把 PyInstaller 的 stderr 当报错（exit code 1），日志出现 `Build complete` 即打包成功。
- 控制台那串 GBK 乱码是 PowerShell 管道编码问题，非脚本 bug；真机双击的控制台窗口是 GBK 环境，中文正常显示。
