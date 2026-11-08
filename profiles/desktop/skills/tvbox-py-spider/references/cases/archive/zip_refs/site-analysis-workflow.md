# XBPQ 站点分析工作流（分步探测）

写新站规则前的系统性探测流程。每步都用 Python requests + 桌面 UA，保存 HTML 到文件便于反复正则分析。

## 1. 首页探测

```python
r = requests.get(url, headers=UA, timeout=15, verify=False)
r.encoding = r.apparent_encoding
# 保存后看长度和结构
```

**判定：**
- HTML < 5KB → **落地页壳**（防爬/广告跳转页）。特征：`立即进入`按钮、`window.line_1` 配置、`config.js`。真实内容在 JS 跳转后或 `/index.php` 等路径
- 分类链接常见格式：`/category/xxx/`（WordPress/Typecho）、`/list/{id}`、`/vodtype/`、`/vod/show/.../id/{cateId}/`（苹果CMS）

**落地页破解套路：**
1. 直接看 HTML 里所有 `<a href>` 全量输出（分类可能藏在导航）
2. 抓 `config.js` / `index.js` 看 `window.line_1` 等跳转目标
3. 试探 `/index.php`、`/?s=/`、`/list/19` 等常见真实入口
4. **cookie 反爬**：落地页会种 cookie（如 `ff_entry`），用 `requests.Session()` 先 GET 首页再访问列表页——JISE 案例：无 cookie 访问 `/list/19` 时有时返回 32KB 真实内容、有时返回 2.4KB 落地页，带 session cookie 后稳定 32KB

## 2. 列表页结构分析

- 找列表项边界：`<li ...class="...vod">`、`<article>`、`<div class="...box">`
- 图片：`data-original="..."`（懒加载）、`loadBannerDirect('...')`、`<img src>`
- 标题：`title="..."` 属性、`<h2 class="post-card-title">`、`alt="..."`
- 副标题（时长/清晰度）：`<span class="pic-text text-right">00:33:50</span>` 之类
- 链接：`href="/video/{id}"` → 详情页
- 用正则模拟 XBPQ 截取验证：`re.findall(r'<li(.*?)</li>', html, re.S)` 后逐项提取字段

## 3. 分页格式

- 第一页可能与后续页 URL 不同（如第一页 `/list/19` 无页码，第二页 `/list-read-id-19-p-2`）
- XBPQ 用中括号：`"分类url": "后续页模板[第一页url]"`
- 例：`"/list-read-id-{cateId}-p-{catePg}[/list/{cateId}]"`

## 4. 详情页播放提取

搜索关键词：`m3u8`、`.mp4`、`iframe`、`player`、`var xxx_player`、`data-config`

常见结构：
- 内联 JS 变量：`var cms_player={"id":"650773","url":"https:\/\/cdn...\/index.m3u8",...}` → 截取 `"url":"&&"` + `[工具:替换:\\\\/>>/]` 还原 `\/`
- DPlayer：`<div class="dplayer" data-config='{"video":{"url":"..."}}'>` → `"video":{"url":"&&"`
- 免嗅默认开，m3u8 在页面就直接嗅探，不要硬写播放数组

## 5. 搜索验证（多格式试全）

- 苹果CMS：`/vodsearch/.../wd/{wd}/`
- WordPress/Typecho：`/search/{wd}/`、`/?s={wd}`
- 自定义：`/vod-so-wd-{wd}`（JISE 格式）
- **注意**：GET 可能只返回「热门搜索」标签而非结果；真实搜索常是 POST 表单（页面里 `<form method="post" action="/index.php?s=vod-so">`）→ XBPQ 写 `;post;wd={wd}` 或直接留空
- 用列表页真实标题词测试（别用任意词，可能真的没结果）
- 测不通就搜索留空：很多源搜索被限流/需登录，分类浏览是主体

## 案例：JISE（jise7.com）

- **反爬**：落地页种 `ff_entry` cookie，Session 先 GET 首页解决
- **分类**：`/list/19`（国产精品）等 10 个分类，`/list-read-id-{id}-p-{pg}` 分页
- **列表**：`<li>` 卡片，`data-original` 懒加载图，`title` 标题，`pic-text text-right` 时长
- **播放**：详情页 `var cms_player={"url":"https:\/\/t33.cdn2020.com\/...\/index.m3u8"}` → `"url":"&&"[工具:替换:\\\\/>>/]`
- **搜索**：`/vod-so-wd-{wd}` GET 和 POST 都返回空列表（可能被限制）→ 搜索留空
