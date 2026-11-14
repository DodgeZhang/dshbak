---
id: "4002c165-b190-459d-a22a-f007eafca3f5"
title: "值班提醒机器人 GUI 版安全验收：四条红线、windowed 落盘与计划任务高危确认"
description: "GUI 版（tkinter --windowed）安全侧四条红线验收清单与实测放行结论：日志落盘、webhook 脱敏、计划任务确认框、onedir+utf-8-sig 防回归；承接 a28a16fa / 055cb971。"
status: "active"
created_at: "2026-11-14T10:55:49.155Z"
updated_at: "2026-11-14T10:55:49.155Z"
content_hash: "f4260351d156b58943c8bc2670437e2f61e0d8c1b909bf3f30988d55bd2e3043"
source_paths:
  - "值班提醒机器人/gui.py"
  - "值班提醒机器人/审核意见.md"
session_ids:
  - "mnemon-run-v1-2e0d8783-1cfa-4135-9476-9c2a32d67a02"
memory_body_ids:
  []
---

# 值班提醒机器人 GUI 版安全验收（安全运维四条红线）

> 来源：2026-11-14 晚段 GUI 版（tkinter）安全侧复核。承接 `a28a16fa-2591-4c54-a55b-63ac71f85d0f`（onefile 闪退真根因：腾讯管家拦截自解压）与 `055cb971-bbd7-46f1-96f3-b3972d3653fb`（v1.0 onedir 收尾与 config 乱码勘误）。本文只记 GUI 版新增的安全验收口径与实测结论，根因/打包/编码细节见前述文档，不重复。

## 一、GUI 版安全四条红线（验收清单）

1. **windowed 必须配日志落盘**：`--windowed` 无控制台，异常与日志同步落盘 `duty_gui.log`，关键错误 `messagebox.showerror` 弹窗——否则「点了没反应、无处排查」。
2. **日志不落 webhook 明文**：测试推送只记成功/失败与注册命令（exe 路径），不把 `webhook_url` 明文写进日志文件。
3. **计划任务高危操作弹确认框**：注册/卸载（`schtasks /Create|/Delete`）按钮触发前必须 `messagebox.askyesno`；卸载作为回滚手段保留并记日志。
4. **防回归**：沿用 onedir（无 `_MEI` 临时解压）+ utf-8-sig 读写，规避杀软拦截与编码坑。

## 二、实测结论（放行）

- GUI exe PE 头 **Subsystem=2（windowed 无黑窗）**；onedir 形态 `_internal` 1063 文件，含 `tcl8/_tk_data/tcl86t.dll/tk86t.dll/_tkinter.pyd`，tkinter 零新依赖选型成立。
- `gui.py` 落实：`LOG_PATH=duty_gui.log` + `_write_file_log` 落盘 + `_LogRedirect` 界面回显 + `_safe_run` 异常弹窗；测试推送仅记结果；`_confirm_install/_confirm_uninstall` 两个 `askyesno` 确认框；`_run_silent` 用 `CREATE_NO_WINDOW(0x08000000)` 避免 os.system 闪黑窗。
- 入口分流：`--daily/--test/--date/--install/--uninstall/--cli` 走 core 静默逻辑，无参才进 GUI `launch()`；计划任务调用不弹窗。
- 安全侧闸门**通过（放行）**，交测试QA照单复验、发布专员定稿 v1.1。

## 三、部署前置（不变）

- `config.json` 补 `webhook_url`；金山文档导出的 `排班表.xlsx` 放入 GUI 版同目录。

## 相关文件

- `值班提醒机器人\gui.py`（GUI 入口，安全约定写在模块 docstring 第 4-8 行）
- `值班提醒机器人\GUI版\`（duty_reminder_gui.exe + _internal/ + config.json）
- `值班提醒机器人\审核意见.md`（原文保留 + 勘误节，勿重复改 config 编码）
