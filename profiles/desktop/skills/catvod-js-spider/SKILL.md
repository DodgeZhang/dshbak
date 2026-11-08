---
name: catvod-js-spider
description: 猫影视/CatVod 系 JavaScript 爬虫源开发，覆盖两种运行形态：(1) 通过 js.js/JSFactory 上传到设备的本地 JS spider（ESM 默认导工厂函数、fastify 路由、依赖白名单、bundle/data URL 加载）；(2) CatPawOpen Node.js 服务端爬虫（Fastify + Axios + Cheerio，服务端注册、统一 API 服务 CatVod 客户端）。用户提到"猫源""JS源""js spider""js.js 上传""JSFactory""CatPawOpen""CatVod node 爬虫"，或要写普通点播源、带本地 proxy 的源、网盘源、网盘分组源时使用。不用于 TVBox py 源（用 tvbox-py-spider/py-spider-v84）、jar 源或 FongMi WebHome HTML 页面（用 webhome-*）。
---

# 猫影视 JS Spider 开发（catvod-js-spider）

猫系 JS 源的统一入口。先判断运行形态，再读对应参考文档。

## 形态判定

| 形态 | 特征 | 参考文档 |
|---|---|---|
| **设备端本地 JS 源**（常见） | 脚本通过 `js.js` / JSFactory 上传，bundle/data URL 加载；ESM 文件；只默认导出一个工厂函数；依赖只能用白名单 | `references/local-js-spider-rules.md`（规范全文，32KB，含 4 类完整示例） |
| **CatPawOpen 服务端** | Node 项目里的 spider 模块，Fastify 服务器统一对外 API，可自由用项目 req.js/cheerio/crypto-js；需在项目内注册部署 | `references/catpaw-server-guide.md`（26KB，含项目结构、工具函数、KanAV 实战、注册部署） |

判断不了时默认按**设备端本地 JS 源**处理（约束更严，宽松环境也能跑）。

## 本地 JS 源铁律（摘要，细节见 local-js-spider-rules.md）

1. **固定导出**：`export default function createSpider(name, config) { return { meta, api, check } }`，不允许直接 `export default {...}`（那只在仓库源码运行时可用）
2. **meta**：`{ key（稳定唯一、仅字母数字_-)、name、type: 3 }`，不要与已启用内置源同 key
3. **路由**：在 `api(fastify)` 里注册相对路径 `/init /home /category /detail /play /search`，禁止写 `/spider/xxx/3/home` 全路径
4. **依赖白名单**：只能用文档列出的 Node 内置模块、裸包名白名单、项目内部模块白名单；不能 import 白名单外文件
5. **check** 只做轻量探活，禁止大规模抓取
6. 四种场景在文档中有可直接改的完整示例：普通站点、带本地 proxy、网盘源、网盘分组源；另有首页缓存、请求去重/并发、每分类不同筛选的补充模式

## 服务端开发要点（摘要，细节见 catpaw-server-guide.md）

- 技术栈：Node ESM + Fastify 4.26 + Axios 1.6 + Cheerio rc12 + crypto-js 4.2
- Spider 接口与本地版语义一致（init/home/category/detail/play/search），但导出与注册按项目 4.3 节规范，走 `req.js` 统一 HTTP 工具
- 开发流程：分析站点（HTML/API/加密）→ 按模板写 spider → 项目内注册 → Fastify 本地调试 → 部署
- Cookie 管理、反爬、数据提取、URL 处理、常见错误见手册第 8 章

## 与其他技能的边界

- TVBox/影视仓/hipy 的 **Python** 源 → `tvbox-py-spider`（本仓库 haitun/ext 那套）、通用全类型 py 源 → `spider-create` / `py-spider-v84`
- jar 内 csp Java 源逆向 → `tvbox-jar-patch`
- FongMi WebHome 的自定义首页 HTML / 注入扩展脚本 → `webhome-homepage` / `webhome-extension`
- py 源的跨壳加载契约（getDependence、localProxy 四项返回等）虽写的是 py，但接口语义在排障猫源返回结构时也可对照：`../tvbox-py-spider/references/multi-shell-spider-contract.md`

## 来源

原始资料：tvbox 源仓库 `.trae/skills/写源技能书/` 下《猫源js脚本开发文档.md》《爬虫编写手册.md》（CatPawOpen），整理为本技能 references。
