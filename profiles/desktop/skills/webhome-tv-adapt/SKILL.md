---
name: webhome-tv-adapt
description: FongMi TV WebHome 全栈开发与 TV/触屏双端适配 Skill。覆盖全流程：创建 WebHome 自定义首页单文件 HTML（homePage/nostr.html 风格推荐页/TMDB/Nostr/PanSou/透明 WebView）、构建 WebHome 注入扩展脚本（webHomeExtensions/sites[].extensions/fm SDK/网盘磁力播放/fm.vodInline 按集解析/媒体嗅探/TV 焦点）、为已完成单文件 HTML 媒体应用做 TV 遥控器焦点导航+手机触屏双端注入式适配（不覆盖原文件）、官方大版本更新同步重建、真实 TV 老内核兼容、JS 逆向与 Cloudflare/WAF 可行性诊断。Use when 用户要求创建或修改 WebHome homePage/自定义首页、开发或审查 WebHome 扩展脚本、给现有网页加电视遥控焦点导航/返回键/媒体键、同时做手机触屏热区与响应式改造、同步官方更新重建 TV 适配版、或做旧 WebView 兼容修复。
---

# WebHome 全栈开发与 TV/触屏双端适配

本技能合并了 WebHome 自定义首页开发、WebHome 注入扩展构建、HTML 网页 TV 遥控+手机触屏双端注入式适配三大能力，覆盖从零创建首页 → 构建扩展增强真实网站 → 给已完成 HTML 做双端适配 → 官方更新同步重建的完整生命周期。

## 什么是 WebHome

WebHome 是 FongMi TV（`com.fongmi.android.tv`）的 CSP 自定义网页首页能力。站点配置 `homePage` 后，切换到该站点时加载 HTML 页面代替原生推荐页。页面运行在 App WebView 中，可调用 `window.fm` SDK 访问 App 全部能力（播放、网盘、搜索、缓存、设备信息等）。

**本质：单文件 HTML，不需要打包，改了刷新即生效。**

除了自定义首页，WebHome 还支持**注入扩展脚本**（`webHomeExtensions` / `sites[].extensions`）：在 App WebView 里加载真实网站后，通过注入脚本增强网站——拦截资源按钮、把网盘/磁力/直链交给 App 播放、增加"App 播放"按钮、清理干扰 UI、嗅探运行时媒体地址、按手机/电视形态重排版面。

---

## 兼容性门禁（非协商，发布前必过）

把旧 Android WebView 兼容性当作**发布阻断项**。App `minSdk` 为 24，很多电视盒子停留在 Chromium 51-70。一个语法级错误会让整个单文件首页在任何 `try/catch` 执行前就白屏。

完成任何生成或编辑的 WebHome HTML/扩展脚本前：

1. 业务 JavaScript 保持 ES2017 或更低。
2. 首页第一个内联脚本必须是 **ES5-only 兼容引导**（用 `var` 和 `function`，无依赖，在所有 CSS/SDK 敏感代码之前运行）。
3. 避免脆弱的 CSS 选择器和值，除非已有兜底。
4. 首页运行 `python3 scripts/check_webhome_compat.py <html-file>`，修复所有报错，警告项需有兜底或正当理由。
5. 扩展脚本同样遵守 ES2017 及以下，详见 `references/old-webview-compatibility.md`。

---

## 参考资料索引

按需读取，不要一次性全部读取：

| 文件 | 用途 |
| --- | --- |
| `references/webhome-app-guide.md` | 完整 App 开发文档（32 章）。首页开发读 14-25、29-32 章；本地 HTTP/调试端点读 13 章；网盘读 21 章；Nostr 推荐读 25 章 |
| `references/webhome-homepage-patterns.md` | 首页架构精要：App 契约、SDK 适配器、网络、Chrome/视口、透明 UI、路由恢复、手机/TV UX、PanSou、性能、调试 |
| `references/webhome-extension-guide.md` | 完整 WebHome 扩展脚本开发指南（18 章）。多数脚本读 4、7、9-15 章；`fm.vodInline` 读 8 章；最终兼容审查读 13 章 |
| `references/template-and-example-catalog.md` | 模板与示例清单，选择起始模板和真实示例参考 |
| `references/nostr-demo-patterns.md` | 从 `nostr.html` 提炼的高价值章节、兼容设计、数据模型、Relay 同步、渲染、焦点、PanSou、观影追踪模式 |
| `references/old-webview-compatibility.md` | 旧 WebView 兼容详细规则与审查清单（JS 语法/API/CSS 避雷） |
| `references/js-reverse-and-waf-workflow.md` | 当首页数据或扩展依赖隐藏 API/签名/播放器资源发现/运行时请求捕获/本地 JS 复现/Cloudflare-WAF 诊断时读取 |
| `references/engine-patterns.md` | TV 焦点引擎关键代码模式（从 AppleMusicTV.html 注入引擎提炼的可复用骨架） |

---

# 第一部分：创建 WebHome 自定义首页

## 开发流程（强制）

```
1. 需求分析 → 确定功能范围（推荐/搜索/详情/网盘/直播等）
2. 数据源 → 确定API接口（TMDB/自建API/Spider/网盘搜索等）
3. UI设计 → 移动端优先 + 电视端遥控器适配
4. 代码生成 → 单文件HTML，使用fm SDK
5. 配置集成 → 生成站点配置JSON
6. 测试验证 → App内加载测试
```

## 站点配置

```json
{
  "key": "my_webhome",
  "name": "自定义首页",
  "type": 3,
  "api": "csp_Builtin",
  "homePage": "./my_home.html",
  "chromeMode": "edge"
}
```

- `type: 3` 是 Spider 类型，WebHome 站点必填
- `api: "csp_Builtin"` 使用内置 Spider，WebHome 站点必填
- `homePage` 支持 `./relative.html`（相对配置URL）或完整URL；别名 `home_page`、`webHome`、`web_home` 均可
- `chromeMode: "edge"` 用于首页与 App 融合

## SDK 注入与就绪

```js
window.fongmi  // 完整命名空间
window.fm      // 短别名

window.addEventListener("fmsdk", () => { /* fm 已就绪 */ });
window.addEventListener("fmresume", (e) => { /* e.detail.time, e.detail.pausedMs */ });
window.addEventListener("fmviewport", () => { /* 安全区/视口/键盘/手势/chrome 模式变化 */ });
window.addEventListener("fmurlchange", () => { /* History API 路由变化 */ });

if (window.fongmiBridge || window.fm || window.fongmi) {
  document.documentElement.classList.add("fm-native");
}
```

早期内联脚本可能在 SDK 注入前运行，读写 App 关键状态前必须等 `fmsdk` 事件。

## SDK 接口速查表

| 接口 | 签名 | 返回 | 说明 |
|------|------|------|------|
| `fm.req` | `fm.req(url, options)` | Promise | Native OkHttp 请求，绕 CORS |
| `fm.res` | `fm.res(url, options)` | string | 资源网关 URL，给 DOM src 用 |
| `fm.play` | `fm.play(url, title, options)` | Promise | 播放直链 |
| `fm.vod` | `fm.vod(siteKey, vodId, title, pic)` | Promise | 播放 CSP 影片详情 |
| `fm.vodInline` | `fm.vodInline(payload)` | Promise | 构造多集播放并按集回调解析（见扩展部分） |
| `fm.ctrl` | `fm.ctrl(action)` | Promise | 播放控制 play/pause/stop/prev/next/loop/replay |
| `fm.stat` | `fm.stat()` | Promise | 播放状态 |
| `fm.search` | `fm.search(keyword, options)` | Promise | 触发 App 搜索（`direct:true` 直接进结果列表） |
| `fm.openKeep` | `fm.openKeep()` | Promise | 打开收藏页 |
| `fm.openLive` | `fm.openLive()` | Promise | 打开直播页 |
| `fm.history` | `fm.history()` | Promise | 最近观看列表（60天） |
| `fm.pan.check` | `fm.pan.check(items)` | Promise | 网盘有效性检测 |
| `fm.pan.play` | `fm.pan.play(payload)` | Promise | 网盘/磁力播放 |
| `fm.check` | `fm.check(items)` | Promise | fm.pan.check 短别名 |
| `fm.cache` | `fm.cache.get/set/del` | Promise | 跨重启持久化存储（只存字符串） |
| `fm.device` | `fm.device()` | Promise | 设备信息（uuid/name/ip/type/serial 等） |
| `fm.site` | `fm.site()` | Promise | 当前站点信息 |
| `fm.config` | `fm.config()` | Promise | 当前配置（含 driveCheck 网盘检测开关） |
| `fm.back` | `fm.back()` | Promise | 返回/GoBack |
| `fm.reload` | `fm.reload()` | Promise | 清缓存重新加载 |
| `fm.ui.setChrome` | `fm.ui.setChrome(opts)` | Promise | chrome 模式/安全区集成 |
| `fm.ui.restoreChrome` | `fm.ui.restoreChrome()` | Promise | 恢复 chrome |
| `fm.ui.getViewport` | `fm.ui.getViewport()` | Promise | 视口信息 |

### fm.req(url, options)

通过 Native OkHttp 发起，不受浏览器 CORS 限制。

```js
const res = await fm.req("https://api.example.com/data", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ keyword: "仙逆" }),
  responseType: "json",
  timeout: 30,
  credentials: "include"
});
if (!res.ok) throw new Error(res.error || `HTTP ${res.status}`);
console.log(res.body);
```

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `method` | string | GET | GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS |
| `headers` | object | {} | 请求头，未提供UA时自动补 |
| `body` | string | "" | 请求体（字符串），JSON需自行stringify |
| `responseType` | string | text | text/json/base64 |
| `timeout` | number | 30 | 秒，最小1 |
| `credentials` | string | - | include时自动带WebView Cookie |

返回：`ok/status/url/headers/cookies/body/error`

### fm.res(url, options)

生成本地 `/webResource` 地址，适合 `img.src`、`video.src`、CSS 背景图等 DOM 资源。返回字符串（不是 Promise）。支持 headers、cookies、Range、CORS。

```js
img.src = fm.res("https://image.tmdb.org/t/p/w500/xxx.jpg");
video.src = fm.res(videoUrl, { headers: { Referer: "https://example.com/" }, credentials: "include" });
```

**fm.req vs fm.res 选择：** API数据用 fm.req，DOM资源用 fm.res。永远不要硬编码 `127.0.0.1:9978`，端口可能变化，需要时从 `fm.device().ip` 读取。

## 透明背景

```css
html, body { margin: 0; min-height: 100%; background: transparent; }
html:not(.fm-native), html:not(.fm-native) body { background: #1a1a2e; }
.app { min-height: 100vh; background: transparent; }

:root {
  --panel-rgb: 30, 30, 50;
  --panel: rgba(var(--panel-rgb), .75);
  --panel-soft: rgba(var(--panel-rgb), .55);
  --panel-strong: rgba(var(--panel-rgb), .85);
  --line: rgba(255, 255, 255, .12);
}
.card { background: var(--panel-soft); border: 1px solid var(--line); }
```

浮层打开时隐藏底层：`body.detail-active .app { visibility: hidden; pointer-events: none; }`

文字必须放在半透明面板/控件上，不要直接放在壁纸上。

## 安全区与 Chrome

```css
:root {
  --safe-top: max(var(--fm-safe-top, 0px), env(safe-area-inset-top, 0px));
  --safe-bottom: max(var(--fm-safe-bottom, 0px), env(safe-area-inset-bottom, 0px));
}
```

- **不要**把 `--fm-safe-*` 和 `env()` 相加（App 已注入真实值，相加会重复计算），用 `max()` 取较大值。
- 全高布局用 `var(--fm-web-height, 100vh)`。
- `chromeMode: "edge"` 或 `fm.ui.setChrome({ mode: "edge", startup: true })` 用于首页融合。
- `immersive` 仅用于有页面自带返回按钮的详情/全屏聚焦体验，关闭时恢复 chrome。

## 路由和返回

```js
function navigate(route, data) {
  history.pushState({ route, data }, "", "#" + route);
  render(route, data);
}
window.addEventListener("popstate", event => {
  const state = event.state || { route: "home" };
  render(state.route, state.data);
});
```

`popstate` 时关闭活动顶层面板而非拆除全部状态。局部面板返回优先拦截（如 PanSou 结果 → PanSou 标签 → 详情 → 首页）。

## 本地 HTTP API

| 路径 | 方法 | 说明 |
|------|------|------|
| `/action` | GET/POST | 搜索/推送/设置/刷新/控制/同步/投放 |
| `/media` | GET/POST | 播放状态 |
| `/cache` | GET/POST | 缓存读写删 |
| `/pan/check` | POST | 网盘检测 |
| `/webResource` | ALL | 资源网关 |
| `/file/{path}` | GET | 文件浏览/下载 |
| `/upload` | POST | 上传（zip自动解压） |
| `/debug/logs` | GET | 调试日志 |

调试日志关键字：`webview`、`webhome`、`webhome-console`、`webhome-net`、`web-resource`、`webhome-key`、`webhome-focus`、`pan.check`、player。

## PanSou 网盘搜索集成

```js
const PAN_API = "https://so.252035.xyz";

// 搜索
const res = await fm.req(`${PAN_API}/api/search`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ kw: "片名", res: "merge", src: "all", cloud_types: ["quark","aliyun"] }),
  responseType: "json"
});
```

处理 `data.merged_by_type`；过滤启用的盘类型；按 `diskType + normalizedUrl` 去重；按盘类型分标签渲染。部分服务异步追加结果，需轮询几次合并新结果不清空旧结果。

## 最佳实践

1. 单文件HTML，不引入构建流程
2. API请求用 `fm.req`，避免 CORS
3. DOM资源用 `fm.res`
4. 搜索用 `fm.search(keyword, { direct: true })`
5. 多层页面用 History API
6. 透明背景不给 html/body 写死纯色
7. 浮层打开时隐藏底层页面
8. 文字区域用半透明面板
9. 网盘检测先读 `fm.config().driveCheck`
10. 所有 Promise 都 catch
11. 不依赖固定端口

---

# 第二部分：构建自定义首页（Homepage Builder）

## 默认交付物

优先单文件自包含 HTML，除非用户明确要求多文件项目。包含：

- `<!doctype html>`、`lang`、`charset=utf-8`、带 `viewport-fit=cover` 的 viewport
- 透明 App 背景 + 非 App 浏览器兜底背景
- 第一个内联 ES5 引导：polyfill 小 API 缺口，添加 `fm-native`、`no-layout-gap`、`no-css-functions`、`no-aspect-ratio` 等兜底类
- 等待 `fmsdk` 的业务脚本（需要 App SDK 数据时），提供浏览器预览兜底
- 展示 `sites[].homePage` 用法的配置片段

## 架构工作流

按以下分层设计首页：

1. **兼容引导**：ES5 only，无依赖，在所有 CSS/SDK 敏感代码之前运行。
2. **配置**：一个 `window.WEBHOME_CONFIG` 对象管理 API 基址、功能开关、缓存键、Relay 列表、PanSou 选项、视觉默认值。
3. **SDK 适配器**：暴露一个 `sdk()` 助手，App 中用 `window.fm`，浏览器预览用兜底。
4. **数据层**：`fm.req()` 做跨域 API JSON；`fm.res()` 做需要头/cookie 的图片、视频、字幕、CSS 背景资源。
5. **持久化**：SDK 就绪后用 `fm.cache` 做跨重启持久 App 状态；`localStorage` 仅用于浏览器预览兜底或一次性 UI 状态。
6. **UI 状态**：集中状态；按稳定键渲染列表；面板、详情、PanSou 结果、状态面板独立可补丁。
7. **路由**：History API 管理详情、图片、同步、嵌套面板；让 App 返回处理在同源 history 边界内工作。
8. **恢复**：短 TTL UI 快照存 `fm.cache`；仅在 `_fm_restore=1`、`fmresume`、`pageshow` 或播放返回时恢复深度 UI。

数据源是现有网站而非文档化 API 时，先运行 `python3 scripts/probe_webhome_target.py <url>` 并遵循 `references/js-reverse-and-waf-workflow.md`。探针报告 `waf-blocked` 时，不要构建直接抓取首页，除非用户提供授权 API、所有者代理、公共源或授权会话的 HAR/HTML。

## SDK 使用规则

- `fm.req(url, options)` 做 API 数据，绕 CORS
- `fm.res(url, options)` 做 DOM 资源，返回本地 `/webResource` URL
- `fm.search(keyword, { direct: true })` 跳转 App 搜索，减少返回层级
- `fm.play(url, title, options)` 直链媒体
- `fm.vod(siteKey, vodId, title, pic)` 原生 CSP 详情/播放
- `fm.pan.play({ type, url, password, title })` 网盘/磁力/ed2k/迅雷/荐片/推送播放
- `fm.config()` 在 `fm.pan.check()` 之前调用；`driveCheck` 为 false 时不调检测
- `fm.history()` 和 `fm.stat()` 在原生播放后补偿观看进度
- `fm.ui.setChrome()`、`fm.ui.restoreChrome()`、`fm.ui.getViewport()` 做首页 chrome 和安全区集成

不在首页代码或配置中嵌入隐身指纹补丁、CAPTCHA 求解、Cloudflare clearance 采集、账号 cookie 或逐账号 token。

## UI 与 UX 规则

构建真正的 App 首页，不是落地页。媒体首页优先级：继续观看 → 推荐 → 分类列表 → 搜索 → 详情 → 播放操作。

透明 WebView：
- `html`、`body`、顶层页面背景在 App 中保持透明
- 通过 `html:not(.fm-native)` 提供非 App 兜底背景
- 文字放在半透明面板/按钮/卡片/详情面上
- 透明全屏浮层打开时隐藏底层 WebHome 层避免叠层

TV 遥控：
- 用 `window.fongmiClient.isLeanback` 或 `fm.device().type` 检测 App 形态；浏览器预览用视口启发式
- 每个可操作卡片/标签/按钮/结果项/面板控件有稳定焦点目标和键
- 方向键限制在活动局部域内（搜索建议、设置/状态面板、PanSou 结果、图片查看器、详情）
- TV 上文本框默认 `readonly`；OK/触摸进入编辑，blur/back 退出
- 优先按索引和缓存列数做确定性网格/列表导航；几何搜索仅作兜底
- 焦点样式不改变布局尺寸，用 outline、现有边框、背景或轻微 transform

## 性能规则

- 大网格分批渲染：先约 3 行，追加约 2 行
- 每个网格存渲染状态：源、总数、已渲染数、项键、渲染键
- 键不变时只补丁 active/count/status，不替换整个列表
- `IntersectionObserver` 做无限追加和可见 PanSou 检测，带被动滚动兜底
- 非关键内容渲染延迟到首次绘制后，用双重 `requestAnimationFrame`
- 滚动或遥控键重复时避免全页 `querySelectorAll()`、全列表 `getBoundingClientRect()`、同步 `scrollIntoView()`
- 缓存网格列数，视口/设备模式/布局变化时失效

## PanSou 与播放规则

- 读 `data.merged_by_type`，过滤启用盘类型，按 `diskType + normalizedUrl` 去重，按盘类型分标签渲染
- 保留旧结果直到新结果就绪；轮询合并不清空列表
- 用 view token 防止旧详情页响应覆盖当前详情
- 只检测支持的盘类型和可见结果；`fm.pan.check()` 每批约 10 条
- 健康状态排序：`ok` > `locked` > pending/idle > unsupported/uncertain > `bad`
- `fm.pan.play()` 前保存详情滚动、结果滚动、活动类型、焦点键、选中结果，以便原生播放返回时恢复上下文

观影偏好/推荐系统：
- 打开原生搜索/播放前记录观影意图
- 可用时采样 `fm.stat()`
- resume 或返回时用 `fm.history()` 补偿（WebView 播放期间可能被暂停）
- 达到有意义阈值（如观看 10 分钟）后才发布/同步，每个媒体/用户去重

---

# 第三部分：构建 WebHome 注入扩展（Extension Builder）

## 核心工作流

用本技能产出生产级 WebHome 扩展脚本，增强 App WebView 中加载的真实网站。优先做小而针对站点的增强而非替换整站：把验证过的资源路由到原生播放、添加清晰的 App 播放控件、清理有害 UI、支持 TV 焦点、保留原站的搜索/筛选/登录/翻页/详情导航。

写非平凡脚本前，阅读相关参考资料：
- `references/webhome-extension-guide.md`：完整扩展指南和 API 参考。多数脚本读 4、7、9-15 章；`fm.vodInline` 读 8 章；最终兼容审查读 13 章。
- `references/template-and-example-catalog.md`：选择模板和示例模式。
- `references/js-reverse-and-waf-workflow.md`：目标需要隐藏 API/签名/播放器/资源发现、运行时请求捕获、本地 JS 复现或 Cloudflare/WAF 诊断时读取。
- 模板和示例文件：复制或适配相关模板源码，不要凭记忆重建骨架。

## 输入确认

从用户、本地文件、目标 HTML、浏览器检查或分析器输出确认：
- 目标网站 URL 和 WebHome 站点 key（未知时提议 kebab-case key 并用精确 `cspKeyRegex` 如 `^site-key$`）
- 期望行为：点击拦截、注入 App 播放按钮、网盘链接验证、媒体嗅探、布局清理、TV 焦点、`fm.vodInline` 按集播放
- 页面角色和 URL 模式：首页、列表/搜索、详情、播放
- 稳定选择器：标题、资源容器、资源项、资源按钮/链接、剧集列表、活动集、海报
- 资源源：DOM 属性、`href`、`onclick`、附近文本、复制文本、API 响应、播放器构造函数、加密页面状态、运行时媒体请求
- 访问/WAF 状态：直接 HTTP 结果、App WebView 结果、Cloudflare/WAF/挑战信号、登录/会话假设、是否有授权 API/代理/HAR

页面无法访问时，索要：目标 HTML、截图+DOM 片段、或 `assets/templates/page-analyzer.js` 的输出。

目标未知或可能受保护时，先运行 `python3 scripts/probe_webhome_target.py <url>`。`waf-blocked` 意味着直接 `fm.req` 抓取不可靠；仅当 App WebView 能正常加载页面时才构建扩展。App WebView 也被阻止时，要求授权 API 访问、所有者代理或用户提供的 HAR/HTML。

## 策略选择

选择适合页面的最低风险策略：

- **现有资源链接/按钮**：适配 `auto-resource-router.js`
- **需独立原生按钮不改原点击**：适配 `inject-play-buttons.js`
- **网盘链接+有效性状态**：适配 `pan-link-router.js`；调 `fm.config()` 且仅在 `driveCheck` 开启时调 `fm.pan.check()`
- **懒加载剧集解析或加密逐集媒体**：适配 `inline-episodes.js`；调 `fm.vodInline()` 前注册 `window.__fmWebHomeInlineResolver`
- **运行时才出现的媒体 URL**：分析时用 `media-sniffer.js`，之后只保留所需特定 hook/提取逻辑
- **隐藏签名/加密播放器状态/懒加载 chunk/运行时 API**：遵循 `references/js-reverse-and-waf-workflow.md`；先观察网络和脚本，再加窄 hook，最后在真实页面证据识别入口函数后才用本地 Node 复现
- **广泛手机/TV 站点增强**：从 `site-enhance-skeleton.js` 起步
- **TV 遥控支持由其他扩展共享**：把 `tv-focus-helper.js` 打包为依赖并声明 `depends`
- **弹窗/滚动锁定/广告浮层**：保守适配 `site-cleanup.js`

默认 `runAt: "document-end"`。仅早期 hook（`window.open`、`fetch`、`XMLHttpRequest`、history 路由、播放器构造函数包装）用 `document-start`，且脚本要容忍降级到 document-end。不向扩展脚本添加隐身指纹补丁、CAPTCHA 求解、Cloudflare clearance 采集或 token 破解。

## 脚本规则

写一个顶层 IIFE，所有站点特定值放 `CONFIG`。包含通用助手（除非模板已有）：
- `log()`：优先 `GM_log`，console 兜底
- `whenFm()`：等 `fmsdk` 事件
- `ready(fn)`：DOM 就绪
- `cleanText()`、URL 规范化、标题兜底、资源分类
- 防抖扫描循环：用 `MutationObserver`、`fmurlchange`、`data-fm-*` 标记避免重复注入

资源路由规则：
- **不要**拦截每个 `a[href]`；只拦截分类为资源的元素
- 保留复制按钮和正常站点导航，除非用户明确要求替换
- 资源路由用捕获阶段 click 处理器，异步操作包 `try/catch` 或 `.catch()`
- 直链媒体用 `fm.play(url, title, { headers: { Referer: ... }, credentials: "include" })`
- 网盘/磁力/ed2k/迅雷/荐片/推送链接用 `fm.pan.play({ type, url, password, title })`
- JS/API 读取用 `fm.req()`；DOM 媒体/图片 URL 用 `fm.res()`

UI 与 TV 规则：
- 仅在用户自然操作处添加注入控件：资源行、剧集区、播放器面板
- 添加异步状态：loading、empty、failure、retry 或 toast
- TV 上让可操作非链接元素可聚焦，用 `:focus` 样式，OK/Enter 映射到原生 `.click()`，文本输入用 readonly 守卫直到确认
- 焦点样式不改变布局尺寸

## 兼容规则

假设旧 Android WebView，生成 JavaScript 保持 ES2017 或以下。不要产出：

- 可选链 `?.`、空值合并 `??`、逻辑赋值、类字段、私有字段、无绑定的 `catch {}`
- 正则后行断言、命名捕获组、dotAll `s` 正则字面量
- `replaceAll`、`Promise.allSettled`、`Object.fromEntries`、`Array.flat/flatMap`、`structuredClone`、无守卫的 `AbortController`

CSS 避免脆弱现代选择器和值：
- 不用 `:is()`、`:where()`、`:has()`、`:focus-visible`
- 注入面板避免 flex `gap`（除非已有 margin 兜底）
- 为 `aspect-ratio`、`clamp()`、`inset`、`backdrop-filter`、视口单位提供兜底
- 用 `var(--fm-web-height, 100vh)` 代替裸全屏高度

## 打包

输出固定 manifest/config（除非用户只要求审查）：

```json
{
  "extensions": [
    {
      "id": "site-native-router",
      "name": "Site native router",
      "version": "1.0.0",
      "runAt": "document-end",
      "cspKeyRegex": ["^site-key$"],
      "js": ["./site.js"]
    }
  ]
}
```

`sites[].extensions` 省略 `cspKeyRegex`（除非需要额外收窄）。根级 `webHomeExtensions` 包含 `cspKeyRegex` 和 `enabled: true`（仅当扩展应默认加载时）。用含站点名的稳定 kebab-case ID。新脚本 `1.0.0` 起步，编辑时递增版本。共享助手（如 `tv-focus-helper`）时声明 `depends`。

## 输出格式

创建新扩展时提供：
1. 页面角色和 URL 模式摘要
2. 选择器表（标题、资源区、资源项、资源 URL 源、剧集选择器）
3. 策略选择及为何是最低侵入可靠选项
4. JS 逆向证据（使用时）：目标请求、发起者/脚本/函数、运行时样本、复现状态、WAF 分类
5. 完整可运行 JavaScript
6. Manifest 或 `sites[].extensions` 片段
7. 测试步骤（扩展管理器、调试工作台、console/log 标签、手机路径、TV 路径）
8. 已知风险：最可能失效的选择器/chunk/API 契约/WAF/会话假设

## 最终检查清单

- 脚本无上述语法/API/CSS 红线
- 无广泛链接拦截；无账号/cookie/隐私数据外泄
- 无 WAF/挑战绕过逻辑、隐身自动化补丁、CAPTCHA 求解、clearance-cookie 采集、逐账号 token 泄露
- `GM_getValue`/`GM_setValue`、`fm.req`、`fm.play`、`fm.pan.play`、`fm.vodInline` 调用都被 await 或 catch
- SPA 路由变化和 DOM 重渲染不重复按钮
- 空页面没有杂散面板或按钮
- Manifest 有固定 `id`、`version`、`runAt` 和精确站点 key 匹配
- 手机控件有足够触摸目标；TV 焦点和 OK 激活在 TV 支持范围内有效

---

# 第四部分：TV 遥控 + 手机触屏双端注入式适配

对**已完成、不能重写**的单文件 HTML 应用做增量适配：不改原应用源码逻辑，只在 `</head>` 前注入一段 CSS、在主脚本后注入一个独立 IIFE。输出必须是**新文件**（如 `XxxTV.html`），原文件只读。

## 0. 先摸清原应用（必做，全在只读分析）

- 找到主 IIFE 内所有关键函数：页面切换、播放页开合、操作表/弹层开合、平台菜单、源编辑器、歌词全屏、底栏收起。它们不可直接调用（闭包内），**一律通过 DOM 事件间接触发**（`.click()` 对应按钮/遮罩、`history.back()` 触发其 popstate）。
- 记录每个弹层的：开关 class 所在元素、关闭时 click 的目标判定（很多遮罩要求 `e.target===mask`）、是否 `history.pushState`（全屏歌词/播放页常见，返回必须走 `history.back()` 而不是点元素）。
- 列出 dock/tabbar 结构、播放时 mini 条结构、哪些"可点物"是无类名 inline 样式 div（操作队列行常见，选择器引擎要特判）。
- 若原文件是浏览器"另存"产物，末尾可能有上 MB 的扩展注入垃圾（chrome-extension、doubao、tailwind 等）。用构建脚本截取到**最后一个属于应用的 `</script>` + 补 `</body></html>`**，不要手工复制。

## 1. 设备识别（三级判定，写在注入 IIFE 顶部）

1. UA 正则判 TV：`android tv|googletv|web0s|tizen|bravia|vidaa|aft|smarttv|googletv`。
2. 触屏：`matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints>0`。
3. 覆盖与记忆：URL `?tv=1/0` 强制 > `localStorage` 记忆 > UA 判定；**非触屏设备首次按方向键自动进 TV 模式**；F2 手动切换并弹轻提示。
4. `<html>` 挂 class：`tv-mode`（所有 TV CSS 限定此前缀）、`touch-device`（触屏 CSS 限定此前缀）。两者可共存。

## 2. 触屏端（CSS only，不要写触屏 JS）

- 可点元素 `touch-action: manipulation; -webkit-tap-highlight-color: transparent;`。
- 按压反馈：卡片 `:active{transform:scale(.97)}`；**满宽行（歌曲/列表行）不要缩放**，用半透明底色反馈，避免横向溢出。
- 输入框 `font-size:16px+` 防 iOS 聚焦缩放。
- 小图标按钮用 `::before{content:"";position:absolute;inset:-6px/-7px}` 扩隐形命中区到约 44px，视觉尺寸不变。
- `@media(max-width:360px)` 收紧留白与卡片宽；`(pointer:coarse) and (max-height:520px)` 处理横屏矮屏播放页封面。
- 验证 `documentElement.scrollWidth <= innerWidth`（每个主要页面都查）。

## 3. TV 焦点引擎（核心，见 references/engine-patterns.md）

按以下顺序实现，每一条都对应实测踩坑：

1. **候选集合**：原生 `a/button/input/select/textarea/[role=button]` + 自定义卡片类（`.song,.album,.ch-item,.tab 变体...`）。自定义元素在 TV 模式动态加 `tabindex="-1"`。对无类名 inline 行用属性选择器（如 `#sheetBody div[style*="cursor: pointer"]`）特判纳入。
2. **可视判定**：尺寸≥3、computed `display/visibility/opacity/pointer-events`、排除 `.page:not(.on)` 内元素；**不**做视口裁剪（屏幕外但可滚动到的行仍是候选）。
3. **空间导航评分**：按 rect 中心算沿轴距离/横轴距/edge，方向半平面（容差 6px）先筛；三档兜底：
   - `best`：`edge>-4`，score = edge + cross*1.7；
   - `innerBest`：候选在当前元素**内部**（行内的"更多"小钮），edge 放宽到自身宽 0.8；
   - `relaxBest`：无直接目标时 edge 放宽到自身宽 0.55。
4. **容器焦点特例**：外层容器本身可点（如 mini 播放条点按打开播放页）、内部又有小按钮时——焦点在容器**之外**就从候选里过滤掉内部按钮，进入容器后才允许左右选内部按钮，否则内部按钮会永远"抢焦"。
5. **焦点环显式管理，不要依赖 focusin**：部分 TV WebView/自动化环境根本不派发 focus/focusin。引擎自己维护单例 ringHolder，每次移动显式 `focus()` + 挂 `.tv-focus` 类；focusin/focusout 仅作兜底。
6. **弹层分层 layer()**：编辑器遮罩 > 小弹层 > 操作表 > 菜单 > 播放页（含全屏歌词标记）> 详情页 > 当前页+顶栏+dock，每层只在自己的 roots 内找候选。
7. **焦点堆栈（关键坑）**：弹层开合必须用**分层堆栈**记录每层来源焦点；播放页内打开的音质/队列子弹层关闭时播放页仍开着，"所有遮罩都关闭才回焦"的单布尔判断会失效，子弹层关闭后焦点丢失。打开压栈、关闭逐层弹回。
8. **MutationObserver + rAF 批处理**：监听 body 的 class/childList，弹层打开自动落焦（每类有默认目标：当前选项/首个输入框/播放键）、切页自动落焦（输入框优先）、关闭走堆栈回焦；记忆每页焦点锚点。
9. **劫持原应用的自动收起行为**：如播放下滑会给 dock 加 `.collapsed` 导致方向键到不了 tabbar——单独 observer 到该 class 就立刻移除。
10. **按键映射**（capture 阶段监听）：
    - 确认：Enter / Space / keyCode 23 → `el.click()`。
    - 返回：Esc / Backspace / `"Back"` / `"XF86Back"` / Tizen 10009 / Android keyCode 4；按 layer 逐级退：全屏歌词→`history.back()`，编辑器/弹层→点遮罩或取消钮，播放页→关闭钮，非首页→首页 tab；**首页不响应返回**防误退站。
    - 文本输入态：左右/回车放行给光标、IME 和原应用（回车搜索）；**单行 input 的上下键 = blur 后以该 input 为起点恢复导航**（move 支持显式 origin，否则 blur 后 active 变 body 会被当成"回默认焦点"弹回输入框）；Esc 第一次仅 blur。
    - 进度条：左右键改 value（步长约量程 3%）并派发 input+change，不要让默认 ±1 生效。
    - 全屏歌词：上下键 `scrollBy`；进入靠元素自身 click 监听（原应用给歌词区/封面绑了 click），退出走 history。
    - 媒体键：`MediaPlayPause`(179)、`MediaTrackNext`(176)、`MediaTrackPrevious`(177) 映射到原应用按钮。
    - 空间导航特例（必要时加）：播放页控制行**上键直达进度条**，否则整幅歌词区会一直截获上键。
11. **移动后滚动**：`focus()` 用 `preventScroll:true`，再手动 `scrollIntoView({block:'nearest'})`；测试时连续移动之间必须留滚动完成时间（≥150ms），同步循环连调会读到旧几何导致跳焦误判。
12. **焦点环视觉**：3px 主题色 outline + 同色低透明 box-shadow 光晕；卡片 scale 1.07、整行 1.015，input/range/歌词不缩放；`prefers-reduced-motion` 关动画。
13. **10 英尺布局**：`@media(min-width:820px)`（1280 再放大）只在 `html.tv-mode` 下放大应用容器、卡片网格列数、播放页控件、弹层宽度。手机端视觉完全不受影响。
14. 暴露自检接口 `window.__aqDbg={layer,gather,move,focusDefault,isVisible,isTV,info}`，TV 走查时用它读候选列表与层级（注意：调试 move 与真实按键要分开验证，自动化环境批量按键后立即读状态偶发失败，拆成两个调用）。

## 4. 实施方式

- 写一次性 Python 构建脚本（UTF-8）：读原文件 → 定位基座范围剔除另存垃圾 → 在 `</style>` 后插 CSS 变量、主 `</script>` 后插 JS 变量 → 输出新文件。**所有注入内容只改构建脚本然后重跑**，不手改产物。
- 本地 `python -m http.server` 起服务实测，URL 带 `?tv=1&r=版本号` 破缓存。
- TV 全链路走查清单：首页卡片/频道 → tabbar → 搜索（输入、上下离开、回车）→ 结果行与行内"更多"操作表 → 播放 → mini 条 → 播放页（播放键/进度条/音质弹层/队列弹层/切源弹层/歌词全屏）→ 设置页（音质按钮、源编辑器）→ 平台菜单；每一级都验证进入落焦、方向移动、Esc 逐级回焦；再验媒体键与 F2。
- **新增元素走查**（官方更新后）：沉浸详情页（榜单卡/歌单卡进入 → 焦点落歌曲行 → 点歌顶开播放页 → 返回键逐级退出：弹层→播放页→详情页→页面）；「当前播放」按钮（仅 TV 模式可见 → 点击进播放页 → 无播放时置灰 → 播放页打开时高亮）；切源弹层（方向键进入 → 切源选项聚焦 → 返回键关闭弹层不关播放页）。
- 手机走查：无横向滚动、命中区 inset 生效、:active 反馈、横屏播放页；触屏模式下不得出现任何 TV 焦点环；**仅 TV 显示的元素（如「当前播放」按钮）在手机模式必须 `display:none` 不可见，底部标签栏与官方 UI 完全一致**。
- 控制台只允许存在原应用自身的外部资源网络错误；注入引擎必须零报错。

## 5. 交付

- 告知新文件路径与开关方式（`?tv=1` 强制 TV、F2 切换、非触屏方向键自动进入）。
- 构建脚本保留在项目根目录（如 `_build_tv_adapt.py`）便于再生成；不要提交原文件改动。

---

# 第五部分：官方更新同步（重建法）

当原应用发布大版本更新（核心 JS 行数翻倍、DOM 结构变化）时，逐行 patch 旧 TV 版不现实，采用**重建法**：

1. **备份旧 TV 版**（`.bak-日期`，永不删除——曾多次需要回查旧适配代码）。
2. **取官方新文件为基底**。官方源码有两种分发形态，分别处理：
   - **形态 A：浏览器"另存"的单文件** → 剔除扩展注入垃圾：head 区垃圾 `<style>` 块（chrome-extension / web-clipper / index_crossLine 等）、文末垃圾 DOM（doubao-ai / tailwindcss / itab / WXT shadow root 等）；有效边界：从 `<!DOCTYPE>` 到最后一个属于应用的 `</style>`；从 `<body>` 到最后一个属于应用的 `</script>`。
   - **形态 B：线上多文件部署**（Cloudflare Pages / Vercel 等，主页仅外链 `style.css`、`app.js`）→ 先抓取并内联合并成干净单文件，流程见下节「线上多文件部署 → 单文件基底」。
3. **注入 TV CSS 适配块**（从旧 TV 版提取 + 按新版变化补充）。
4. **注入 TV 适配引擎**（从旧 TV 版提取 + 按新版 DOM 契约变化逐一 patch）。
5. **补 `</body></html>` 收尾**（官方另存产物常缺失；多文件部署合并产物通常完整）。

## 线上多文件部署 → 单文件基底（抓取内联法）

实测案例：`https://am-4u2.pages.dev/`（主页 37KB + style.css 131KB + app.js 558KB → 单文件 727KB，2026-10）。

1. **抓主页**：`curl.exe -sL <url> -o index.html -w "HTTP:%{http_code} SIZE:%{size_download}"`。Windows PowerShell 下必须用 `curl.exe`（裸 `curl` 是 `Invoke-WebRequest` 的别名，参数不兼容），`-L` 跟随跳转。
2. **读主页定位外链**：典型只有一个 `<link rel="stylesheet" href="style.css">` 和一个 `<script src="app.js" defer></script>`；相对路径按主页 URL 目录解析后逐个下载。
3. **合并前静态检查**（在下载到的 JS/CSS 上搜索）：
   - JS 中字面量 `</script>`、CSS 中字面量 `</style>`：命中则内联前转义为 `<\/script>` / `<\/style>`（本案例 0 命中，仍保留兜底替换）。
   - 动态 `import()`：有则需递归下载对应 chunk 再内联（本案例 0 个）。
   - JS 中形如 `'xxx.json'` 的引用（如 `yqq.json`）是**运行时 fetch 的数据**，不是源码，**不内联**；本地打开时该相对请求会失败，仅影响线上数据加载，界面与代码完整性不受影响，交付时向用户说明。
4. **Python 一次性合并**（PowerShell 不支持 bash heredoc `<<'PY'`，把脚本写成 `.py` 文件再 `python xxx.py` 执行）：
   - 以 UTF-8 读入三个文件；断言两个外链标签在主页中均 `count == 1`，不唯一则中止人工核对。
   - `<link ...>` 整体替换为 `<style>\n{css}\n</style>`；`<script src=... defer></script>` 整体替换为 `<script>\n{js}\n</script>`（内联且位于 body 末尾，执行时机与 `defer` 等同，不要保留 src）。
   - `io.open(out, "w", encoding="utf-8", newline="")` 写出，保留原换行；Windows 产物须为 UTF-8 **无 BOM**。
5. **产物校验**（全部通过才算完成）：
   - 首三字节为 `3C 21 44`（`<!D`），确认无 BOM。
   - 外链引用残留为 0：`href="style.css"`、`src="app.js"` 计数均为 0。
   - `<style>`/`</style>`、`<script>`/`</script>` 开闭标签计数配对。
   - 正则 `(?s)<script>(.*?)</script>` 提取每段内联 JS（含头部引导脚本），逐块 `node --check` 通过。

## DOM 契约变化核对清单

逐项核对旧版引擎依赖的 id/class 是否仍存在于新版，分类处理：

| 变化类型 | 处理方式 |
|---|---|
| **元素删除**（如 `#npClose` 被移除） | 引擎中所有引用必须改：`click($("npClose"))` → `history.back()` 走官方 popstate 链路 |
| **新增弹层**（如 `#npMorePop` 切源弹层，与音质弹层共用 `#qPopMask`） | `layer()` 需识别新弹层为独立 kind（或并入同类）；`closeTopOverlay()` / `sig()` / 焦点堆栈同步加 |
| **新增全屏沉浸详情页**（如 `#detailPage`，z-index 56，低于播放页 80） | 新增 detail 层：`layer()` 加判定、`pickDefault()` 加默认焦点、`doBack()` 加返回分支、`closeTopOverlay()` 加层级最低处理、`KINDS`/`OPEN_DELAY` 加入 |
| **元素行为变化**（如 `.pl-card` 从直接播放变为进详情页） | playable 列表移除该类，避免点击时误触发 `ensureNowPlaying` |
| **新增可聚焦元素**（如 `.rank-card`、`.detail-song-row`） | CUSTOM 列表新增；OK 键 closest 列表同步新增 |
| **新增控件**（如播放页新增播放模式/定时/切源按钮） | `move()` 控制行 id 数组同步新增 |

## ensureNowPlaying 守卫模式（详情页与播放页互不误开）

原应用详情页点歌只调 `play()` 不开播放页，TV 引擎需要兜底打开，但必须区分触发来源：

```js
function ensureNowPlaying(trigger) {
  if (np.classList.contains("open")) return;
  // 点击/确认触发时，若详情页已开则不误开播放页
  if (trigger !== "audio-play" && trigger !== "detail-row") {
    if (detailPage.classList.contains("open")) return;
  }
  // setTimeout 回调内同样守卫
}
```

- `audio-play`：音频实际开始播放（详情页内点歌后也会走到此路径）→ **放行**
- `detail-row`：点击/确认详情页歌曲行 → **放行**（官方行 click 只 play 不打开播放页，引擎需兜底）
- `click` / `keydown-OK`：普通卡片点击 → 详情页开时 **拦截**

## 构建脚本补丁模式

用 Python 脚本做 old→new 精确字符串替换，每处 `assert count==1`，**一次性报告所有未命中**（避免逐次失败浪费轮次）：

```python
PATCHES = []
def P(old, new): PATCHES.append((old, new))
# ... 逐条定义 ...
fail = 0
for i, (old, new) in enumerate(PATCHES, 1):
    cnt = engine.count(old)
    if cnt != 1:
        print(f'PATCH {i} FAILED: count={cnt}')
        fail += 1; continue
    engine = engine.replace(old, new)
if fail: sys.exit(1)
```

- 补丁的 old 侧必须从旧备份文件**精确提取**（包括缩进、标点），不能手写近似。
- 语法校验：提取所有 `<script>` 块用 `node --check` 逐块检查。
- 大文件避免整文件 Read，用 Grep 定点读取。

## 分层返回验证

新版多层级（弹层→播放页→详情页→页面）返回键必须逐级退出：
- 每按一次 Backspace 只关一层
- 关闭顺序：子弹层（切源/音质）→ 播放页 → 详情页 → 页面
- `doBack()` 按 `layer().kind` 分派，每层独立处理

---

# 第六部分：真实 TV 老内核兼容（实测 TCL Android 9 / Chromium ~84-87）

桌面 Chrome 和模拟器测通 ≠ 真实 TV 能用。老 WebView 踩坑清单，按发生概率排序。

## CSS 特性兜底（必须在注入 CSS 里写死）

| 特性 | 老内核支持 | 兜底写法 |
|---|---|---|
| `inset: 0` | Chromium 87+ | 补 `top:0;right:0;bottom:0;left:0`。**播放页/弹层全靠 `inset:0` 撑满全屏，不补则元素尺寸为 0，加了 `open` 类也看不见**。 |
| CSS `min()`/`max()` | Chromium 79+ | 先写固定值再写函数：`width:320px; width:min(72vw,320px)`，老内核丢弃后者保留前者。 |
| `aspect-ratio` | Chromium 88+ | 方形卡片靠图片自然比例撑高，不依赖 `aspect-ratio`；显式设 `img{width:100%;height:auto}`。 |
| `backdrop-filter` | 部分内核不支持 | 毛玻璃按钮改成实色背景 + 边框 + 阴影，否则按钮在白底上几乎透明看不见。 |
| `place-items: center`（grid） | 老内核渲染异常 | 控制按钮/图标居中改用 `display:flex;align-items:center;justify-content:center`。 |
| `transform: scale()` 焦点环 | 圆形按钮/含 SVG 的按钮会变形 | 控制按钮焦点高亮改用 `border-color` + `box-shadow` 光晕，**禁用 scale**。 |

## SVG 图标歪斜

老 Chromium 渲染 SVG 可能出现几何偏移。三件套：
1. CSS `shape-rendering: geometricPrecision !important; display:block;`
2. JS 给 SVG 补属性：`setAttribute('preserveAspectRatio','xMidYMid meet')`、`width`、`height`
3. 播放/暂停图标切换用 `innerHTML` 替换 path，MutationObserver 监听 `#np` class 变化时重新补属性（因为 path 重建会丢属性）。

## 遥控器按键事件的"非标准"行为

**OK/确认键**：部分 TV（TCL）发的是**鼠标 `click` 事件**，不是 `keydown Enter`。
- 必须同时监听 `keydown` 的 Enter/Space/23 **和** `document` 的 `click`（capture 阶段）。
- click 里判断 `e.target.closest('.album,.song,...')` 命中可播卡片则触发后续逻辑。

**返回键**：部分 TV **只触发 `popstate`，不触发 `keydown`**。
- 不能只在 `keydown` 里写返回逻辑。
- 必须在 `window` 的 `popstate` 捕获阶段处理：若有弹层打开，直接关弹层 + `history.pushState` 恢复历史，**不要让原应用的 `popstate` 处理器关播放页**。
- 配合 MutationObserver 兜底：监听 `#np` 的 class，弹层开着时若 `open` 被移除立即加回（防止 flicker）。

## history.pushState 与播放页生命周期

原应用打开播放页时 `history.pushState('#player')`，并在 `popstate` 里关播放页。遥控器返回键触发 `history.back()` → `popstate`，播放页被关。
- 方案：`popstate` 捕获阶段 `stopImmediatePropagation()` + 重新 `pushState('#player')`。
- 若拦截失效（注册顺序问题），用 MutationObserver 直接把 `#np.open` 加回来。

## 空间导航评分的老内核无关坑（但 TV 布局放大后才暴露）

1. **半平面容差必须严格（2px，不是 6px）**：横向用 `cx > ax+2`/`cx < ax-2`，纵向用 `cy > ay+2`/`cy < ay-2`。否则同列/同行元素会参与横向/纵向评分，导致 dock 左右键上下跳、grid 内上键在同行卡间来回跳。
2. **垂直方向 cross 容差用 `max(width)`，不是 `min(width)`**：上方大卡片（600px）和下方专辑卡（160px）跨导航时，`min` 算出的容差太小够不到。横向仍用 `min(height)` 防跨行抢焦。
3. **换行逻辑只对 grid / flex-row 生效，flex-column（dock tabbar）不换行**。找不到 grid/flex-row 容器时**边界停住**，不要回退到 `.page`（会误跳到 header 按钮）。
4. **dock ↔ 页面横向跨越单独处理**：dock 右键取页面内垂直最近元素；页面左键取 dock 内垂直最近 tab。普通评分因 cross 容差够不到。
5. **找不到目标时焦点不动**，不要跳到 `pickDefault`（否则 dock 左键会误跳到平台按钮）。

## 调试手段（TV 无 DevTools）

- 启动时 `console.info` 输出浏览器能力对象（`CSS.supports` 测各特性），挂 `window.__aqDiag`。
- 需要时可临时加右上角绿色浮层显示 `UA/视口/特性支持/按键 keyCode`，问题定位后**必须移除**。
- 真实 TV 测试时务必带缓存参数 `?v=N` 或强刷，GitHub Pages 有 CDN 缓存。

---

# JS 逆向与 WAF 工作流

当首页数据或扩展依赖隐藏 API、请求签名、播放器/资源发现、加密 URL、防盗链头、运行时媒体请求或 Cloudflare/WAF 可行性时，遵循 `references/js-reverse-and-waf-workflow.md`。

核心要点：
- **边界**：只处理用户拥有、授权分析或可正常访问的目标。不构建 Cloudflare/CAPTCHA/Turnstile/限流/指纹/登录绕过流程。不用隐身插件、CAPTCHA 求解器、窃取 cookie 或 token 破解。
- **可行性探针**：对未知站点先运行 `python3 scripts/probe_webhome_target.py <url>`。`waf-blocked` 意味着直接 `fm.req` 抓取不可靠。
- **先观察后编码**：收集 URL/页面角色、目标请求、脚本证据、运行时源、会话假设。工具顺序：浏览器/CDP/Playwright 网络列表 → 请求发起者和调用栈 → 脚本列表和源搜索 → 窄运行时 hook → 断点（仅在 hook 不足时）→ 本地 Node 复现（仅在页面证据识别真实入口后）。
- **扩展运行时 hook**：`document-start` 仅用于值在 `document-end` 前出现的情况（播放器构造函数、`fetch`、`XMLHttpRequest`、WebSocket、`window.open`、history 路由）。hook 要窄且可逆。
- **首页数据策略**：仅在请求契约稳定时用直接首页数据抓取（`fm.req()` 可复现 API、头是普通的且允许发送、不嵌入 cookie/逐账号 token、需要头的图片/媒体走 `fm.res()`）。API 依赖运行时 JS 签名、源站有 WAF、数据来自播放器构造函数/懒加载 chunk/WebSocket/复制分享处理器时，优先扩展或授权后端。
- **WAF 决策规则**：直接 HTTP 返回 403/429/503、`cf-ray`、挑战页、Turnstile/CAPTCHA 或 `/cdn-cgi/challenge-platform` 时，标记直接首页数据抓取为阻断或高风险。App WebView 能正常打开页面时优先扩展。App WebView 也打不开时，首页和扩展都不可靠，要求授权 API/所有者代理/公共源/授权会话 HAR/HTML。
- **交付契约**：目标请求表、证据表、复现状态、WebHome 策略（首页/扩展/混合/授权后端）、兼容性结果、风险。

---

# 验证与交付

## 首页验证

运行：
```bash
python3 scripts/check_webhome_compat.py path/to/home.html
```

同时验证：
- 无 `?.`、`??`、逻辑赋值、`catch {}`、正则后行断言/命名捕获、`<script type="module">`
- 无无守卫的 `replaceAll`、`Promise.allSettled`、`Object.fromEntries`、`structuredClone`、`AbortController`、`globalThis`
- 无 `:is()`、`:where()`、`:has()`、`:focus-visible`
- `flex gap`、`aspect-ratio`、`clamp/min/max`、`inset`、`backdrop-filter`、`100dvh`、`env()` 有兜底或特性检测
- App 请求用 `fm.req`/`fm.res`；SDK Promise catch 失败
- 无 WAF/挑战绕过逻辑、隐身自动化补丁、CAPTCHA 求解、clearance-cookie 采集、账号 cookie 嵌入、逐账号 token 泄露
- TV 能移动焦点、激活控件、有意编辑文本、从每个局部面板返回
- 调试日志无 `SyntaxError`、WebView 渲染崩溃或 SDK 调用失败

## 扩展验证

- 脚本无语法/API/CSS 红线
- 无广泛链接拦截；无账号/cookie/隐私数据外泄
- `fm.req`/`fm.play`/`fm.pan.play`/`fm.vodInline` 调用都被 await 或 catch
- SPA 路由变化和 DOM 重渲染不重复按钮
- Manifest 有固定 `id`、`version`、`runAt` 和精确站点 key 匹配
- 手机控件有足够触摸目标；TV 焦点和 OK 激活有效

## TV 适配验证

- TV 全链路走查（首页 → tabbar → 搜索 → 播放 → 播放页各弹层 → 设置 → 平台菜单）
- 每级验证进入落焦、方向移动、Esc 逐级回焦、媒体键、F2
- 手机走查：无横向滚动、命中区、:active 反馈、横屏；触屏模式无 TV 焦点环；仅 TV 元素手机模式 `display:none`
- 注入引擎零报错

## 交付物

- 首页：页面架构摘要+数据源、兼容计划、JS 逆向/WAF 证据（使用时）、完整单文件 HTML、`sites[]` 配置片段、测试步骤、已知风险
- 扩展：页面角色+URL 模式摘要、选择器表、策略选择、JS 逆向证据（使用时）、完整 JS、Manifest/配置片段、测试步骤、已知风险
- TV 适配：新文件路径+开关方式（`?tv=1` 强制 TV、F2 切换、非触屏方向键自动进入）、构建脚本保留在项目根目录便于再生成

## 常见问题速查

| 问题 | 解决 |
|------|------|
| 电脑正常 App 不正常 | 监听 `fmsdk` 事件 |
| fetch 跨域失败 | 用 `fm.req` 替代 |
| 网盘检测不执行 | 先读 `fm.config()` 的 `driveCheck` |
| 透明背景无效 | 用 `.fm-native` 检测 |
| 遥控器无法操作 | 加 `tabindex=0` |
| 返回键异常 | 用 History API |
| 端口不是 9978 | 从 `fm.device()` 读取 |
| 网盘检测大批量 | 每批 ≤10 条 |
| 安全区重复计算 | 用 `max()` 不用 `+` |
| TV 弹层关闭后焦点丢失 | 用分层堆栈不用单布尔 |
| TV 焦点不派发 focusin | 显式管理 ringHolder |
| TV 返回键只触发 popstate | popstate 捕获阶段处理 |
| `inset:0` 播放页看不见 | 补 `top/right/bottom/left` |
