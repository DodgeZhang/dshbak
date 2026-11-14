---
id: "fbd52b6d-e083-4476-a325-1aa9b2ddf5f0"
title: "值班提醒机器人：服务器免装单文件部署（UCRT 运行库打包 + 配置写死）"
description: "Server 2012 R2 缺 UCRT 导致 api-ms-win-crt-process-l1-1-0.dll 报错的诊断与解法；从 vc_redist.x64.exe 提取真实 UCRT dll 塞进 onefile 的免装打包方案；GUI+单文件+配置写死 exe 默认值的终极交付口径与风险。"
status: "active"
created_at: "2026-11-14T13:20:32.158Z"
updated_at: "2026-11-14T13:20:32.158Z"
content_hash: "91341e30d871f9e8dcf90e88711dd81608bee29aaeb0465e8e23cd2e4367efaf"
source_paths:
  - "值班提醒机器人/vc_redist.x64.exe"
  - "值班提醒机器人/服务器版"
session_ids:
  - "mnemon-run-v1-9ddda0dc-769d-4686-ab3e-7c3ea7d27be4"
memory_body_ids:
  []
---

# 值班提醒机器人：服务器免装单文件部署（UCRT 运行库打包 + 配置写死）

> 来源：2026-11-14 服务器部署阶段（Server 2012 R2 实测报错 → 免装单文件 → 终极版打包口径）。承接在线读取实现定稿 `109a3ccf-e7d7-4696-a8d8-30c7cc646ab2`（fetch_seafile + config 字段）与数据源定稿 `943996c6-7da4-4e0c-bfda-7a08e27c0833`。本文只记「服务器免装部署与打包」结论，不重复数据源/列映射已收口内容。

## 一、报错根因：Server 2012 R2 缺 UCRT

- 症状：双击 exe 报「计算机中丢失 `api-ms-win-crt-process-l1-1-0.dll`」。
- 根因：`api-ms-win-crt-process-l1-1-0.dll` 是 **Universal C Runtime（UCRT）** 组件；Server 2012 R2（2013 年系统）默认没装 UCRT，Python 3.12 的 exe 启动即找该 dll 失败。非 exe 缺陷，是系统缺底层运行库。

## 二、解法 A（30 秒兜底）：装 vc_redist

- 把 `值班提醒机器人/vc_redist.x64.exe`（微软官方）拷到服务器 → 双击安装 → **重启服务器**（关键，dll 才生效）→ 再跑 exe。
- 若仍报别的 `api-ms-win-crt-*`，是同一套库没装全，重装 vc_redist 即可。
- 此路需要「装运行库」，不满足干爹「免装」目标，作为兜底。

## 三、解法 B（主路，免装）：把 UCRT 塞进 onefile

- 目标：**onefile 单文件，免装任何运行库，只拷一个 exe 就能跑**（Server 2012 R2）。
- 关键坑：开发机（Win10/11）上 `api-ms-win-crt-process*.dll` 已合并进 `ucrtbase.dll`、System32 里无独立文件可塞；PyInstaller 自动收集在旧系统会漏这些 API-set dll。
- 源文件来源：`vc_redist.x64.exe` 是自解压包，内层 cab 里装着整套 UCRT 真实文件（`api-ms-win-crt-process-l1-1-0.dll`、`ucrtbase.dll` 等）。用 `vc_redist.x64.exe /extract:目录`（或 7z）解出 cab，取 **downlevel 目录**下的真实文件（非空壳）。
- 打包：`--onefile --add-binary "提取目录\*.dll;."`，把 `ucrtbase.dll` + `api-ms-win-crt-*.dll` 全集 + `vcruntime140.dll` 收集进包；打完静态核对这几组 dll 真在包里。

## 四、终极版打包口径（GUI + 单文件 + 免装 + 配置写死）

- 目标：服务器双击即用、啥都不用输。
- 打包参数：`--windowed`（无黑窗带图形界面）+ `--onefile`（单文件）+ 塞 UCRT 全集（downlevel 那套，已验证能塞）。
- 配置写死进 exe 默认值：`online_url`＝内网 Seafile 直链（host `10.165.84.174:8989`）、`webhook_url`＝企业微信机器人地址（**值不进本文/日志，仅 exe 内**）。
- 外部 `config.json` 保留为可选覆盖，**没有它也能直接跑**。

## 五、风险与回退

- onefile 运行要自解压到 `%TEMP%`，服务器若装实时杀软可能拦 → 退回「装 vc_redist + 用目录版」。
- webhook key 明文进 exe，建议只在干爹自己服务器上使用；泄露去企业微信机器人管理页重置 key。
- 若还报缺别的 `api-ms-win-crt-*`，按缺失名继续补塞 downlevel 对应文件。

## 相关文档

- 在线读取实现定稿（fetch_seafile / config 字段 / 列映射）：`109a3ccf-e7d7-4696-a8d8-30c7cc646ab2`
- 数据源定稿（内网 Seafile 直链）：`943996c6-7da4-4e0c-bfda-7a08e27c0833`

## 源路径

- `值班提醒机器人/vc_redist.x64.exe`（UCRT 源文件自解压包）
- `值班提醒机器人/服务器版/`（目录版与单文件版交付）
