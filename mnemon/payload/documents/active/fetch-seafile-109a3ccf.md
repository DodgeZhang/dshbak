---
id: "109a3ccf-e7d7-4696-a8d8-30c7cc646ab2"
title: "值班提醒机器人：在线读取实现定稿（fetch_seafile 下载链 + 三级回退 + 列映射精确锚定）"
description: "在线读取实现定稿：fetch_seafile 下载链、三级回退、列映射精确锚定（C=带班领导/F=夜班24/D-E白班岗）、config 字段与安全白名单，源码层验证结论与 to_date 踩坑。"
status: "active"
created_at: "2026-11-14T12:07:13.317Z"
updated_at: "2026-11-14T12:07:13.317Z"
content_hash: "0c32bc26cc7287d80127676692dc3ac3dfa1470b32c357291c1f156d3b8bf462"
source_paths:
  - "值班提醒机器人/duty_reminder.py"
  - "值班提醒机器人/gui.py"
  - "值班提醒机器人/config.json"
session_ids:
  - "mnemon-run-v1-28550e0a-3ed4-4de9-b49a-89690cf423c8"
memory_body_ids:
  []
---

# 值班提醒机器人：在线读取实现定稿

> 来源：2026-11-14 编码开发「在线读取」全链路实现与源码层验收。承接数据源定稿 `943996c6-7da4-4e0c-bfda-7a08e27c0833` 与 GUI 适配器设计 `0af5d098-b497-4862-965b-cc0a40427407`。本文记录实现口径、列映射定稿与配置字段，供重打包 v1.2 与后续维护参考。

## 一、列映射精确锚定（定稿）

`find_schedule_sheet(ws)` 在前 10 行 / 前 20 列自动定位含「日期 / 带班领导 / 夜班24」的 sheet，返回 `(date_col, leader_col, day_shift_cols, duty_col, header_row)`。

- **A=日期**：认「日期 / 时间 / date」。
- **C=带班领导**：只认「带班」或「领导」；「白班」不再作 leader 候选，杜绝 D 列「白班」抢列。
- **F=夜班24（值班）**：认「夜班」或「24」。
- **D/E=白班岗**：D 列表头「白班」；E 列表头被 D2:E2 合并吞掉、无独立表头，故按位置认 `white_col` 与 `white_col+1`（且排除 duty_col）。白班仅附加显示、不进推送正文。
- 数据行产出 `{date: (leader, duty, day_shift[D,E])}`。

**向前回填**：C 列「带班领导」为合并单元格（每周一填、其余继承），`load_schedule` 从数据首行遍历，C 非空更新 `last_leader`、C 空继承 `last_leader`。

## 二、`fetch_seafile` 下载链

- 每次现取：GET 分享页 → 正则提取 `seafhttp/files/...xlsx` 直链（**每次现取、不写死直链**，JWT 会过期）→ 下载落盘缓存 → 复用 openpyxl 解析。
- 缓存只存 xlsx 字节，不存直链 URL / JWT / 签名。
- 校验下载内容为 xlsx（`data[:2] == b"PK"`），否则回退。

## 三、三级回退 `_load_schedule_with_online`

顺序：**在线 → 缓存 → 本地 xlsx**，全程静默不抛异常（打印提示后 return None / 回退）。

- `online_auto_refresh` 开关（`cfg.get("online_auto_refresh", True)`）：**关闭时跳过在线、直接读本地 xlsx**；打开时在线下载+解析。实测：关→直接本地读（无「下载成功」日志）；开→在线下载。
- `cmd_test` 已改走 `_load_schedule_with_online`：只配 `online_url`、本地无排班表时测试推送也能在线取数。

## 四、安全红线落地

- host 白名单：只放行 `10.165.84.174:8989`（内网 Seafile），恶意 host 拦截返回 None。
- 在线超时 15s；输入框禁随意填 URL（不放开 SSRF 面）。
- JWT/直链不落 `run.log` 不落日志。

## 五、配置字段（config.json / GUI版\config.json）

`data_source=seafile`、`online_url`、`cache_xlsx`、`online_timeout=15`、`online_auto_refresh=true`。数据源枚举收口为 `seafile`，复用 `online_url` 不新增配置项。

## 六、GUI 增量

配置区新增「内网在线链接」输入框 + 「从在线刷新」按钮，刷新走三级回退，成功后更新今日值班显示（`var_leader` / `var_duty`）。

## 七、已知坑（踩过）

- **`to_date` 被编辑破坏**：曾只剩 `return None`，导致 `data is None` / 有效行数=0。已恢复完整实现（兼容 datetime/date/Excel 序号/多种日期字符串）。改函数体时须整段核对。
- 精确锚定未匹配时的调试法：逐行打印 `cells` + 各列定位结果，定位表头行后再看数据行。

## 八、验证结论（源码层全绿）

- 值班=F、带班=C 合并向前回填、D/E 白班附加保留、三班轮换（田浩江→常波→艾尼瓦尔）。
- 黄金锚点：首行带班留空不把表头当人名、周末回溯本周领导正确。
- 端到端在线：内网直链下载 14034 字节 → 解析 64 行 → 2026-11-14 带班=常波、值班=张德智。
- 安全：恶意 URL 白名单拦截（None）、断网回退本地成功、`online_auto_refresh` 开关行为正确。

## 待办

- **尚未重打包 exe**（CLI + GUI 均旧版）：等 QA 源码层 9 条验收 + 安全复核后统一重打包 v1.2。

## 源路径

- `值班提醒机器人/duty_reminder.py`
- `值班提醒机器人/gui.py`
- `值班提醒机器人/config.json`

## 相关文档

- 数据源定稿（内网 Seafile 直链）：`943996c6-7da4-4e0c-bfda-7a08e27c0833`
- GUI QA 修复迭代与在线读取适配器设计：`0af5d098-b497-4862-965b-cc0a40427407`
