---
name: py-spider-pro-mcp
description: py-spider-pro MCP 服务器（Node.js，10 工具）的安装、注册与使用。TVBox/hipy Python 爬虫源开发的桌面端辅助工具集：一键分析网站→生成 Spider 源码→静态/语义验证。当需要 analyze_website/one_click_spider/debug_selector/debug_play_link/test_interface/evaluate_source/batch_analyze/health_check 等工具，或在本机注册、重建该 MCP 服务器时使用。是 tvbox-py-spider 技能的配套 MCP（写源方法论在 tvbox-py-spider，本技能是工具服务）。
---

# py-spider-pro MCP（电脑端专用）

TVBox/hipy Python 爬虫源开发的桌面端 MCP 工具服务器，原位于 tvbox 仓库 `.trae/skills/电脑版专用MCP/py-spider-pro/`，随技能集移植到本目录。**专注 MacCMS v8/v10 与标准 API 采集模式**；非 MacCMS 架构站点会尝试通用选择器生成，可能需手动调整。

## 目录结构

```
py-spider-pro-mcp/
├── SKILL.md                  本文件
├── 电脑端使用指南.txt          原始安装指南（Operit/Trae 视角）
└── py-spider-pro/             MCP 服务器源码（Node.js ESM）
    ├── index.js               入口（node index.js 直接跑，需 npm install）
    ├── manifest.json          工具 Schema 单一数据源
    ├── build.js               esbuild 打包脚本（npm run build）
    ├── lib/                   源码模块（analyze/generate/debug/spider_test_tools/cache/http_client/templates 等）
    ├── dist/                  打包产物（dist/index.mjs 单文件，免安装依赖直接跑）
    └── tests/                 vitest 单元测试
```

## 工具清单（10 个）

| 工具 | 功能 | 必要参数 |
|---|---|---|
| `one_click_spider` | 🔥 一键分析+生成+验证：分析网站→识别 CMS→选模板→注入选择器→完整性验证 | `url` |
| `analyze_website` | 深度分析网站结构（MacCMS v8/v10/API/非标、分类、选择器、加密、搜索方式），结果缓存 30 分钟 | `url` |
| `debug_selector` | 调试 CSS/XPath 选择器，返回匹配数量与前 3 个结果 | `url`, `selector` |
| `debug_play_link` | 调试播放链接：递归解析 m3u8/mp4 直链、iframe 嵌套（≤3 层）、v8/v10/xgplayer 变量提取 | `url` |
| `test_interface` | 静态+语义分析五大接口完整性（Python 结构解析、方法存在性、严重度分级） | `source_code`, `interface` |
| `evaluate_source` | 源代码规范评估（9 项加权检查），输出等级 S/A/B/C | `source_code` |
| `batch_analyze` | 并行分析多个网站（默认 3 并发），汇总 CMS 类型/选择器/搜索方式 | `urls` |
| `show_history` | 显示分析与生成历史记录 | - |
| `clear_history` | 清除历史记录 | - |
| `health_check` | 健康检查：服务状态、依赖加载、配置、缓存 | - |

## 在 WorkBuddy 中注册（mcp.json）

WorkBuddy 的 MCP 配置文件为 `C:\Users\zhang\.workbuddy\mcp.json`（**不是** `.mcp.json`）。已有其他服务器时把新条目合并进 `mcpServers`，不要整体覆盖。

推荐用打包产物 `dist/index.mjs`（esbuild 单文件，无需 npm install）：

```json
{
  "mcpServers": {
    "py_spider_pro": {
      "command": "C:\\Users\\zhang\\.workbuddy\\binaries\\node\\versions\\22.22.2-6\\node.exe",
      "args": [
        "D:\\交投资料\\相关文档\\07-Git文件\\Github\\WebHTV\\webhtv\\.workbuddy\\skills\\py-spider-pro-mcp\\py-spider-pro\\dist\\index.mjs"
      ],
      "env": {
        "ROOT": "D:\\交投资资料\\相关文档\\07-Git文件\\Github\\WebHTV\\webhtv\\.workbuddy\\skills\\py-spider-pro-mcp\\output"
      }
    }
  }
}
```

- `command`：node 在 PATH 时可写 `"node"`；不确定时用上面的绝对路径（WorkBuddy 托管 Node 22）。
- `env.ROOT`：生成文件的存放根目录，按需修改；未设置时用进程 cwd。
- 写入后**不会自动生效**：需打开连接器管理页右上角的自定义连接器入口，对新服务器点"信任"启用。
- 写源方式（站点分析→生成→六接口实测→门禁验收）见同级技能 `tvbox-py-spider` 的 SKILL.md；两者配合使用：本技能供工具，tvbox-py-spider 供方法论。

## 重建与测试（可选）

```bash
cd py-spider-pro
npm install          # 安装依赖（@modelcontextprotocol/sdk、axios、cheerio、xpath、zod 等）
npm run build        # esbuild 重新打包到 dist/index.mjs
npm test             # vitest 单元测试
npm start            # 以 index.js 直接启动（调试用）
```

`dist/index.mjs` 是构建产物，改 `lib/` 后需重新 `npm run build` 才会生效。

## 默认配置

`HTTP_TIMEOUT=15000ms`、`MAX_RETRIES=3`、`CACHE_TTL=30min`、`CACHE_MAX_ENTRIES=100`、`DEBUG_DISPLAY_COUNT=3`，均在 `lib/config.js`。

## 反爬与容错特性

- 动态 User-Agent 池 + 智能请求限流
- Cloudflare 挑战检测与 HTTP/2 降级
- 统一错误体系（10 种错误类型，`lib/errors.js`）
- LRU 缓存 + 持久化 + 防抖

## 边界

- 仅覆盖 MacCMS v8/v10 与标准 API 采集站；SPA/加密/高反爬站按 tvbox-py-spider 的方法论人工处理，不要迷信一键生成。
- 生成的源码必须经过 `static_check.py` 与六接口实测（含真直链内容验证）才算完成，未验证项明确标注。
