# 短剧站 API 源（第二站）：西瓜短剧 xiguaduanju.com

> 2026-08-24 实战。与绮梦短剧（shorttv.online，见 `短剧站API-绮梦短剧.md`）**同一 SaaS 架构**，但 API 基址/header/播放接口不同。成品 `templates/shorttv.py` 同目录交付过，本笔记记 API 差异 + 解锁链路。

## API 概况

- **基址**：`https://api.djjz.xss16.com/api/v3`（Vite SPA 的 `config.js` 里 `window.__ENV__.VITE_API_BASE`）
- **⚠️ 必带 `X-Zone: XIGUADUANJU` header**（不是 `Zone`/`X-Zone` 大小写变体，就是 `X-Zone`；缺失报 `missing zone header`，加了但无 token 报 401）。ZONE 值也在 config.js（`VITE_DEFAULT_ZONE`）
- Referer: `https://xiguaduanju.com/`，UA 用手机安卓
- SPA 探测法：首页 HTML 几百字节 + `<script src="/assets/index-*.js">` + `/config.js` → API 端点全在 config.js，接口路径在 index.js 里搜 `P(\`/...\`)` 模式（P 是 fetch 封装）

## 核心接口（与绮梦的对应关系）

| 功能 | 西瓜 | 绮梦 |
|------|------|------|
| 首页 | `GET /feed` → `{items:[{drama:{...}}], nextCursor}` | `GET /webpc/home` |
| 列表/分类 | `GET /dramas?sort=weight\|new\|hot\|rating&contentKind=SHORT_DRAMA\|SERIES\|MOVIE\|ANIME&categorySlug={slug}&region=&year=&limit=24&cursor=` | `GET /feed/items?genre={slug}&sort_by=` |
| 搜索 | `GET /search?q={kw}&limit=` → `data` 是 **list**（非 items） | `GET /search?q=` |
| 详情 | `GET /dramas/{id}` → episodes[]（index/isFree/locked） | `GET /public/dramas/{id}` |
| 播放 | `GET /dramas/{id}/watch?index={n}&adultConfirmed=1` → `episode.hlsUrl` | `GET /me/dramas/{id}/episodes/{n}/playback` → `episode.playback_url` |
| 游客 | `POST /auth/guest` `{device_id}` | `POST /api/v3/auth/guest` `{device_id}` |
| 成人确认 | `POST /secret/confirmAge` + `POST /secret/confirmAdultOnly`（+ 播放时 `adultConfirmed=1`） | `POST /me/adult-confirmations` |

## ⚠️ 播放参数名坑

- `?episode=3` **被忽略**（永远返回第 1 集）；`?index=3` 才生效
- **敏感剧（SENSITIVE）解锁三件套**：①游客注册拿 Bearer token ②`/secret/confirmAge` ③**watch 请求必须带 `adultConfirmed=1`**（query 参数，来自 JS `Qu()` 函数 `{index, surface, adultConfirmed: i?'1':void 0}`）——三个缺一不可，否则敏感剧 hlsUrl 永远 None
- 锁定集（index > freeEpisodes）：`locked=True`、hlsUrl 无、`unlockPriceCoins=80`（coins 充值付费墙，游客 0 币，**无解，别浪费时间**）
- 敏感剧搜不到/详情 404 是站点过滤，正常现象

## 免费额度（用户选它的原因）

- 热剧免费 3~6 集（freeEpisodes 字段），feed 推荐里大量 **freeEpisodes=9999（全免费）**
- 比绮梦（仅 1 集免费）多得多 → 用户原话"西瓜短剧是收费的还是免费的？如果是免费的，你直接写西瓜短剧吧"——**用户偏好免费集多的源**

## 列表/详情结构

- 列表项（/dramas、/feed 的 drama 字段）：`id/title/cover/poster/freeEpisodes/totalEpisodes/contentKind/categories[]/tags[]`
- 详情 episodes：`{id, index, title, isFree, locked}`
- 播放 URL：`cdn.shorttv.online/lsj/hls/.../master.m3u8` 或 `uploads/direct/.../video.mp4`（mp4 直链 31MB 实测 200 可播）

## ⚠️ 选集慢 = 串行请求播放地址 → 必须并发

用户反馈"剧集开始播放的特别慢，要加载十几秒钟才出来选集"——detailContent 对每集串行调 watch 接口（1集1s，9集9s+）。**修复：`concurrent.futures.ThreadPoolExecutor(max_workers=10)` 并发请求所有免费集**，结果按 index 排序（`futs = {ex.submit(fn, ep): ep}` 保留映射）。实测 9 集 **10.7s → 2.0s**。

## 探测路径速记（下次同架构站直接复用）

1. 首页 HTML 小 + config.js 有 `VITE_API_BASE`/`VITE_DEFAULT_ZONE` → 同 SaaS
2. index.js 搜 `P(\`/...\`)` 拿全部接口路径；`client-*.js` 里看 header 注入（`X-Zone`）
3. 播放函数定义在 index.js（如 `Qu = P(\`/dramas/${id}/watch\`, {query:{index, surface, adultConfirmed}})`）——**参数名从 JS 函数签名抄，不要猜**
4. guest 注册 → confirm → 带参请求，三步验证敏感剧
