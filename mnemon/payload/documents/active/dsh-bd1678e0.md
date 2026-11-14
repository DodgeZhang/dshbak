---
id: "bd1678e0-ea21-4978-a1dc-b6792c219dfa"
title: "DSH 第三方插件清单审计与精简结论"
description: "2026-11-14 盘点 profile 25 个第三方插件的作用、保留/精简分类、需增加项结论，及 dsh-plugins-git-sync 无更好替代的专项结论。以后问插件作用、能否精简、需补什么插件时召回。"
status: "active"
created_at: "2026-11-14T08:22:18.162Z"
updated_at: "2026-11-14T08:22:18.162Z"
content_hash: "f19ce1629fdb34c1538cef5fd92e46dbdd181ffa1a941be527a38f8d41e7dffa"
source_paths:
  []
session_ids:
  - "mnemon-run-v1-8242a46e-35c3-4d13-a9dc-52c088b29a00"
memory_body_ids:
  []
---

# DSH 第三方插件清单审计与精简结论

来源：2026-11-14 用户要求盘点已装插件的作用、可精简项与建议增加项。清单取自 `profiles/desktop/package.json` 的 25 个第三方依赖（另有一批 DSH 自带核心组件，动不得，不在盘点范围）。

## 核心必留（10，删了直接瘫痪）
- ds-bot：16 个 Bot、两个群、团队协作，命根子
- dsh-connect-workbuddy：模型主力渠道（deepseek-v4-pro / hy4free / hy3 都从这来）
- dsh-connect-trae / dsh-connect-qoder：另两条模型渠道，多通道备份
- dsh-mnemon：记忆系统（偏好、检索约定、值班表规律）
- dsh-recall-plugin：recall/remember 记忆工具
- dsh-token-optimizer：省 token、长文溢出转存（spill）
- dsh-mcp-skill-manage：管技能与 MCP 服务器
- @liustack/modsearch：web_search / x_search / read_page 搜索桥
- dsh-plugin-github：github_search / github_get 查代码库

## 实用保留（11）
dsh-cloudflare-codemode（Cloudflare API/MCP）、@adenxie/dsh-vercel（Vercel 部署）、dsh-git-plus（Git 增强）、dsh-plugins-git-sync（插件+技能跨设备同步）、@xmanrui/dsh-im（即时通讯群文件）、dsh-better-sidebar（侧边栏增强）、dsh-streamfold（长输出折叠）、@chendaleiq/dsh-plugin-auto-update（插件自动更新）、dsh-restart-now（一键重启）、dsh-open-market（插件市场）、dsh-personalization（个性化称呼/人设）。

## 可精简（4）
- dsh-pet-live2d：Live2D 桌面宠物 → 用户明确保留（装饰）
- dsh-plugin-wallpaper-engine：壁纸引擎，子包最多 → 用户明确保留（装饰）
- @jianyiagi/dsh-prompt-enhancer：提示词增强 → 用户未表态，用过则留
- dsh-purge：指令清洗（purge_apply/revert）→ 用户未表态，日常用不上可删

## 建议增加项
结论：无缺项，不硬加。浏览器自动化已内置 ds-bot；RSS 订阅可选（web_search 可替代）。

## dsh-plugins-git-sync 专项结论
无更好替代，保留。它是「插件+技能跨设备同步」的头部方案：
- 备份插件清单 + 技能树为 JSON + 文件树，Git 直接 diff
- 双向同步、冲突处理、历史回滚（本地留 20 份快照）、启动/装卸更插件时自动触发
- 安全：不读不上传 token/密码/密钥，插件配置、Agent preset、UI 设置一概不碰
- 边界：只同步「插件清单 + 技能」，不同步 Bot 团队数据、模型分配方案、个性化设置

与《AI团队建队提示词包.md》（`C:\Users\zhang\.dsh\bot\workspace\AI团队建队提示词包.md`）互补：git-sync 搬插件与技能，提示词包搬团队与模型配置，合起来可 1:1 复刻另一台电脑。

## 相关文档
- 模型分配四档方案：`9ec085f5-336f-4486-915c-758963ea01f9`
- AI 文案团队方案：`7239f584-cfd0-4130-9813-cc438bea9348`
