# 51短剧 v2 写法参考（朋友版 vs 我版）

参考文件：`/opt/data/cache/documents/doc_4c7afa95d82f_51短剧2.py`（300 行，朋友写的）

## 核心差异

### 1. 分类维度：6 段筛选 vs 拆多个分类页
- **朋友版**：只留 1 个 `drama` 分类 + `explore-drama/{theme}-{setting}-{background}-{audience}-{time}-{recommend}/` 6 段参数，通过 filters 面板驱动所有维度（33 个主题 + 34 个设定 + 9 个背景 + 3 个受众 + 5 个时间 + 6 个推荐）
- **我版**：拆 AISD/OSD/explore/周榜/男演员/女演员/推荐榜/热度榜/新人榜 9 个独立分类
- **要点**：朋友版筛选维度更完整，6 段参数直接对应 explore-drama URL 路径；我版是简化版，丢掉了 setting/background/audience 等深度筛选

### 2. 演员二级：vod_id 前缀 `actor_detail_` + 返回剧集列表
- **朋友版**：`vod_id = "actor_detail_" + aid`，`vod_tag = "folder"`（壳端识别为文件夹）；点开进 `detailContent` 返回的是**完整剧集列表**（每条都是独立 vod，vod_tag="video"）
- **我版**：`vod_id = "ac_" + aid`，`detailContent` 返回 1 个演员 vod + 把所有作品拼成播放串 `vod_play_url`
- **关键差异**：朋友版演员二级走的是**文件夹→剧集列表**的壳端原生模式，每个剧集独立 vod_id；我版把作品拼到 vod_play_url 里（也是对的，但壳端可能显示不同）

### 3. 演员图片：干脆留空
- **朋友版**：`vod_pic = ""`，不折腾图（因为服务器 `/files/novelquickVideo/.../avatar.jpg` 返回 0 字节，不可用）
- **我版**：尝试走 NUXT_DATA 的 avatar 字段 + 壳端 AES 解密代理
- **结论**：头像就留空，别折腾；剧集封面走 upload_01 路径 + AES 解密不可少

### 4. NUXT_DATA 解析：`json.loads` 直接解 vs 手动 tokenize
- **朋友版**：`json.loads(m.group(1).strip())` 直接解成数组，再 `memo = {}` 递归解引用。代码短但依赖 NUXT_DATA 是合法 JSON 数组
- **我版**：手动 tokenize + `parse_value` + `resolve`
- **要点**：51hub 的 NUXT_DATA 确实是合法 JSON 数组，用 `json.loads` 就够了

### 5. 递归查找：`_walk(obj, keys)`
- **朋友版**：`_walk(data, ["video_id","title"])` 递归遍历整个 NUXT_DATA
- **我版**：`_find_video` 只找第一个含 `video_id` 的顶层对象
- **要点**：复杂页面（演员二级、筛选页）视频对象可能嵌在深层，`_walk` 更通用

### 6. 演员图片代理：type=img
- **朋友版**：`type=img` 简单参数，URL base64 编码
- **我版**：`type=tbr_img`

## 我版可直接借鉴的点

1. **演员二级改用 `actor_detail_` 前缀**（壳端 folder 识别）
2. **6 段筛选**（把 explore-drama 6 段参数做成 filters 面板）
3. **NUXT_DATA 用 `json.loads`**（简化 devalue 解析器）
4. **`_walk` 递归查找**（比找第一个更稳）
5. **演员图片直接留空**

---

## v3 优化：本地图片映射缓存（关键升级）

参考：`/opt/data/cache/documents/doc_1730752af742_51短剧3.py`（308 行）

### 核心思路
**列表页 NUXT_DATA 里视频对象的 `cover` 字段常常为空字符串**（Nuxt SSR 服务端不随列表返回图片），但用户手机浏览器访问时 shell 端或已缓存的 NUXT_DATA 快照里有完整图片映射。v3 利用这一点：

### 实现
1. `init()` 时读取手机本地文件 `/storage/emulated/0/影视/AI/51短剧/51短剧图片映射.json`
2. 该文件是用户之前抓取的某页 NUXT_DATA HTML（或已解析的映射）
3. 解析出 `{title: cover_url}` 和 `{video_id: cover_url}` 两个映射表
4. `_vod()` 时优先查 `image_id_map[vid]` → `image_map[title]` → 再走 `_pic()` 从 NUXT 取
5. 演员头像同理：`_actor_cover(aid)` 递归调 `detailContent(["actor_detail_"+aid])` 拿第一张作品封面

### 优势
- 列表页不联网也能出图
- 避免每次分类页都请求 NUXT_DATA 拿图（省流量/响应快）
- 演员头像不折腾 `/files/`（返回 0 字节），直接用其作品封面替代

### 注意事项
- 用户需在手机上把 NUXT_DATA 存到该路径（可让用户用浏览器访问分类页→查看源码→复制 __NUXT_DATA__ 那段 → 存为 51短剧图片映射.json）
- 映射表会过期（新剧没有图），需要定期更新该文件

---

## v4 最终优化：自动拉取头像 + DOM 解析演员列表（关键升级）

参考：`/opt/data/out/51hub.py`（359 行，最终交付版）

### 核心升级点

**1. 去掉手动缓存文件依赖**
- v3 需要用户在手机放 `51短剧图片映射.json`，v4 完全自动化
- `init()` 时只初始化空字典：`self.image_map = {}; self.image_id_map = {}; self.actor_cover_map = {}`

**2. 演员头像自动拉取（进演员页时）**
- 用户切到演员页（`categoryContent` 里 `cid == "actor"`）时，**自动为当前页所有演员请求详情页**
- `_actor_cover(aid)` 函数逻辑：
  - 检查 `actor_cover_map[aid]` 是否已有，有则直接返回
  - 无则请求 `actor-detail/{aid}/` 页面，从 NUXT_DATA 提取 `works = _walk(data, ["video_id","title"])`
  - **把该演员所有作品图片缓存进 `image_id_map[vvid] = pic` 和 `image_map[vtitle] = pic`**（后面进该剧集详情直接用，不重复请求）
  - 取第一张作品封面当头像，存进 `actor_cover_map[aid]` 返回
- `_page(actor=True)` 里批量调：`for _, aid in actor_links: if aid not in self.actor_cover_map: self._actor_cover(aid)`
- **翻页时自动累积**：第 1 页拉 20 个，翻第 2 页又自动拉 20 个，缓存跟着积累

**3. 演员列表页改走 DOM 解析**
- **根因**：`explore-actor/2/` 页面 NUXT_DATA 里**演员对象和剧集对象混在一起**，`_walk(data, ["actor_id","name"])` 匹配到的是**剧集对象**（剧集也有 name 字段）
- **验证方法**：对比 NUXT_DATA 和 DOM 链接数——DOM 里 `/actor-detail/(\d+)/` 有 30 个唯一链接，NUXT_DATA 里 actor_id+name 也能找到 30 个演员，但 NUXT 里混了 32 个"演员"（其实是剧集）
- **方案**：`actor_links = re.findall(r'href=["\\'](/actor-detail/(\d+)/)["\\']', html)` 从 DOM 取演员链接
- 再用 `_walk(data, ["actor_id","name"])` 建 `actor_id → {name, works, fans_count}` 映射，用于显示副标题（作品数/粉丝数）

**4. 演员二级返回补上 `vod_play_from` + `vod_play_url`**
- v3 演员二级返回的 list 里丢了播放字段，点播放报错
- 修复：`"vod_play_from":"51短剧","vod_play_url":x["vod_id"]`（vod_id 本身就是 `https://host/drama-play?id=vid&episode_id=eid`）

### v4 分类结构（精简版）
```
演员（filters: 热门/男演员/女演员/新人榜/热度榜/推荐榜）
剧集（explore-drama 6 段 filters 面板）
剧集周榜（rank-drama/week/）
AI成人短剧（drama/AISD/）
```

### 核心代码片段

**_actor_cover 函数**：
```python
def _actor_cover(self, aid):
    if aid in self.actor_cover_map: return self.actor_cover_map[aid]
    try:
        html = self._req(self.host + "actor-detail/" + str(aid) + "/")
        data = self._payload(html)
        works = self._walk(data, ["video_id","title"]) or self._walk(data, ["video_id","video_title"])
        for w in works:
            vvid = str(w.get("video_id") or "")
            vtitle = str(w.get("title") or "")
            vcover = w.get("cover") or w.get("cover_img") or w.get("cover_image")
            pic = self._pic(vcover) if vcover else ""
            if vvid: self.image_id_map.setdefault(vvid, pic)
            if vtitle and pic: self.image_map.setdefault(vtitle, pic)
        first_pic = ""
        for w in works:
            vcover = w.get("cover") or w.get("cover_img") or w.get("cover_image")
            if vcover: first_pic = self._pic(vcover); break
        self.actor_cover_map[aid] = first_pic
        return first_pic
    except: return ""
```

**_page 演员分支**：
```python
actor_links = re.findall(r'href=["\\'](/actor-detail/(\d+)/)["\\']', html)
actor_meta = {}
if data:
    for x in self._walk(data, ["actor_id","name"]):
        aid = str(x.get("actor_id") or "")
        if aid and x.get("name"): actor_meta[aid] = x
for _, aid in actor_links:  # 全页拉取
    if aid not in self.actor_cover_map: self._actor_cover(aid)
for path, aid in actor_links:
    if aid in seen: continue
    seen.add(aid)
    meta = actor_meta.get(aid, {})
    pic = self.actor_cover_map.get(aid, "")
    works = self._num(meta.get("works")); fans = self._num(meta.get("fans_count"))
    result.append({"vod_id":"actor_detail_"+aid,"vod_name":str(meta.get("name") or aid),
                   "vod_pic":pic,"vod_remarks":("作品"+works if works else "演员作品")+((" · 粉丝"+fans) if fans else ""),
                   "vod_tag":"folder","vod_play_from":"","vod_play_url":""})
```