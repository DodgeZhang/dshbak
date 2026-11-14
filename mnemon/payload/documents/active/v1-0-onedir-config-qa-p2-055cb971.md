---
id: "055cb971-bbd7-46f1-96f3-b3972d3653fb"
title: "值班提醒机器人 v1.0 onedir 交付收尾：config 乱码勘误、QA 复验 P2 缺陷与验收口径"
description: "中心机房值班提醒机器人 v0.9-rc→v1.0 onedir 交付收尾：config.json 中文乱码为 PowerShell GBK 显示误判（审核意见已勘误作废，勿重复改）、QA 复验 33 例有条件通过含 ⚠/GBK 管道 P2 缺陷及已验证修复、双击验收口径=弹中文菜单由人选、六份文档定稿与发布闸门状态。以后被要求改 config 编码/修菜单乱码/升版发布说明时召回。承接 a9cbb58a / a28a16fa。"
status: "active"
created_at: "2026-11-14T10:19:02.003Z"
updated_at: "2026-11-14T10:19:02.003Z"
content_hash: "4e31c3e859f075a7e64250a2b0354579dc75eafe0c4ebddac2718ee463e33083"
source_paths:
  - "值班提醒机器人/QA复验报告.md"
  - "值班提醒机器人/审核意见.md"
  - "值班提醒机器人/问题排查记录.md"
  - "值班提醒机器人/使用说明.md"
  - "值班提醒机器人/变更记录.md"
  - "值班提醒机器人/发布说明.md"
  - "值班提醒机器人/config.json"
  - "值班提醒机器人/duty_reminder.spec"
session_ids:
  - "mnemon-run-v1-236a63dc-e964-441d-80dc-df5a017200fc"
memory_body_ids:
  []
---

# 值班提醒机器人 v1.0 onedir 交付收尾：勘误与 QA 闭环

> 来源：2026-11-14 晚段 文档/QA/安全运维 收尾。承接 `a9cbb58a-f47d-4eaa-a5c9-13de2082ce6d`（onedir 重打包根治）、`a28a16fa-2591-4c54-a55b-63ac71f85d0f`（闪退真根因）、`a82f102f-4942-4d2b-aac7-ccfcc16ddc21`（最终版设计）、`8faa2a57-d3e2-4b3c-8517-a738e8a12e45`（排班规律）。本文只记本轮新增的勘误、QA 定级与交付口径；根因/打包环境/排班细节见前述文档，不重复。

## 一、config.json 中文乱码是误判（重要：勿重复改）
- `审核意见.md`「附加缺陷」节曾记 `xlsx_path: 鎺掔彮琛?xlsx`、monthly_tasks 中文乱码，判为 GBK/UTF-8 混写，结论要求「修正 config.json 编码」。
- 复核结论：**误判，已作废**。那是 PowerShell 管道按 GBK 解码 UTF-8 字节造成的显示乱码；`config.json` 字节级 strict 解码为合法 UTF-8 无 BOM，`排班表.xlsx` / 月度任务中文无损（与 QA 复验附记一致）。**不要照旧结论重复改编码**。
- `审核意见.md` 的处理：保留原文「附加缺陷」节仅作审计轨迹，另加「复核勘误与闭环」节撤回该节及结论中「修正 config.json 编码」的要求，以勘误节为最终结论。
- 区分：源码 `load_config` 改用 `utf-8-sig` 是为兼容记事本带 BOM 存盘（见 a9cbb58a），不是修文件本身乱码。

## 二、QA 复验：33 例 / 通过 29 / 判定「有条件通过（发布闸门项达成）」
- 4 条 FAIL 同源：C 段「双击模拟」stdout 走 PIPE/重定向时 `⚠`(U+26A0) 触发 `'gbk' codec can't encode character '\u26a0'`，菜单整段打不出、exit=0。
- 定级 **P2 建议级、不阻塞发布**：真机双击控制台走 WriteConsoleW(UTF-16) 该字符正常、缺陷不复现；frozen exe 下 `PYTHONIOENCODING=utf-8` / `PYTHONUTF8=1` 均不生效（PyInstaller bootloader 固定了 stdout 编码）。
- 已验证修复二选一：① `banner` 里 `⚠ 待办` → `[!] 待办`（最小改动，GBK 环境菜单全打出）；② `main()` 入口加 `sys.stdout.reconfigure(errors="replace")`。改完只需跑一次「重定向双击」，无需全量重测。
- 其余全通过：onedir 启动不再报 PYI 临时目录错误（同目录 / 跨目录 `C:\` 均 exit 0）；`--test` 用本地假 webhook 收到 1 条 markdown 推送、`errcode:0`、含带班领导/值班/巡检表；sheet 自动定位、周末回溯、月末最后 5 天、缺配置中文自检、utf-8-sig 兼容 BOM 全通过。
- 计划任务 `/TR` 含嵌套双引号，实测 schtasks 解析正确（Command=exe / Arguments=--daily），创建成功并已回滚卸载，属建议级非阻塞（可改 `\"` 转义更稳）。

## 三、验收口径（已确认，不再假设）
- 双击 exe = **弹中文交互菜单由人选**（1 发测试推送 / 2 注册每天 09:00 / 3 看今天排班 / 4 卸载），不是「双击即自动完成当天推送」。
- 部署前置两条（干爹侧输入，非代码缺陷）：填 `config.json` 的 `webhook_url`、把金山文档导出的 `排班表.xlsx` 放入 exe 同目录；缺这两项即使菜单正常也推不出去。E 段已用假 webhook + 测试表证明链路本身通。

## 四、交付文档集与闸门状态（v0.9-rc → v1.0）
- 本轮定稿/新建：`使用说明.md`（升版目录版，四要素同目录 + 必随 exe 保留 `_internal/`，历史「单文件被拦」降级为常见问题，补 ⚠/GBK 重定向 P2 提示与 config 乱码勘误）、`问题排查记录.md`（三层证据链 + QA/安全双放行 + 验收口径闭环）、`审核意见.md`（追加勘误节）、`变更记录.md`（新建，形态对照/改动清单/遗留/回滚路径）。
- `发布说明.md` **仍停在 v0.9-rc 待复验 / 闸门六框全空**，属发布专员维护、文档专员未越界改；闸门 ①②⑤⑥ 已达成、③④ 由假 webhook 与计划任务实测证明链路通，待发布专员升版 v1.0 定稿。回滚：旧 onefile 单文件另存 `duty_reminder_onefile_20261114.exe` 存档。
- 安全运维复核：onedir 运行前后 `%TEMP%\_MEI*` 残留均 0，`Could not create temporary directory` 不再出现，安全闸门放行；建议把 `值班提醒机器人\` 整目录加入管家/Defender 信任区（部署环境变量，不影响交付）。

## 源路径
- `值班提醒机器人/QA复验报告.md`、`值班提醒机器人/审核意见.md`、`值班提醒机器人/问题排查记录.md`、`值班提醒机器人/使用说明.md`、`值班提醒机器人/变更记录.md`、`值班提醒机器人/发布说明.md`、`值班提醒机器人/config.json`、`值班提醒机器人/duty_reminder.spec`
