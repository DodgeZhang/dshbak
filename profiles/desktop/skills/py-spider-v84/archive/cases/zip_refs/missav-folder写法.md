# missav.py 女优/标签 folder 写法（用户验证的标准模式）

> 来源: 用户发的 missav.py（doc_cfcd5e9956e0_missav.py），已存档 `/opt/data/archive/xbpq资料/missav参考.py`
> 用途: py 源里"女优/标签/演员"等二级目录的**标准 folder 写法**，用户多次纠正后确认

## 核心机制（三层结构）

```
一级分类（如"女优一览"）→ categoryContent 返回女优列表（folder 标记）
  ↓ 点击女优（vod_id = href 路径）
categoryContent 判断路径 → 返回该女优的作品列表
  ↓ 点击作品（vod_id = v:xxx 或详情 URL）
detailContent → 播放
```

## 关键写法（对照 missav.py）

### 1. folder 列表项（`_parse_actress_list` 第 434-440 行）

```python
item = {
    'vod_id': href,                  # ★ href 直接作 vod_id（如 /actresses/xxx/）
    'vod_name': name or '女优',
    'vod_pic': cover or '',
    'vod_remarks': ' | '.join(remarks) if remarks else '女优',
    'vod_tag': 'folder'              # ★★ 必须有 vod_tag: 'folder' 标记！
}
```

**关键点**：
- `vod_id` 用 **href 路径**（不是 dir_ 前缀、不是自定义编码）——壳识别路径后点击调 **categoryContent**
- **必须带 `vod_tag: 'folder'`**——羊壳靠这个识别文件夹，没有它点击会被当视频直接播放！

### 2. categoryContent 路径判断（第 369-370 行）

```python
if tid.startswith('http') or '/actresses/' in tid:
    return self._get_actress_videos(tid, pg, ext)   # 女优详情 → 作品列表
```

通用写法：`if tid.startswith('/actor/detail/') or tid.startswith('/s/tag/'):` 判断路径 → 请求该页 → 解析列表返回。

### 3. 双保险：detailContent 也兼容

```python
if vid.startswith('/actor/detail/') or vid.startswith('/s/tag/'):
    try:
        return self.categoryContent(vid, 1, '', {})   # 防壳调 detailContent
    except Exception:
        return {'list': []}
```

## 18J 站应用实例（已验证）

```python
# 女优列表项
{'vod_id': '/actor/detail/zhuimingkong/', 'vod_name': '椎名空',
 'vod_pic': '...', 'vod_remarks': '女优', 'vod_tag': 'folder'}

# 标签列表项
{'vod_id': '/s/tag/%E7%B4%A0%E4%BA%BA/', 'vod_name': '素人',
 'vod_pic': '', 'vod_remarks': '标签', 'vod_tag': 'folder'}

# categoryContent 处理
if tid.startswith('/actor/detail/') or tid.startswith('/s/tag/'):
    html = self._req(self.host + tid)
    if '/s/tag/' in tid:
        return {'list': self._parse_videos(html), ...}   # 标签视频列表
    # 女优：先取名字 → 搜索该演员所有作品 → 过滤含名字 → 返回列表
```

## 常见坑（用户纠正过的）

1. ❌ 把 folder 处理放 detailContent 返回多 vod → 壳只取第一个/直接播放
2. ❌ 用 dir_ 前缀但没加 vod_tag: 'folder' → 壳不识别文件夹
3. ✅ 正确：href 作 id + vod_tag folder + categoryContent 判断路径（missav/404xav 都是这个模式）
4. 女优详情用"搜索"方式（先取 h1 名字 → `/cn/s/page/1/wd/{名字}/`）能拿到全部作品，且要**过滤标题含名字**的结果（防无结果时返回热门填充）
5. **⚠️ href 若已含 `.html` 后缀（如 `/type/actor/5849.html`），categoryContent 里直接 `self.host + tid`，不要再拼 `.html`**（91情报局 2026-08-23 实证：拼了变 `5849.html.html` → 404 → 点开空白）。分页才去后缀：`base = tid[:-5] if tid.endswith('.html') else tid.rstrip('/')`，第 2 页起 `{base}/{pg}.html`。对照 missav：`vod_id = href`，`_get_actress_videos` 里 `url = actress_url` 直接请求，不二次拼接
6. **folder 作品分页 URL 与第 1 页不同**（91情报局 实证）：第 1 页 `/type/actor/5849.html`（无页码段），第 2 页 `/type/actor/5849/2.html`——`pg==1` 用原路径，`pg>1` 去 `.html` 加 `/{pg}.html`
