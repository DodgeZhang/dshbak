---
id: "56aa67af-57cd-4a4f-acd6-de8a54ed21d3"
title: "值班提醒机器人 banner P1 修复：隐式字符串拼接致标题重复 46 次"
description: "中心机房值班提醒机器人 v1.0 收尾阶段的菜单 banner P1 缺陷：隐式字符串拼接把 *46 错作用到整段导致标题刷成 109 行，已改 \"\\n\".join 显式拼接并重打包验证。承接 a9cbb58a / 055cb971，以后被要求修菜单刷屏/隐式拼接/升版时召回。"
status: "active"
created_at: "2026-11-14T10:27:06.154Z"
updated_at: "2026-11-14T10:27:06.154Z"
content_hash: "f3f78cd44bf47a8acdcaf11e5fbbdbe310756dc6c8f7d8bd301cb9b6fd4253c9"
source_paths:
  - "值班提醒机器人/duty_reminder.py"
session_ids:
  - "mnemon-run-v1-e5791a64-a5a3-4686-828f-4f9c44f928ef"
memory_body_ids:
  []
---

# 值班提醒机器人 banner P1 修复：隐式字符串拼接致标题重复

> 来源：2026-11-14 晚段 v1.0 收尾（承接 `a9cbb58a-f47d-4eaa-a5c9-13de2082ce6d` 的 onedir 重打包，`055cb971-bbd7-46f1-96f3-b3972d3653fb` 的 QA P2 emoji→ASCII 修复）。本篇只记本轮新增的 banner P1 缺陷，打包/编码/排班细节见前述文档，不重复。

## 缺陷与根因

`duty_reminder.py` 的 `interactive_menu()` 里 `banner` 原用隐式相邻字符串字面量拼接：

```python
banner = (
    "=" * 46 + "\n"
    f"  {APP_NAME}\n"
    "=" * 46 + "\n"
    ...
)
```

相邻字符串字面量隐式拼接使 `* 46` 的重复运算被作用到整段（标题+分隔线）而非单独一行，标题被重复 46 次、菜单刷成 109 行。这是 Python 隐式拼接的典型坑：跨行括号内相邻字面量先拼接、后运算。

## 修复

改为 `"\n".join([...])` 显式拼接，消除隐式拼接歧义：

```python
banner = "\n".join([
    "=" * 46,
    f"  {APP_NAME}",
    "=" * 46,
    ...
])
```

源码级验证：banner 3 行、标题出现 1 次、`=` 92 个（两条 46）。

## 重打包与验收

- 重打包 onedir：exe 5.8MB（时间戳 2026-11-14 18:25:14）+ 同级 `_internal\` 86 文件，仍不依赖运行时临时目录解压，杀软拦截根因不回归。
- 重定向下实测菜单：19 行（2 条 `=` + 标题 + 4 行状态 + `[!]` 待办 2 项 + 5 个菜单项），标题仅 1 次、`=` 92 个、菜单项各 1 次，退出码正常，无重复刷屏。

## 交付收尾状态

- 根目录成品：`duty_reminder.exe`(5811698)、`_internal\`、`config.json`、`使用说明.md` + 六份文档报告（QA复验/发布/变更/审核/问题排查），测试中间文件无残留。
- 发布闸门仍未闭环项：干爹补 `webhook_url` + 金山导出的 `排班表.xlsx` 两个部署前置；QA 复跑「重定向双击：标题=1 次」+ 一次 `--test` 后绿灯升 v1.0。

## 环境备忘

- 控制台 GBK 乱码仍是 PowerShell 管道显示问题，非脚本 bug；标题「出现次数:0」的中间检查是 grep 中文标题被 GBK 打乱所致，最终以 banner 行数=3、`=` 92、标题 1 次为准。
- PyInstaller stderr 的 exit code 1 为 PowerShell 把 stderr 当报错，日志 `Build complete` 即成功（同 a9cbb58a）。
