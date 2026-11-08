# API / SPA 模块 v8

本模块用于采集 API、JSON 接口站、SPA/API 多模块站。API 字段以真实响应为准；同站旧源可参考但必须重测。

# 采集API骨架（JSON接口站）

## 关键特征

```
API: /api.php/provide/vod/?ac=list&tid={分类ID}&pg={页码}
详情: /api.php/provide/vod/?ac=detail&ids={ID}
搜索: /api.php/provide/vod/?ac=detail&wd={关键词}
返回: JSON格式，直接解析无需HTML选择器
```

```python
#!/usr/bin/python
import json
import re
from urllib.parse import urljoin, urlparse
import requests
from base.spider import Spider

class Spider(Spider):
    def getName(self): return "API站点"
    def init(self, extend=""):
        self.name = "API站点"; self.host = "https://example.com"; self.api = self.host + "/api.php/provide/vod/"
        self.headers = {"User-Agent": "Mozilla/5.0", "Referer": self.host + "/"}
        self.session = requests.Session(); self.session.headers.update(self.headers)
    def _json(self, url, params=None):
        try: return self.session.get(url, params=params or {}, headers=self.headers, timeout=15, verify=False, proxies=self.session.proxies or None).json()
        except Exception: return {}
    def _html(self, url):
        try:
            r = self.session.get(url, headers=self.headers, timeout=15, verify=False, proxies=self.session.proxies or None); r.encoding = r.apparent_encoding or "utf-8"; return r.text
        except Exception: return ""
    def _fix(self, url): return urljoin(self.host + "/", url or "")
    def _is_media(self, url): return bool(re.search(r"\.(?:m3u8|mp4)(?:$|[?#])", urlparse(url).path, re.I))
    def _resolve_media(self, url, depth=0):
        url = self._fix(url)
        if self._is_media(url) or depth > 3: return url
        body = self._html(url)
        m = re.search(r'player_data\s*=\s*(\{.*?\})', body, re.S)
        if m:
            try:
                value = json.loads(m.group(1)).get("url", "")
                if value: return self._resolve_media(urljoin(url, value), depth + 1)
            except Exception: pass
        m = re.search(r'(?:var\s+now|var\s+playurl)\s*=\s*["\']([^"\']+)', body) or re.search(r'https?://[^"\' ]+\.(?:m3u8|mp4)[^"\' ]*', body)
        if m:
            value = m.group(1) if m.lastindex else m.group(0)
            return self._resolve_media(urljoin(url, value.replace("&amp;", "&")), depth + 1)
        frame = re.search(r'<iframe[^>]+src=["\']([^"\']+)', body, re.I)
        return self._resolve_media(urljoin(url, frame.group(1)), depth + 1) if frame else url
    def _item(self, v): return {"vod_id": str(v.get("vod_id", "")), "vod_name": v.get("vod_name", ""), "vod_pic": self._fix(v.get("vod_pic", ""))}
    def homeContent(self, filter):
        d = self._json(self.api, {"ac": "list"}); return {"class": d.get("class", []), "list": [], "filters": {}}
    def homeVideoContent(self):
        d = self._json(self.api, {"ac": "detail", "pg": 1}); items = d.get("list", [])
        return {"list": [self._item(v) for v in items]}
    def categoryContent(self, tid, pg, filter, extend):
        pg = int(pg) if str(pg).isdigit() else 1; d = self._json(self.api, {"ac": "list", "tid": tid, "pg": pg})
        return {"page": pg, "pagecount": int(d.get("pagecount", 1) or 1), "limit": int(d.get("limit", 20) or 20), "total": int(d.get("total", 0) or 0), "list": [self._item(v) for v in d.get("list", [])]}
    def detailContent(self, ids):
        d = self._json(self.api, {"ac": "detail", "ids": ids[0] if isinstance(ids, list) else ids}); out = []
        for v in d.get("list", []): out.append({**self._item(v), "vod_play_from": v.get("vod_play_from", ""), "vod_play_url": v.get("vod_play_url", "")})
        return {"list": out}
    def searchContent(self, key, quick, pg="1"):
        pg = int(pg) if str(pg).isdigit() else 1; d = self._json(self.api, {"ac": "detail", "wd": key, "pg": pg}); items = d.get("list", [])
        if not items: items = self._json(self.api, {"ac": "list", "wd": key, "pg": pg}).get("list", [])
        return {"page": pg, "list": [self._item(v) for v in items]}
    def playerContent(self, flag, id, vipFlags):
        url = self._resolve_media(id)
        return {"parse": 0 if self._is_media(url) else 1, "url": url, "header": json.dumps(self.headers)}
```

---

## 场景9：Nuxt/SSR 短剧站开发（51短剧复盘）

**适用特征**：页面含 `__NUXT_DATA__`、Nuxt 路由 chunk、`_payload`、SSR JSON 索引数组；普通 HTML 选择器为空但页面源码中能搜到 `video_id/title/cover/episode_id/actor_id` 等字段。

**强制流程**：
1. 若 `analyze_website` 未识别 CMS，不要立即套 MacCMS；先抓分类第一页、播放页、演员页，检查 `__NUXT_DATA__`。
2. 实现 Nuxt 索引数组还原函数 `_payload(html)`，把 `["ShallowReactive",1]` 这类引用数组还原成真实对象。
3. 用 `_walk(obj, keys)` 递归查找字段组合，不依赖 HTML 选择器。
4. 列表项如果有 `episode_id`，必须保留到 `vod_id`：`drama-play?id={video_id}&episode_id={episode_id}`。只传 `id` 可能导致播放页没有 `video_url`。
5. 演员、专题、榜单等 `vod_tag:"folder"` 必须在 `categoryContent(folder_id, pg, ...)` 里实现，并返回真实 `page/pagecount/limit/total`；`detailContent()` 只做兼容兜底。
6. folder 二级分页格式必须逐页验证，可能是 `?page=2` 而不是 `/page/2/`。
7. 列表页禁止默认逐条请求二级/详情补图；除非用户明确要求完整优先，否则当前页字段优先，避免演员页/专题页加载过慢。

**Nuxt 还原骨架**：
```python
def _payload(self, html):
    m=re.search(r'<script[^>]+id=["\']__NUXT_DATA__["\'][^>]*>(.*?)</script>', html, re.S|re.I)
    if not m: return None
    try:
        raw=json.loads(m.group(1).strip()); memo={}
        def get(i):
            if not isinstance(i,int) or i<0 or i>=len(raw): return i
            if i in memo: return memo[i]
            x=raw[i]
            if isinstance(x,list):
                out=[]; memo[i]=out
                for v in x: out.append(get(v))
                return out
            if isinstance(x,dict):
                out={}; memo[i]=out
                for k,v in x.items(): out[k]=get(v)
                return out
            memo[i]=x; return x
        return get(0)
    except Exception as e:
        print(f"[{self.getName()}] Nuxt解析失败: {e}"); return None

def _walk(self, obj, keys):
    out=[]; seen=set()
    def go(x):
        if isinstance(x,dict):
            if all(k in x for k in keys):
                mark="|".join(str(x.get(k)) for k in keys)
                if mark not in seen: seen.add(mark); out.append(x)
            for v in x.values(): go(v)
        elif isinstance(x,list):
            for v in x: go(v)
    go(obj); return out
```

**短剧字段映射规则**：
- 标题：`title/name/video_title/drama_name`
- 视频 ID：`video_id/playlet_id/id`
- 集数 ID：`episode_id`，有则拼入播放页 URL。
- 封面：`cover/cover_img/cover_image/image/poster/thumb`
- 播放：详情页递归找 `episode_title + video_url`；若为空，先检查列表 `episode_id` 是否丢失。
- 裸 ID 播放入口坏不代表资源不可播；必须对比 `drama-play?id=xxx` 与 `drama-play?id=xxx&episode_id=yyy`。若带 `episode_id` 的入口能返回 `video_url`，以列表 episode 入口为准，不要按裸详情入口判死。
- 角标：播放量/追剧数可放 `vod_remarks`，但位置由客户端控制。

**folder 演员二级分页示例**：
```python
if str(cid).startswith("actor_detail_"):
    aid=re.search(r"actor_detail_(\d+)", str(cid)).group(1)
    url=self.host+"actor-detail/"+aid+"/"+("?page="+str(pg) if int(pg)>1 else "")
    html=self._req(url); data=self._payload(html)
    works=self._walk(data,["video_id","title"]) or self._walk(data,["video_id","video_title"])
    arr=[]; seen=set()
    for x in works:
        v=self._vod(x, False)
        if v and v["vod_id"] not in seen: seen.add(v["vod_id"]); arr.append(v)
    total,limit,pagecount=self._meta(html)
    return {"list":arr,"page":int(pg),"pagecount":pagecount,"limit":limit,"total":total or len(arr)}
```

**关键教训**：
- `detailContent()` 不是可分页目录的主入口；folder 点击通常走 `categoryContent()`。
- `pagecount=1` 是假完成，会让演员/专题二级不能翻页。
- 不要把图片代理用于播放链接；m3u8/mp4 必须用媒体直链或 playerContent 解析。

---

---
## 场景8：SPA/API型多模块站点开发（R星精选复盘）

**核心经验**：遇到复杂 SPA + JSON API 站点时，先找稳定锚点，再做最小差异修改；越复杂的网站，越不能凭经验猜。若同目录已有可用源，必须优先读取并复用其鉴权、解密、代理、播放协议和字段映射，不要另起炉灶重写。

**典型特征**：
- 首页 HTML 只有 `app` 容器和大量 JS/CSS，内容由前端接口加载。
- API 需要游客 token、请求头 token、响应 `enc:true` 加密。
- 内容类型混合：漫画、小说、有声漫、动漫、视频、短视频/抖涩、直播。
- 分类返回并非统一资源列表，部分“推荐”分类返回专题/榜单聚合。
- 字段可能嵌套，例如视频列表是 `{movie, movieUser}`，真实封面在 `movie.imgurl`，播放在 `movie.movieurl`。

**强制流程**：
1. 先 `analyze_website` 判断是否为 SPA/API 型，若 HTML 选择器为空，不要按 XPath 模板硬写。
2. 检查同目录、同站名、同系列源，例如 `R星测试.py`、`xxx测试.py`、旧版可用源。
3. 如果发现已有可用源，以它为底座做最小修改，优先复用 token 获取、响应解密、图片代理、分类 ID 编码、播放/阅读协议、抖涩/直播特殊接口。
4. 对每个模块至少实测一条完整链路：`分类 → 列表 → 详情 → playerContent`。
5. 不只验证“列表有数据”，还要验证：封面非空、ID 带模块前缀、详情有线路、播放器 URL 可用。

**鉴权与解密经验**：
- 若直接请求接口返回 `302/登录过期`，先反查前端 `http.js` 或可用源里的 token 逻辑。
- 常见游客 token 接口：`/user/autoUser/null/null/null`、`/user/autoUser/null/td/null`。
- R星类站点响应解密流程：
```python
def decode_api_data(data_str):
    step1 = base64.b64decode(pad_b64(data_str)).decode('latin1')
    step2 = step1[::-1]
    step3 = base64.b64decode(pad_b64(step2))
    return json.loads(step3.decode('utf-8'))
```
- 解密后常见结构：`{token, dataUser, tableSuffix}`，后续请求必须在 header 中带 `token`。

**分类层级经验**：
- 用户说“推荐按二级页面做”，不能理解为普通筛选项直接出资源。
- 正确结构是：`一级分类 → 推荐 → 专题/榜单文件夹 → 资源列表`。
- 文件夹卡片必须用 `vod_tag: folder`，ID 可编码为：
```python
folder$manhua$410
folder$anime$27495
folder$movie$27459
```
- 点击 `folder$...` 后，`categoryContent` 再根据模块走真实专题列表接口。

**R星类接口映射**：
- 漫画分类：`manhua/fenglei`
- 漫画普通列表：`manhua/onetab/{tid}/{pg}/{size}/time/hjm.ojbk`
- 漫画推荐专题：`manhua/fengleidata/{tid}/hjm.ojbk`
- 漫画专题资源：`manhua/moredata/{zhutiId}/{pg}/{size}/time/hjm.ojbk`
- 漫画详情/章节：`manhua/data/{id}` 或 `manhua/datav2/1/{id}/hjm.ojbk`
- 漫画图片：`manhua/data/zjv2/{chapterId}/hjm.ojbk`，`imgurl` 逗号分隔。
- 小说分类：`book/fenglei/1`
- 小说列表：`book/md/xsmoredata/{tid}/{pg}/{size}/zx/hjm.ojbk` 或 `book/everyday/{pg}/{size}/time`
- 小说专题资源：`book/moredata/{zhutiId}/{pg}/{size}/time/hjm.ojbk`
- 有声漫：`manhua/ysm/hjm.ojbk`
- 动漫分类：`movie/fenglei_dm/hjm.ojbk`
- 视频分类：`movie/fenglei`
- 动漫/视频普通列表：`movie/fengleidataShow/{tid}/{pg}/{size}/zx[/hjm.ojbk]`
- 动漫/视频推荐专题：`movie/fengleidata/{tid}[/hjm.ojbk]`
- 动漫/视频专题资源：`movie/moredata/{zhutiId}/{pg}/{size}/zx/hjm.ojbk`
- 抖涩/抖音：`tik/zuixin/{pg}/{size}/time/hjm.ojbk`，入口可取 30 条；详情短视频流建议首条固定 + 后续全库随机抽样。
- 直播：`local_live/fldata/{liveId}/{pg}/20`，真实播放字段常为 `stream`。

**字段映射经验**：
- 列表封面不要只取顶层 `imgurl`，要检查嵌套：
```python
movie = item.get('movie', item)
pic = movie.get('imgurl') or movie.get('cover') or movie.get('image') or ''
```
- 视频列表常见结构：`item = {movie:{...}, movieUser:{...}}`。
- 视频直链可直接从 `movie.movieurl` 取，试看片段为 `movie.movieurlSk`。
- 直播列表常见字段：`username/snapshot/stream/viewersCount/isOnline`。
- 小说章节接口可能只返回 `txturl`，需要二次 GET 文本文件；文件内容可能仍是 base64，需要尝试解码。


**短视频随机流经验**：
- 用户说“像刷抖音一样上下滑随机”，不能只把当前页 80 条洗牌；那只是页内随机，不是全库随机。
- 正确语义是：点击哪个视频，第一条必须固定为该视频；后续视频从整个抖涩库随机抽样。
- 建议入口列表取 30 条，详情播放流也返回 30 条：`1 条点击项 + 29 条全库随机项`。
- 每次进入详情都重新生成随机池；退出后再点击其他视频，应生成新 30 条，不沿用上一组。
- 可用 `last_tiktok_pool` 记录上一组 ID，下次随机时尽量避开，减少重复感。
- 如果接口有分页总数，例如 `pages=351`，可随机抽多个页码：
```python
res = api_req(f"tik/zuixin/{pg}/30/time/hjm.ojbk")
pages = int(res.get('pages', 1))
for rp in random.sample(range(1, pages + 1), min(10, pages)):
    rr = api_req(f"tik/zuixin/{rp}/30/time/hjm.ojbk")
```
- 随机池要去重，且第一条点击项不能被随机逻辑挤掉：
```python
clicked_item = records[clicked_idx]
seen = {str(clicked_id)}
pool = []
# 随机页取样后 append 到 pool
random.shuffle(pool)
ordered_records = [clicked_item] + pool[:29]
```
- 播放标题必须清理 `#` 和 `$`，否则会破坏 `vod_play_url` 的分集结构：
```python
title = str(title).replace('#', ' ').replace('$', ' ')
```

**短视频缓存/续播避坑**：
- 客户端可能记住同一 `vod_id`、同一 `vod_play_from`、同一播放列表的上次集数。
- 为避免再次点击 1 号视频却恢复到上次滑到的视频，必须让详情和播放项带点击上下文。
- 列表 ID 建议带页码、视频 ID、列表位置：
```python
tiktok${pg}${id}${idx}
```
- `vod_play_from` 不要固定为“抖音模式”，应包含点击 ID：
```python
vod_play_from = '抖涩_' + str(clicked_id)
```
- 播放项 ID 应包含点击 ID 和序号，最后一段才是真实 URL：
```python
video_short_play${clicked_id}${idx}${m3u8_url}
```
- `playerContent` 解析时取最后一段，避免把上下文字段拼进播放地址：
```python
url = id.split('$')[-1]
```
- 验证标准：连续点击不同视频时，第一条 ID 必须等于点击 ID；后续 29 条应来自随机页；再次点击同一视频，第一条仍固定，但后续随机组应变化。

**视频播放与解密经验补充**：
- API 型站点的播放失败往往不是播放器问题，而是 token 或响应解密没处理。
- `enc:true` 解密后再取字段；不要直接从加密壳的 `data` 里找 `movieurl`。
- 视频列表常有嵌套：`item.movie.movieurl`、`item.movie.movieurlSk`、`item.movie.imgurl`。
- 有直链时可直接把 m3u8 base64 编进详情 ID，减少详情二次请求：
```python
video_detail_direct${movie_id}${base64_m3u8}
```
- 对直播类内容，优先找 `stream`，其次才是 `playurl/playUrl/flv/m3u8/hls`。

**ID编码经验**：
必须给不同模块加稳定前缀，避免详情和播放混路由：
```python
comic${id}
book${id}
ysm${id}
anime_direct${id}${base64_m3u8}
video_detail_direct${id}${base64_m3u8}
tiktok${pg}${id}
video_live${stream}
folder$movie${zhutiId}
```

**验证清单**：
- `homeContent`：一级分类完整，筛选含“推荐”。
- `categoryContent('manhua', 推荐ID)`：返回 `folder$manhua$...`，不是直接资源。
- `categoryContent('anime', 推荐ID)`：返回 `folder$anime$...`。
- `categoryContent('movie', 推荐ID)`：返回 `folder$movie$...`。
- `categoryContent('folder$...')`：返回真实资源。
- 非推荐分类返回真实资源且 `vod_pic` 非空。
- 有声漫一级分类有资源。
- 抖涩按可用源接口返回资源。
- 直播 `playerContent` 返回 `stream`。

**关键教训**：
- 有可用基准源时，先读基准源；不要重新发明鉴权/解密。
- API型站点不要套 HTML/XPath 评分标准；真实可用性以端到端接口验证为准。
- 用户的“二级页面”是交互层级要求，不是简单筛选字段。
- 一切字段以真实 JSON 返回为准，不凭名称猜。


---