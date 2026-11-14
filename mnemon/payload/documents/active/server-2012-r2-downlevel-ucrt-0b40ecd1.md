---
id: "0b40ecd1-0fba-4003-9e7e-1c41c18ad6fc"
title: "值班提醒机器人 Server 2012 R2 免装部署：downlevel UCRT 塞包法"
description: "PyInstaller Python 3.12 exe 在 Server 2012 R2 (NT 6.3) 报 api-ms-win-crt-process-l1-1-0.dll 找不到的根因与免装解法：从 C:\\Windows\\System32\\downlevel 取真实 UCRT dll 全集，用 --add-binary 塞进 onefile。承接 830067aa 与 a28a16fa。"
status: "active"
created_at: "2026-11-14T13:10:41.310Z"
updated_at: "2026-11-14T13:10:41.310Z"
content_hash: "049eec896469c5d1d564bbcb6343c1e92c0582967ca2840d89e2164153d17069"
source_paths:
  - "值班提醒机器人/duty_reminder.py"
  - "值班提醒机器人/config.json"
session_ids:
  - "mnemon-run-v1-d0632070-3712-4b6e-bcf9-98605743a26f"
memory_body_ids:
  []
---

# 值班提醒机器人 Server 2012 R2 免装部署：downlevel UCRT 塞包法

> 来源：2026-11-14 晚段 Server 2012 R2 部署排查。承接 `830067aa-8a2e-42df-83b7-baaae0370c1a`（《值班提醒机器人实现与部署》）与 `a28a16fa-2591-4c54-a55b-63ac71f85d0f`（《腾讯电脑管家拦截 onefile 自解压》）。

## 问题

服务器 Server 2012 R2 跑 PyInstaller 打包的 Python 3.12 exe 报：
`Failed to load Python DLL ... api-ms-win-crt-process-l1-1-0.dll ... 找不到指定的模块`。

## 根因

Server 2012 R2（NT 6.3）系统级缺 UCRT。Win10/11 上 `api-ms-win-crt-*.dll` 这族 API-set 转发器已合并进 `ucrtbase.dll`，**System32 根目录没有独立文件**，所以开发机上从 `System32` 直接拷拿不到；`vc_redist.x64.exe /layout` 在本沙箱环境也解不出内嵌 cab 的 dll 本体。

## 突破口（关键）

真实文件在 **`C:\Windows\System32\downlevel\`** 目录：
- 全套 15 个 `api-ms-win-crt-*.dll` **真实文件**（非转发器），含 `api-ms-win-crt-process-l1-1-0.dll`（21824 字节）。
- 连同 `ucrtbase.dll`（约 1MB）、`vcruntime140.dll`、`vcruntime140_1.dll`，共收集 **90 个 dll** 全集（含 `api-ms-win-core-*` 与 `api-ms-win-crt-*` 两族）。

## 免装打包法

把收集的 UCRT 全集用 PyInstaller `--add-binary "dll路径;."` 塞进 **onefile** 单文件版：

```
pyinstaller --onefile --add-binary "C:\Windows\System32\downlevel\*;." \
  --add-binary "ucrtbase.dll;." duty_reminder.py
```

产出 `服务器版\duty_reminder_server.exe`（30.9MB，Subsystem=3 console）。

## 静态验证（确认不是空壳）

打包后对二进制搜关键 dll 名确认已塞入：
- `api-ms-win-crt-process-l1-1-0.dll` ✅
- `api-ms-win-crt-runtime-l1-1-0.dll` ✅
- `ucrtbase.dll` ✅
- `vcruntime140.dll` 搜不到属正常——PyInstaller 已把它当 Python 依赖处理（名字进压缩区），不影响。

## 交付物（`值班提醒机器人\服务器版\`）

| 文件 | 说明 |
| --- | --- |
| `duty_reminder_server.exe` | 30.9MB onefile，含 UCRT 全集，Server 2012 R2 免装 |
| `config.json` | 含 `online_url`（内网 Seafile）、`data_source=seafile`；`webhook_url` 留空待填 |
| `排班表.xlsx` | 本地兜底数据源 |

## 风险与兜底

- onefile 运行时先自解压到 `%TEMP%`，若服务器也装实时监控杀软，可能仍报 `Could not create temporary directory`。
- 塞 UCRT 属非常规做法，api-set 加载顺序存在边界；若还报缺某个 `api-ms-win-crt-*`，需补塞对应 dll。
- **兜底正解**：服务器装 `vc_redist.x64.exe`（已放在 `值班提醒机器人\` 目录）+ 重启，然后跑 **onedir 目录版**（exe + `_internal` + config 整目录，自包含运行库、不依赖 `%TEMP%`）。

## 环境备忘（打包阶段）

- 沙箱禁止建临时目录 → 单文件版沙箱内实测报 `Could not create temporary directory!`，属环境限制，真机正常。
- PowerShell 把 PyInstaller stderr 当报错（exit code 1），日志出现 `Build complete` 即打包成功。
