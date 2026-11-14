---
id: "a82f102f-4942-4d2b-aac7-ccfcc16ddc21"
title: "值班提醒机器人（中心机房）最终版：读导出 xlsx + 双击交互菜单"
description: "中心机房值班提醒机器人最终交付：排班数据源改为读用户导出的排班表.xlsx（方案2）、双击进交互菜单、exe 与 config 同层、双击起不来的根因与部署三步。承接早期内置算法版文档 830067aa，排班规律引用 8faa2a57。以后用户要求改机器人/重打包/换 webhook/再排班时召回本版。"
status: "active"
created_at: "2026-11-14T09:56:11.291Z"
updated_at: "2026-11-14T09:56:11.291Z"
content_hash: "af92fa965ce819abb4083e0168e372c1bdc90c41d4361f723affa2cb3c69fafb"
source_paths:
  - "值班提醒机器人/duty_reminder.py"
  - "值班提醒机器人/config.json"
  - "值班提醒机器人/使用说明.md"
session_ids:
  - "mnemon-run-v1-a4fb52cb-07a4-45f9-bde9-84115bb5814a"
memory_body_ids:
  []
---

# 值班提醒机器人（中心机房）最终版：读导出 xlsx + 双击交互菜单

> 来源：2026-11-14 晚段交付更新。承接早期内置算法版文档 `830067aa-8a2e-42df-83b7-baaae0370c1a`；排班规律仍引用 `8faa2a57-d3e2-4b3c-8517-a738e8a12e45`（《中心机房值班表排班规律》）。

## 关键变更（相对早期内置算法版）
- 排班数据源改为**读用户从金山文档导出的 `排班表.xlsx`**（用户选定方案 2），不再用内置算法。
- 部署方式从 `duty_reminder.exe --install` 改为**双击进入交互菜单**（发测试推送 / 注册自动推送 / 看今天排班 / 卸载）。
- 目录结构理顺：exe、config.json、使用说明.md 同层（exe 从 `dist\` 挪到项目根目录）。

## 最终交付物（同在 `值班提醒机器人\` 根目录）

| 文件 | 说明 |
| --- | --- |
| `duty_reminder.py` | 主脚本（读 xlsx + 企业微信推送 + 交互菜单 + 计划任务） |
| `config.json` | 填 `webhook_url` 与排班表路径两处 |
| `使用说明.md` | 部署步骤 |
| `duty_reminder.exe` | PyInstaller 单文件（约 32MB，Console 子系统） |

## 取数方式（以在线表格为准）
- 读用户导出的 `排班表.xlsx`，按「日期 / 白班·带班领导 / 24小时班」列名智能定位 sheet（列名略不同也能认）。
- 周末白班空 → 自动回溯本周最近工作日的带班领导（已实测 11/21、11/22 正确回溯到当周白班伊力潘江）。

## 部署三步
1. 金山文档导出排班表 → 存为 `排班表.xlsx`，与 exe 同目录。
2. `config.json` 填 `webhook_url`。
3. 双击 `duty_reminder.exe` → 菜单选「1」测试推送 →「2」注册每天 09:00 自动推送。

## 排班验证结论
5 人模式（高国凯借调后：田晨、鲁强、蒋维、张德智、伊力潘江），5 周一轮回；11/16 白班伊力潘江 → 11/23 田晨 → 11/30 张德智 → 12/7 蒋维 → 12/14 鲁强 → 12/21 回到伊力潘江。

## 双击"起不来"根因（已修复）
1. exe 是 Console 程序（PE Subsystem=3），双击弹黑窗、缺配置报错后一闪即关。
2. 旧版 exe 在 `dist\` 子目录而 config 在上级，exe 在自己的目录找不到 config → 无反应。
修复：改写为双击进交互菜单（不再闪退）+ exe 与 config 同层。

## 环境备忘
- 沙箱禁止创建临时目录，exe 在沙箱内跑报 `Could not create temporary directory!`，属环境限制，真机正常。
- PowerShell 把 PyInstaller stderr 当报错（exit code 1），日志出现 `Build complete` 即打包成功；控制台 GBK 乱码是 PowerShell 管道编码问题，非脚本 bug。
- 金山文档在线 sheet 底层数据需本人登录态，机器人侧无 token，下载/导出接口 403；因此走"用户手动导出 xlsx"方案。
