# py-spider-pro

> PY爬虫开发专业工具集 v3.0 | 专为Operit AI优化 | 9个精炼工具 | 极简token消耗 | 一键分析→生成→验证

基于 [MCP](https://modelcontextprotocol.io/) 协议，为 Operit AI 提供精炼的爬虫开发工具集。

## 支持范围

**本工具专注于 MacCMS 系列网站（v8/v10）以及标准 API 采集模式的爬虫生成。**

对于非 MacCMS 架构的网站，工具会尝试使用通用选择器生成代码，可能需要手动调整。

## 与 py-mcp-full 对比

| 维度 | py-mcp-full (21工具) | py-spider-pro (9工具) |
|------|---------------------|----------------------|
| 工具数 | 21个（13文件+8爬虫） | 9个（纯爬虫核心） |
| Token消耗 | 高（冗长描述+文件工具重复） | 低（精简描述+去除冗余） |
| 核心创新 | 无 | one_click_spider 一键搞定 |
| 文件操作 | 13个文件工具 | 依赖Operit内置（无需重复） |
| 正则安全 | vm沙箱+worker降级 | 简化（降低复杂度） |
| 模板系统 | 4种CMS+覆盖 | MacCMS v8/v10 + API采集（保留完整） |
| 缓存 | LRU+持久化+debounce | LRU+持久化+debounce（保留） |
| 错误处理 | 简单 | 统一错误体系（10种错误类型） |

## 9个精炼工具

| # | 工具 | 功能 | 必要参数 |
|---|------|------|----------|
| 1 | `one_click_spider` | 🔥一键分析+生成+验证 | url |
| 2 | `analyze_website` | 深度分析网站结构 | url |
| 3 | `debug_selector` | 调试CSS/XPath选择器 | url, selector |
| 4 | `debug_play_link` | 调试播放链接提取 | url |
| 5 | `test_interface` | 静态+语义分析五大接口 | source_code, interface |
| 6 | `evaluate_source` | 代码规范评估(9项) | source_code |
| 7 | `batch_analyze` | 批量并行分析 | urls |
| 8 | `show_history` | 显示分析和生成历史记录 | - |
| 9 | `clear_history` | 清除历史记录 | - |

## 快速开始

### 安装
```bash
cd /storage/emulated/0/Download/Operit/mcp_plugins/py-spider-pro
npm install
```

### MCP配置
```json
{
  "mcpServers": {
    "py_spider_pro": {
      "command": "node",
      "args": ["/storage/emulated/0/Download/Operit/mcp_plugins/py-spider-pro/index.js"]
    }
  }
}
```

### 使用流程
```
# 快速模式（推荐）
one_click_spider(url="https://example.com")
→ 自动：分析 → 识别CMS → 生成源码 → 验证

# 精细模式
analyze_website(url) → debug_selector → one_click_spider → test_interface
```

## 默认配置

```javascript
HTTP_TIMEOUT = 15000        // 请求超时(ms)
MAX_RETRIES = 3             // 最大重试次数
CACHE_TTL = 30分钟          // 缓存有效期
CACHE_MAX_ENTRIES = 100    // 最大缓存条目
DEBUG_DISPLAY_COUNT = 3     // 调试结果显示数量
```

## 项目结构
```
py-spider-pro/
├── index.js                    # 入口
├── manifest.json               # 工具Schema
├── package.json
├── vitest.config.js            # 测试配置
├── lib/
│   ├── config.js               # 集中配置
│   ├── errors.js               # 统一错误体系（10种类型）
│   ├── utils.js                # 公共工具
│   ├── url_utils.js            # URL纯函数
│   ├── http_client.js          # HTTP客户端(限速+CF降级+LRU)
│   ├── cache.js                # 缓存管理
│   ├── history_manager.js      # 历史记录管理
│   ├── analyze.js              # 网站分析模块
│   ├── generate.js             # 爬虫生成模块
│   ├── debug.js                # 调试工具模块
│   ├── spider_test_tools.js     # 测试/评估工具
│   ├── analyze_orchestrator.js  # 分析编排器
│   ├── selectors.json          # 选择器配置
│   └── templates/              # 模板目录
│       ├── index.js
│       ├── heredoc.js
│       ├── maccms_v8.js        # MacCMS v8 模板
│       ├── maccms_v10.js        # MacCMS v10 模板
│       ├── api_collect.js       # API采集模板
│       └── nonstandard.js       # 非标模板（通用选择器）
└── tests/                      # 单元测试
    ├── test_errors.js
    ├── test_config.js
    ├── url_utils.test.js
    └── utils.test.js
```

## 核心特性

### 🔧 一键爬虫生成
- 自动识别 CMS 类型（MacCMS v8/v10、API采集）
- 智能提取视频列表、播放源、搜索接口
- **生成可运行的代码**，使用合理的默认选择器

### 🛡️ 反爬策略
- 动态 User-Agent 池
- 智能请求限流
- Cloudflare 挑战检测与 HTTP/2 降级
- 自动重试机制

### 📊 错误处理
- 统一错误类型体系（10种错误类型）
- 详细的错误提示和解决方案
- 支持 Cloudflare、超时、限流等特殊错误处理

### 💾 缓存系统
- LRU 缓存策略
- 持久化存储
- 智能缓存失效机制

## 测试

```bash
npm test
```

## License
MIT