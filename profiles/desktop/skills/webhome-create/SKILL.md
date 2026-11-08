---
name: webhome-create
description: FongMi TV WebHome 自定义首页开发 Skill。覆盖需求分析→数据源对接→UI设计→代码生成→配置集成全流程。
---

# WebHome 自定义首页开发指南 v1.0

## 什么是 WebHome

WebHome 是 FongMi TV (com.fongmi.android.tv) 的 CSP 自定义网页首页能力。站点配置 `homePage` 后，切换到该站点时加载 HTML 页面代替原生推荐页。页面运行在 App WebView 中，可调用 `window.fm` SDK 访问 App 全部能力。

**本质：单文件 HTML，不需要打包，改了刷新即生效。**

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
  "homePage": "./my_home.html"
}
```

- `type: 3` 是 Spider 类型，WebHome 站点必填
- `api: "csp_Builtin"` 使用内置 Spider，WebHome 站点必填
- `homePage` 支持 `./relative.html`（相对配置URL）或完整URL
- 别名：`home_page`、`webHome`、`web_home` 均可

---

# SDK 完整参考

## SDK 注入与就绪

```js
window.fongmi  // 完整命名空间
window.fm      // 短别名

window.addEventListener("fmsdk", () => {
  // fm 已就绪
});

window.addEventListener("fmresume", (e) => {
  // e.detail.time, e.detail.pausedMs
});

if (window.fongmiBridge || window.fm || window.fongmi) {
  document.documentElement.classList.add("fm-native");
}
```

## SDK 接口速查表

| 接口 | 签名 | 返回 | 说明 |
|------|------|------|------|
| `fm.req` | `fm.req(url, options)` | Promise | Native OkHttp 请求，绕 CORS |
| `fm.res` | `fm.res(url, options)` | string | 资源网关 URL，给 DOM src 用 |
| `fm.play` | `fm.play(url, title, options)` | Promise | 播放直链 |
| `fm.vod` | `fm.vod(siteKey, vodId, title, pic)` | Promise | 播放 CSP 影片详情 |
| `fm.ctrl` | `fm.ctrl(action)` | Promise | 播放控制 |
| `fm.stat` | `fm.stat()` | Promise | 播放状态 |
| `fm.search` | `fm.search(keyword, options)` | Promise | 触发 App 搜索 |
| `fm.openKeep` | `fm.openKeep()` | Promise | 打开收藏页 |
| `fm.openLive` | `fm.openLive()` | Promise | 打开直播页 |
| `fm.history` | `fm.history()` | Promise | 最近观看列表 |
| `fm.pan.check` | `fm.pan.check(items)` | Promise | 网盘有效性检测 |
| `fm.pan.play` | `fm.pan.play(payload)` | Promise | 网盘/磁力播放 |
| `fm.check` | `fm.check(items)` | Promise | fm.pan.check 短别名 |
| `fm.cache` | `fm.cache.get/set/del` | Promise | 跨重启持久化存储 |
| `fm.device` | `fm.device()` | Promise | 设备信息 |
| `fm.site` | `fm.site()` | Promise | 当前站点信息 |
| `fm.config` | `fm.config()` | Promise | 当前配置信息 |
| `fm.back` | `fm.back()` | Promise | 返回/GoBack |
| `fm.reload` | `fm.reload()` | Promise | 清缓存重新加载 |

---

# 网络请求

## fm.req(url, options)

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

返回：ok/status/url/headers/cookies/body/error

## fm.res(url, options)

生成本地 /webResource 地址，适合 img.src、video.src、CSS 背景图等 DOM 资源。返回字符串（不是 Promise）。

```js
img.src = fm.res("https://image.tmdb.org/t/p/w500/xxx.jpg");
video.src = fm.res(videoUrl, {
  headers: { Referer: "https://example.com/" },
  credentials: "include"
});
```

**fm.req vs fm.res 选择：** API数据用fm.req，DOM资源用fm.res

---

# 播放能力

## fm.play(url, title, options)

```js
await fm.play("https://example.com/video.m3u8", "标题", {
  headers: { Referer: "https://example.com/" },
  credentials: "include"
});
```

## fm.vod(siteKey, vodId, title, pic)

```js
await fm.vod("site_key", "vod_id", "影片名", "https://example.com/poster.jpg");
```

## fm.ctrl(action)

play/pause/stop/prev/next/loop/replay

## fm.stat()

返回：state(1其它/2ready/3playing/6buffering), speed, duration, position, url, title, artist, artwork

---

# App 能力

## fm.search(keyword, options)

```js
await fm.search("仙逆", { direct: true });
```

direct: true 直接进入搜索结果列表

## fm.openKeep() / fm.openLive()

打开收藏页 / 打开直播页

## fm.history()

返回60天内最近观看列表：key/vodPic/vodName/vodFlag/vodRemarks/episodeUrl/createTime/opening/ending/position/duration/speed/cid

## fm.back() / fm.reload()

WebView goBack / 清缓存重新加载

---

# 信息和缓存

## fm.device()

返回：uuid/name/ip/type(0电视/1手机/2DLNA)/serial/eth/wlan/time

## fm.site()

返回：key/name/homePage/type/header

## fm.config()

返回：id/url/desc/driveCheck

driveCheck：网盘检测开关，做网盘检测前必须先读取

## fm.cache

```js
await fm.cache.set("key", "value", "rule");
const val = await fm.cache.get("key", "rule");
await fm.cache.del("key", "rule");
```

只存字符串，走Native Prefers，跨App重启保留

---

# 网盘能力

## fm.pan.check(items)

```js
const config = await fm.config();
if (config.driveCheck) {
  const result = await fm.pan.check([
    { type: "quark", url: "https://pan.quark.cn/s/xxxx", password: "" }
  ]);
}
```

支持：aliyun/quark/uc/baidu/tianyi/123/xunlei/115/mobile

别名：ali→aliyun, alipan→aliyun, 123pan→123, 139/caiyun→mobile

state：ok(绿)/bad(红)/locked(黄)/unsupported(灰)/uncertain(灰)

缓存：ok 1h, bad 6h, locked 12h, unsupported 24h, uncertain 30m

## fm.pan.play(payload)

```js
await fm.pan.play({
  type: "quark",
  url: "https://pan.quark.cn/s/xxxx",
  password: "",
  title: "影片名"
});
```

支持：aliyun/quark/uc/baidu/tianyi/123/xunlei/115/mobile/magnet/ed2k/thunder/jianpian/http

---

# 透明背景

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
.card-body, .panel { background: var(--panel); border: 1px solid var(--line); }
```

浮层打开时隐藏底层：

```css
body.detail-active .app { visibility: hidden; pointer-events: none; }
```

---

# 电视端遥控器UX

- 默认焦点不要放在搜索框
- 所有可操作元素加 tabindex=0
- 浮层打开后方向键限制在当前焦点域
- 返回键先执行局部返回
- 文本输入框默认 readonly，OK键时才编辑
- 动态列表刷新保存焦点key和滚动位置
- 焦点样式用轻微背景提亮，不要粗白描边

---

# 路由和返回

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

---

# PanSou 网盘搜索集成

```js
const PAN_API = "https://so.252035.xyz";

// 搜索
const res = await fm.req(`${PAN_API}/api/search`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ kw: "片名", res: "merge", src: "all", cloud_types: ["quark","aliyun"] }),
  responseType: "json"
});

// 认证
const auth = await fm.req(`${PAN_API}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username, password }),
  responseType: "json"
});
```

---

# 本地HTTP API

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

---

# 最佳实践

1. 单文件HTML，不引入构建流程
2. API请求用fm.req，避免CORS
3. DOM资源用fm.res
4. 搜索用fm.search(keyword, { direct: true })
5. 多层页面用History API
6. 透明背景不给html/body写死纯色
7. 浮层打开时隐藏底层页面
8. 文字区域用半透明面板
9. 网盘检测先读fm.config().driveCheck
10. 所有Promise都catch
11. 不依赖固定端口

## 常见问题

| 问题 | 解决 |
|------|------|
| 电脑正常App不正常 | 监听fmsdk事件 |
| fetch跨域失败 | 用fm.req替代 |
| 网盘检测不执行 | 先读fm.config() |
| 透明背景无效 | 用.fm-native检测 |
| 遥控器无法操作 | 加tabindex=0 |
| 返回键异常 | 用History API |
| 端口不是9978 | 从fm.device()读取 |
| 网盘检测大批量 | 每批≤10条 |
