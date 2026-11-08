# 队列与随机流策略模块 v8.4

包含短视频随机流、缓存/续播避坑和音乐上下文播放队列。点击项必须固定，队列顺序必须稳定。

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

---
## 音乐源上下文播放队列规范（djDVD复盘，强制）

**白话需求映射**：用户说“点哪首歌就播放哪首歌，同时播放列表还是这个歌手/歌单/榜单的所有歌曲，顺序不能乱”，专业理解为：**播放上下文透传 + 队列重建 + 当前项定位**。

**标准术语**：
- 上下文播放队列（Context Playback Queue）
- 播放上下文透传（把当前歌曲所属歌手/歌单/榜单URL或ID写进每首歌的 `vod_id`）
- 队列重建（详情页根据上下文重新抓完整歌曲列表）
- 当前项定位（用当前歌曲URL/ID/hash在完整队列中定位被点击项）
- 队列顺序保持（按页面DOM顺序与分页顺序合并，禁止并发乱序）
- 列表态与播放态解耦（category只展示歌曲卡片，detail负责构建播放队列）

**实现规则**：
1. 歌手、歌单、榜单等聚合页不要在点击文件夹时直接播放，应先进入歌曲列表页。
2. 歌曲列表中的每首歌 `vod_id` 必须携带：当前歌曲唯一标识 + 所属上下文标识 + 可选标题/封面。推荐格式：
```python
def _ctx_song_id(self, item, context_url):
    return 'ctxsong$' + self.e64('||||'.join([item.get('url',''), context_url, item.get('name',''), item.get('pic','')]))
```
3. `detailContent` 收到 `ctxsong$...` 时，必须解码出 `selected_url` 与 `context_url`，重新解析 `context_url` 的完整歌曲列表。
4. 当前播放项必须用稳定唯一值匹配，优先 URL/ID/hash，禁止只用歌名匹配。歌名重复、Live、Remix 很常见。
5. 播放返回建议使用双线路：
```python
vod_play_from = '当前播放$$$播放列表'
vod_play_url = 当前歌曲episode + '$$$' + '#'.join(完整队列episodes)
vod_play_index = 当前索引 + 1
play_index = 当前索引
```
6. 完整播放队列必须保持原页面顺序：
   - 单页：按DOM遍历顺序追加。
   - 多页：页码先排序，再按页内DOM顺序追加。
   - 如果并发抓分页，结果必须携带页码并排序后合并，禁止直接 `as_completed()` 顺序 append。
7. 去重必须稳定：用 `seen` 保留首次出现的歌曲URL/ID，不要排序去重导致顺序变化。
8. 点第 N 首时，详情页必须定位到第 N 首，当前播放线路只放第 N 首，播放列表线路仍包含该上下文下全部歌曲。
9. `vod_tag: folder` 只给可继续进入的歌手/歌单/榜单/筛选分类卡片使用；真实歌曲项必须进入 `detailContent`，不要继续当 folder。
10. 搜索出来的单曲没有上下文时，可只构建单曲播放；有搜索结果页上下文时也可按搜索页队列处理。

**参考详情骨架**：
```python
def detailContent(self, ids):
    vid = ids[0] if isinstance(ids, list) else ids
    if str(vid).startswith('ctxsong$'):
        selected_url, context_url, selected_name, selected_pic = self._ctx_song_decode(str(vid))
        tracks = self._get_all_song_items(context_url, selected_pic)
        idx = 0
        for i, t in enumerate(tracks):
            if t.get('url') == selected_url:
                idx = i
                break
        eps = [self._episode_from_item(t) for t in tracks]
        return {'list': [{
            'vod_id': vid,
            'vod_name': tracks[idx].get('name') if tracks else selected_name,
            'vod_pic': tracks[idx].get('pic') if tracks else selected_pic,
            'vod_play_from': '当前播放$$$播放列表',
            'vod_play_url': eps[idx] + '$$$' + '#'.join(eps),
            'vod_play_index': idx + 1,
            'play_index': idx
        }]}
```

**封面策略**：
- 有封面的卡片直接取本页封面。
- 无封面的歌手/歌单/榜单/分类卡片，进入下级页面取第一个可用封面。
- 歌曲封面优先取单曲详情页真实封面；取不到再回退到上级歌手/歌单/榜单封面。
- 大歌手页或超大歌单不要逐首同步抓详情封面导致卡死；可前若干首并发补真实封面，其余用fallback，点击播放详情时再强制刷新当前歌曲真实封面。

**层级经验**：
- 用户说“歌手改二级页面”：通常是 `歌手列表 → 该歌手所有歌曲`，点击歌手不是播放，而是进入该歌手歌曲列表。
- 用户说“歌单改三级页面”：通常是 `歌单 → 筛选分类 → 歌单卡片 → 歌单全部歌曲`。
- 用户说“榜单筛选作为二级页面”：通常是 `TOP/新歌 → 榜单选项卡片 → 该榜单歌曲列表`，原筛选项不要放在 home filters。
- “所有歌曲”指需要处理分页，不能只取第一页。

**布局经验**：
- 用户说“不要列表排列/常规排列”，不要给普通歌曲/歌单/榜单卡片写 `style: {'type':'list'}` 或强制 `rect`。
- 歌手头像可以保留 `style: {'type':'oval','ratio':1}` 以显示圆形头像。
- 普通卡片让客户端默认布局；除非用户明确要求每排数量或卡片比例。

**djDVD实战踩坑**：
- 歌手页上千首歌，逐首详情抓封面会非常慢；必须做限量并发、缓存和fallback。
- 单曲列表页没有图片时，真实封面通常在单曲详情页 `.djpic/.djpg/.cover` 等区域，不能用推荐歌单图冒充。
- 榜单卡片本身无封面时，可用榜单第一首歌真实封面做卡片封面。
- 歌单分类卡片无封面时，可进入该分类页取第一个歌单封面。
- 播放列表跨分页时，一定按页码排序后合并；并发只用于辅助抓封面或接口，不能破坏主列表顺序。