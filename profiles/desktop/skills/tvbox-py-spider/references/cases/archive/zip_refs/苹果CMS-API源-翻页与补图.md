# 苹果CMS API 源：主分类翻页 + 批量补图（2026-08-23 无水印资源实战定稿）

> 无水印资源网（api.wsyzy.net，苹果 CMS）py 源排障实录。
> 站点结构：主页含 `<script>var maccms={...}</script>`；API `/api.php/provide/vod/`。

## 一、主分类翻页策略（用户"分类页翻几个就看不到了"实证）

**背景**：API `t=主分类id` 返回 0 条（主分类只是容器，视频全挂子分类）→ 主分类必须轮询 CAT_SUBS 子分类合并。

**初版 bug**（每页 24 条 + 翻几页就没）：
```python
per = 30 // len(subs)          # 12 个子分类 → 每类只取 2 条
for sid in subs:
    d = self._get({'ac':'list', 't':sid, 'pg':str(page)})
    for v in d.get('list', [])[:per]: ...   # 固定 2 条/类
```
问题：①每页只 24 条不满 30；②**子分类页数差异巨大**（电影组实测：动作片 287 页 vs Netflix电影仅 7 页）→ 翻到第 7 页后短子分类耗尽，每页只剩 22 条且内容稀疏错乱 = "翻几个就看不到了"。

**正确策略 = 每页取"各子分类第 page 页数据合并，跳过空页，凑满 30 条"**：
```python
if cid in CAT_SUBS:
    vods = []
    for sid in CAT_SUBS[cid]:
        if len(vods) >= 30:
            break
        try:
            d = self._get({'ac': 'list', 't': sid, 'pg': str(page)})
            for v in d.get('list', []):
                vods.append(self._fmt_vod(v))
                if len(vods) >= 30:
                    break
        except Exception:
            pass
    if not vods and page > 1:
        return {'list': [], 'page': page, 'pagecount': page, 'limit': 30, 'total': 99999}
    return {'list': self._fill_pics(vods[:30]), 'page': page, 'pagecount': 9999,
            'limit': 30, 'total': 99999}
```
- 第 N 页 = 所有子分类第 N 页的内容，短子分类空页自然跳过，页数由最长子分类决定（剧情片 1308 页）
- **实测**：电影 1-15 页每页 30 条、页内 0 重复、跨页 0 重复（240 条全部唯一）；6 主分类跨页重复全 0
- **翻过头**（所有子分类该页都空）→ 返回空 list，壳显示"没有了"
- **⚠️ 判定"翻页坏了"的标准**：连续翻 N 页对比每页首页 vod_id 是否变化 + 跨页 id 交集（`len(set(ids1) & set(ids3))`），重复/变少 = 翻页策略问题，不是站点问题

## 二、列表无图 → ac=detail&ids= 批量补图（用户"没图片"/"前几个没有图"实证）

**背景**：`ac=list` 返回字段**没有 vod_pic**（只有 vod_id/vod_name/type_id/vod_remarks/vod_play_from），但 `ac=detail&ids={逗号分隔id}` 带 vod_pic。

**⚠️ 接口限制：ac=detail&ids= 每次最多返回 20 条**——30 个 id 一次请求只回 20 个 → 列表**最前面的** 10 个没补上图（用户"伦理和短剧的前几个没有图"根因）。返回顺序与请求顺序不一致，不能靠截断推断。

**修复 = 按 20 个一批循环请求**：
```python
def _fill_pics(self, vods):
    if not vods:
        return vods
    try:
        pic_map = {}
        ids = [v['vod_id'] for v in vods if v.get('vod_id')]
        for i in range(0, len(ids), 20):          # 每 20 个一批（接口上限）
            batch = ids[i:i + 20]
            try:
                d = self._get({'ac': 'detail', 'ids': ','.join(batch)})
                for v in d.get('list', []):
                    pic_map[str(v.get('vod_id'))] = v.get('vod_pic', '')
            except Exception:
                pass
        for v in vods:
            v['vod_pic'] = pic_map.get(str(v.get('vod_id')), v.get('vod_pic', ''))
    except Exception:
        pass
    return vods
```
实测 6 主分类全 30/30 有图（修复前伦理/短剧只有 20/30）。

**⚠️ 三个都要接 _fill_pics**：homeContent（首页）、homeVideoContent（壳的"推荐"页——调用的是它不是 homeContent，漏接则推荐页 0 图）、categoryContent（主分类合并 + 子分类直查）。

## 三、其他关键点

- **分类树补全法**：主页 HTML `re.findall(r'vod/type/id/(\d+)\.html[^>]*>\s*([^<]{1,15})\s*<', html)` 抓全量（主分类+子分类平铺）；无水印资源实测 6 主类 50 子项（含短剧 9 子、伦理 7 子，初版只写 4 类 33 项被用户打回"分类筛选能否再详细点"）
- **MAIN_CATS 元组顺序 (name, id)**：homeContent/init 必须 `for name, cid in MAIN_CATS` 解包，写反则分类显示 1/2/3/4 点击全 0 条（不报错！）
- **子分类 id 直接 t= 查有效**（54 爽文 9 条、56 港台三级 20 条实证）；主分类 id 是容器 t= 返回 0
- **播放**：线路已是 m3u8 直链 → playerContent 一律 `{'parse':0, 'playUrl':'', 'url':id}`
- **搜索**：见 `references/apple-cms-suggest-search.md`（suggest 接口绕过验证码 + 翻页真相 + 羊壳 require login 坑）
