---
id: "a28a16fa-2591-4c54-a55b-63ac71f85d0f"
title: "值班提醒机器人 exe 双击闪退真根因：腾讯电脑管家拦截 PyInstaller 单文件自解压"
description: "值班提醒机器人 duty_reminder.exe 双击即退的真根因修正：非目录/闪退问题，而是腾讯电脑管家（QQPCRTP）拦截 PyInstaller onefile 自解压，报 Could not create temporary directory!。含证据链、按优先级的三套方案、无打包环境硬约束。承接 a82f102f 的旧根因判断。"
status: "active"
created_at: "2026-11-14T10:01:20.744Z"
updated_at: "2026-11-14T10:01:20.744Z"
content_hash: "59c3e789100a1fa415ede9ac8182097eb8087f00dc639fa281d0addbbc8f7337"
source_paths:
  - "值班提醒机器人/duty_reminder.py"
  - "值班提醒机器人/config.json"
session_ids:
  - "mnemon-run-v1-3168b946-3ccf-453d-bb29-d5017963f738"
memory_body_ids:
  []
---

# 值班提醒机器人 exe 双击闪退真根因：腾讯电脑管家拦截 PyInstaller 单文件自解压

> 来源：2026-11-14 晚段根因排查。**修正**并承接 `a82f102f-4942-4d2b-aac7-ccfcc16ddc21`（《值班提醒机器人最终版》）中「双击起不来根因」与「环境备忘」的旧判断。
>
> 旧判断（a82f102f）把 `Could not create temporary directory!` 归为「沙箱环境限制，真机正常」；本次在真机上实测该错误仍然复现，真根因是**安全软件拦截**，需改写结论。

## 真根因

`duty_reminder.exe` 是 PyInstaller **单文件（onefile）** 打包。双击后引导程序要先把本体自解压到 `%TEMP%\_MEIxxxxxx` 临时目录，随后才运行 Python 主逻辑。腾讯电脑管家的实时防护（进程 `QQPCRTP`，服务 `QQPCRTP`/QQPCMgr RTP Service）把这一步自解压当可疑行为拦掉 → 临时目录创建失败 → 程序秒退。

报错原文只有一句：`[PYI-xxxxx:ERROR] Could not create temporary directory!`。注意 `PYI-` 后面那串是**进程号（PID）不是错误码**，每次都变，别被误导成不同错误。

## 证据链（逐项验证过）

- exe 本体完整：PE 头正常、Subsystem=0x0003（Console）、30.4MB，含 `python312.dll` 与 `_MEI` 标记，未损坏、未被删。
- `config.json` 已与 exe 同目录，目录结构没问题。
- 磁盘空闲约 111GB，`TEMP=C:\Users\zhang\AppData\Local\Temp` 存在且可写，`_MEI*` 残留目录为 0。
- 换一个全新纯净临时目录再跑 → 仍报同样错误。
- 用 cmd 直接执行 → 同样报错（排除 PowerShell 编码/管道误判）。
- Windows Defender 实时保护关闭（False），无最近拦截记录；但系统里**腾讯电脑管家 QQPCRTP 实时防护正在运行**（进程 MsMpEng 也在，但 Defender 无拦截）。

## 方案（按推荐排序）

1. **根治**：改 PyInstaller `--onedir` 目录版打包，不往临时目录自解压，绕开管家拦截。
2. **快速验证**：在腾讯电脑管家里把 `duty_reminder.exe` 加白名单/信任，5 分钟即可确认是否为管家拦截；加完双击看是否弹出菜单。
3. **备选**：换 Nuitka 打包，误报率通常更低。

## 硬约束（重打包前须知）

- 这台机器**当前没有可用打包环境**：真实 Python 是 `C:\Users\zhang\python-sdk\python3.13.2\python.exe`（3.13.2），未装 pyinstaller / openpyxl；而 exe 是 Python 3.12 打的（内含 `python312.dll`）。
- 走方案 1 前需先装好 pyinstaller + openpyxl（且注意 Python 版本对齐 3.12 更稳），再重新打包为 onedir。

## 相关文件

- `值班提醒机器人\duty_reminder.py`（主脚本，路径基准已用 `base_dir()` 钉在 exe 同目录）
- `值班提醒机器人\config.json`
- `值班提醒机器人\duty_reminder.exe`（onefile，Console 子系统，30.4MB）
