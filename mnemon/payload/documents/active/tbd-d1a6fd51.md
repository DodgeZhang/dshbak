---
id: "d1a6fd51-b54c-406a-9d3b-ca69cf9a80d3"
title: "值班提醒机器人：在线表格读取能力——需求框架、调研证据与硬口径（读取方式 TBD）"
description: "2026-11-14 新需求「加在线表格读取能力」的需求侧 handoff：笔记库+交投资料无腾讯文档接口底子、现有 load_schedule 读本地 xlsx 转字典内核、三条零回归硬口径、空模板验收、读取方式 TBD、4 项待 PM 确认。承接 GUI v1.1 收口 39e4cfd2，供架构/编码/QA 阶段召回。"
status: "active"
created_at: "2026-11-14T11:36:47.376Z"
updated_at: "2026-11-14T11:36:47.376Z"
content_hash: "955f00402f49f33a228d06860e8009edb2682cce98774bc6432b82d04f1d0d4d"
source_paths:
  - "值班提醒机器人/需求说明-在线表格读取.md"
  - "值班提醒机器人/duty_reminder.py"
  - "值班提醒机器人/GUI版/config.json"
session_ids:
  - "mnemon-run-v1-044a927b-8056-450f-8be8-30cf4e30e5a2"
memory_body_ids:
  []
---

# 值班提醒机器人：在线表格读取能力 —— 需求框架与调研结论

> 来源：2026-11-14 19:34 前后需求调研阶段，新需求「加在线表格读取能力」。承接 GUI v1.1 文档侧收口 `39e4cfd2-cbf1-4df1-8a89-8f9b39ea3cf9`（当前已发布基线）。本篇只记**新需求的框架、调研证据、硬口径、验收与待确认项**；读取方式核心仍为 TBD，未定版——第①项定死前，架构/编码按「未启动」待着，别抢跑写接口。

## 一、背景与调研证据（两处均无技术底子 → 算「无结果」）
- 目标：加在线表格（腾讯文档 / 金山文档）读取能力，减少手工导出 xlsx。
- 笔记库 `D:\交投资料\相关文档\00-笔记文档`：命中的都是「在线表格待办」「VSCode 插件」和一个 kdocs 旧链接，无 API / 接口技术资料。
- 按约定补查 `D:\交投资料` 根目录：同样只有待办清单、WebHTV 文档、VSCode 设置等，无接口资料。
- 结论：无腾讯文档接口的老底子，读取方式**不脑补、留 TBD**，等验证「能否无登录直读」的结果回填。

## 二、现有内核基线（在线读取要接的点）
- `duty_reminder.py` 的 `load_schedule(cfg)`：从本地 `xlsx_path`（默认 `排班表.xlsx`）用 openpyxl 读；`find_schedule_sheet` 在前 10 行 / 前 20 列自动定位含「日期 / 白班(带班领导) / 24小时班(夜班)」的 sheet；`to_date` 兼容 datetime/date/Excel 序号/多种日期字符串；产出 `{date: (leader, duty)}` 字典，后面 `calc_duty` / 周末回溯带班领导 / 月末提醒全复用。
- `resolve_xlsx_path(cfg)` 以 exe 所在目录为基准解析相对路径。
- 当前 GUI 版 `GUI版/config.json` 字段：`webhook_url`、`xlsx_path`、`push_hour`、`monthly_last_days`、`monthly_tasks`。

## 三、三条硬口径（需求侧钉死，后续不会变）
1. **内核零回归**：在线拉到的数据转成跟 `load_schedule` 一样的 `{date:(leader,duty)}` 字典，`calc_duty`/周末回溯/月末提醒全复用，不改已验证内核。
2. **本地 xlsx 不删当兜底**：在线失败自动回退本地，别让「读在线」变成新的不稳定点。
3. **`--daily` 仍静默 + 日志脱敏**：`scode`、webhook 都不落 `run.log`（延续 GUI 版安全红线）。

## 四、验收专门一条
- 必须校验抓到的是**真实排班数据、不是空模板**：盯 PM 提到的 `newEmptyDoc=1` / `templateId` 分支，防止把空模板当成排班源。

## 五、读取方式：TBD
- 笔记库无接口底子，读取方式一格留 TBD，等「无登录能否直读」验证结果回填；该项定死前架构/编码不写接口。

## 六、待 PM 与干爹一次性确认（4 项）
1. 读取可行性分支：能无登录直读 / 只拿到空模板要给正式链接 / 仍需登录态。
2. 这个腾讯文档是**取代**金山 `kdocs.cn/l/choxOglCxDpc` 成唯一权威源，还是并存。
3. 刷新只 UI 手动，还是每日 09:00 推送前也自动拉一次。
4. 在线与本地不一致时以在线为准（默认）。

## 相关文档
- GUI v1.1 文档侧收口（当前基线）：`39e4cfd2-cbf1-4df1-8a89-8f9b39ea3cf9`
- GUI 架构决策（壳层 UI / 内核零回归 / run.log 落盘原则）：`e45ce875-4119-4526-bce6-3ef16691692f`
- 读 xlsx + 交互菜单内核基线：`a82f102f-4942-4d2b-aac7-ccfcc16ddc21`

## 源路径
- `值班提醒机器人/需求说明-在线表格读取.md`
- `值班提醒机器人/duty_reminder.py`（`load_schedule` / `find_schedule_sheet` / `to_date` / `resolve_xlsx_path`）
- `值班提醒机器人/GUI版/config.json`
