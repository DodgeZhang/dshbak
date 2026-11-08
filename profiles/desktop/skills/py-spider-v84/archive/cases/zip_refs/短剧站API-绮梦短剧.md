# 绮梦短剧 shorttv.online py 源（2026-08-24 新写）——Next.js SPA + JSON API + 付费墙 范本

站点：https://shorttv.online/（绮梦短剧，成人短剧站，Next.js SPA）。成品 `templates/shorttv.py`。
**这类站（Next.js/React SPA，页面内容全靠 fetch JSON）不要解析 HTML，直接挖 API**——本文件是完整挖 API 流程。

## 0. SPA 站点 API 发现流程（通用）

1. `curl 首页` → 页面 HTML 只有导航壳 + `正在加载…`，内容全靠 JS → **不是解析 HTML 的路子**
2. 抓首页所有 `<script src="/_next/static/chunks/*.js">`（Next.js 特征）→ 逐个 GET，正则 `api/v3/public/[a-z0-9/_{}$.-]+` 收集全部 API 路径（本站在 30 个 chunk 里挖出 30+ 端点）
3. **API base 域名 ≠ 站点域名**：`const api=(path)=>(base||location.origin)+path; const base="https://production.nodenear.shorttv.online"` ——`webpc/home` 在 `shorttv.online` 上 403、在 `production.nodenear.shorttv.online` 上 200。**发现 api 函数定义后看它的 base 变量**
4. 请求带上 `Referer: https://shorttv.online/`（部分端点校验）

## 1. 核心 API 端点（实测）

| 端点 | 用途 | 关键字段 |
|------|------|---------|
| `GET /api/v3/public/webpc/home` | 首页 | `data.hot[18]` + `data.updates[12]`（剧列表） |
| `GET /api/v3/public/theater/groups` | 分类组 | `data.latest/hot/top_rated` |
| `GET /api/v3/public/theater/dramas?genre={slug}&limit=30` | 分类列表 | `data.items[]` + `data.next_cursor`（**游标翻页**） |
| `GET /api/v3/public/rankings/{key}/dramas?limit=50&offset=N` | 榜单（follow/hot/new） | `data[]` 直接是 list，**offset 翻页** |
| `GET /api/v3/public/search?q={wd}&limit=36` | 搜索 | `data[]` 直接是 list |
| `GET /api/v3/public/dramas/{id}` | 剧详情 | `data.episodes[]`（index/title/media_asset_id/is_free/locked）+ `free_episodes` + `sensitivity` |
| `GET /api/v3/me/dramas/{id}/episodes/{index}/playback` | **播放** | `data.episode.playback_url`（mp4 或 keyserver m3u8）+ `episodes[]`（全部集含 locked 标记） |
| `GET /api/v3/public/feed/initial` | 首页 feed | **单条 item + continuation_cursor**（feed 流模式，不适合做列表源） |
| `GET /api/v3/me/adult-confirmations` POST | 成人确认 | 401（需登录，游客拿不到） |

## 2. ⚠️ 三大坑（都踩过）

### ① limit 超限返回 422 validation failed（不是 400/403）
`theater/dramas?limit=36` → **422** `{"status":false,"message":"validation failed"}`。实测：theater/dramas limit 上限 **30**；rankings 可到 **50**。**不同端点 limit 上限不同，逐一试探**（20→30→36→50 递增），422 = limit 超限不是 URL 写错。

### ② theater/dramas 用 cursor 翻页，`page` 参数无效
`?page=2` 返回和 page=1 **完全相同**的首条（参数被忽略）→ 必须用 `next_cursor`：先请求拿 `next_cursor` → 再 `&cursor={cur}` 翻页。实现：
```python
if page > 1:
    cur = ''
    for _ in range(page - 1):
        j = self._req_json(url + (f'&cursor={cur}' if cur else ''))
        if not j or not j.get('data'):
            break
        cur = j['data'].get('next_cursor', '')
        if not cur:
            break
    if cur:
        url = f'{BASE}/api/v3/public/theater/dramas?genre={tid}&limit=30&cursor={cur}'
```
rankings 反而用 offset 翻页（`?limit=50&offset={(page-1)*50}`）——**同一站点两种翻页机制并存，按端点区分**。

### ③ 付费墙：locked 集没有 playback_url；SENSITIVE 剧要成人确认
- `playback` 响应里 `episode.locked=True` 的集 → **无 playback_url 字段**（要充值解锁）→ detailContent 里 `if ep.get('locked'): continue` 跳过，不要塞空线路
- `free_episodes=9999` = 全免费；`free_episodes=N` = 前 N 集免费（试看），第 N+1 集起 locked
- `sensitivity=SENSITIVE` 的剧（如淫魔重生之情欲江山）`requires_adult_confirm: true` → 游客请求 playback 返回的 episode **连免费集也没有 playback_url**（`?adult_confirm=true` 等参数无效，`POST adult-confirmations` 401 需登录）→ **这类剧在羊壳里播不了，直接跳过该集即可，不要当 bug 修**
- 普通剧（sensitivity=NORMAL）免费集一定返回 playback_url（external-mp4 直链或 keyserver m3u8 签名链接，签名过期时间 `playback_expires_at`，约 20 分钟）

## 3. 详情播放链路（付费墙处理后的最终形态）

```python
# detailContent: 只对未 locked 的集请求 playback 接口（每集 ~1s，9 集 9s 可接受；更快的做法是只请求免费集）
for ep in (d.get('episodes') or []):
    if ep.get('locked'):
        continue
    pj = self._req_json(f'{BASE}/api/v3/me/dramas/{vid}/episodes/{idx}/playback', timeout=6)
    if pj and pj.get('data') and pj['data'].get('episode', {}).get('playback_url'):
        play_urls.append(f"{ep_title}${pj['data']['episode']['playback_url']}")
# playerContent: parse=0 直链 + header (UA + Referer)
```

## 4. 其他要点

- 封面 `cover_url` 有的直接是完整 URL、有的是 `/api/v3/public/zones/{zone}/media/assets/{asset_id}` 相对路径 → `_cover()` 统一 `url.startswith('http')` 判断
- 搜索返回 `data` 直接是 list（不是 `{items:[]}`）；theater/dramas 返回 `data.items`——**同一站点返回容器不一，取值时 `data if isinstance(data, list) else data.get('items', [])`**
- 全部分类（type_id='all'）用 rankings/hot 兜底（offset 翻页），genre 分类用 theater/dramas（cursor 翻页）
- 分类 slug：国产剧 `t-ucs0xp`、动漫 `t-k3onqj`、萝莉 `t-c2lbi7`、系统 `t-kv5ena`、创作者 `t-mqnyjd`、都市 `urban`、悬疑 `mystery` 等（主页"内容筛选"区 href 的 `?genre={slug}` 提取）
- 发文件用纯英文路径 `/opt/data/out/shorttv.py`（中文路径微信收不到）
