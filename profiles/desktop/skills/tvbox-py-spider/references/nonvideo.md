# 非影视内容模板模块 v8.4

包含小说、图片、漫画、音乐、直播、短剧及小说/漫画客户端协议。所有模板必须结合真实站点选择器/API路径生成。

## 图片与时间字段通用规则

- 页面使用自定义图片指令时，优先提取 `z-image-loader-url` 或 `x-image-loader-url`，不要把 loading 图、头像、广告图或普通 `src` 当作封面。
- 图片 URL 非空不代表可显示；需要抽样检查 HTTP、响应长度、Content-Type 和 JPEG/PNG/GIF/WebP 魔数。
- 如果站点同时提供移动端相对时间和桌面端日期，优先使用 `刚刚`、`几分钟前`、`几小时前`、`几天前`、`几周前`、`几个月前`、`几年前`，绝对日期仅作为回退。
- 时间角标统一写入 `vod_remarks`，角标位置由客户端决定。


# 小说与漫画客户端调用协议（强制）

## 小说模式

软件小说阅读模式不能使用普通 `text://正文` 代替。详情和播放必须同时满足：

```python
vod.update({
    "vod_play_from":"小说阅读",
    "vod_play_url":"#".join(f"{title}${play_id}" for title,play_id in chapters),
    "vod_player":"novel"
})
```

`playerContent` 返回：

```python
return {"parse":0,"url":"novel://"+json.dumps({"title":chapter_title,"content":content},ensure_ascii=False),"header":""}
```

规则：

- `novel://` 后必须是合法 JSON 对象，至少包含 `title` 和 `content`。
- 章节播放 ID 必须能还原章节标题；可将标题 URL 编码后附加到 ID。
- 正文保留自然段换行，清理脚本、导航、上一章/下一章等噪声。
- 详情必须设置 `vod_player: "novel"`，否则客户端可能按视频播放器打开。

## 漫画模式

详情必须声明漫画查看器：

```python
vod.update({
    "vod_play_from":"漫画浏览",
    "vod_play_url":"#".join(f"{title}${play_id}" for title,play_id in chapters),
    "vod_player":"pics"
})
```

`playerContent` 返回：

```python
return {"parse":0,"url":"pics://"+"&&".join(image_urls),"header":""}
```

规则：

- `pics://` 后的图片使用 `&&` 分隔并保持章节页序。
- 图片需要 Referer、签名、解密或特殊 MIME 时，必须先转换为本地代理 URL。
- 详情必须设置 `vod_player: "pics"`。
- 不依赖 `playUrl: "type=manga"` 触发漫画模式；可兼容保留，但 `vod_player + pics://` 是标准调用。
- 封面与正文图都要识别真实魔数：JPEG、PNG、GIF、WebP；扩展名和响应 Content-Type 不可信。

---

---
# 小说类模板

**关键差异**：detailContent返回章节列表，playerContent返回正文

```python
    def detailContent(self, ids):
        result = {"list": []}
        for vid in ids:
            try:
                html = self._get(f"{self.host}/book/{vid}.html")
                if not html: continue
                tree = etree.HTML(html)
                name = "".join(tree.xpath('//h1/text()')).strip()
                chapters = [(a.text.strip(), self._fix(a.get("href",""))) for a in tree.xpath('//div[contains(@class,"chapter")]//a')]
                result["list"].append({"vod_id": vid, "vod_name": name, "vod_pic": "", "vod_play_from": "小说阅读", "vod_play_url": "#".join(f"{t}${u}" for t, u in chapters), "vod_player": "novel"})
            except Exception: continue
        return result
    def playerContent(self, flag, id, vipFlags):
        html = self._get(id)
        if not html: return {"parse": 0, "url": "", "header": ""}
        tree = etree.HTML(html)
        title = "".join(tree.xpath('//h1/text() | //title/text()')).strip() or "正文"
        content = "\n\n".join(x.strip() for x in tree.xpath('//div[contains(@class,"content")]//text()') if x.strip())
        return {"parse": 0, "url": "novel://" + json.dumps({"title": title, "content": content}, ensure_ascii=False), "header": ""}
```

---

# 图片类模板

**关键差异**：playerContent返回pics://协议

```python
    def detailContent(self, ids):
        result = {"list": []}
        for vid in ids:
            try:
                html = self._get(f"{self.host}/album/{vid}.html")
                if not html: continue
                tree = etree.HTML(html)
                name = "".join(tree.xpath('//h1/text()')).strip()
                pics = [self._fix(a.get("href","")) for a in tree.xpath('//div[contains(@class,"gallery")]//a') if a.get("href")]
                result["list"].append({"vod_id": vid, "vod_name": name, "vod_pic": pics[0] if pics else "", "vod_play_from": "图集", "vod_play_url": "#".join(f"图{i+1}${u}" for i, u in enumerate(pics))})
            except Exception: continue
        return result
    def playerContent(self, flag, id, vipFlags):
        html = self._get(id)
        if not html: return {"parse": 0, "url": "", "header": json.dumps(self.headers)}
        tree = etree.HTML(html)
        imgs = [self._fix(i.get("data-src") or i.get("data-original") or i.get("src","")) for i in tree.xpath('//div[contains(@class,"content")]//img')]
        imgs = [u for u in imgs if u]
        return {"parse": 0, "url": f'pics://{"&&".join(imgs)}', "header": json.dumps(self.headers)}
```

---

# 漫画类模板
详情用`vod_player: pics`声明漫画查看器，playerContent按章节返回`pics://`图片序列

```python
    def detailContent(self, ids):
        result = {"list": []}
        for vid in ids:
            try:
                html = self._get(f"{self.host}/comic/{vid}.html")
                if not html: continue
                tree = etree.HTML(html)
                name = "".join(tree.xpath('//h1/text()')).strip()
                chapters = [(a.text.strip(), self._fix(a.get("href",""))) for a in tree.xpath('//div[contains(@class,"chapter")]//a')]
                result["list"].append({"vod_id": vid, "vod_name": name, "vod_pic": "", "vod_play_from": "漫画浏览", "vod_play_url": "#".join(f"{t}${u}" for t, u in chapters), "vod_player": "pics"})
            except Exception: continue
        return result
    def playerContent(self, flag, id, vipFlags):
        html = self._get(id)
        if not html: return {"parse": 0, "url": "", "header": json.dumps(self.headers)}
        tree = etree.HTML(html)
        imgs = [self._fix(i.get("data-src") or i.get("data-original") or i.get("src","")) for i in tree.xpath('//div[contains(@class,"comic")]//img')]
        imgs = [u for u in imgs if u]
        return {"parse": 0, "url": f'pics://{"&&".join(imgs)}', "header": ""}
```

---

# 音乐类模板

```python
    def detailContent(self, ids):
        result = {"list": []}
        for vid in ids:
            try:
                html = self._get(f"{self.host}/song/{vid}.html")
                if not html: continue
                tree = etree.HTML(html)
                name = "".join(tree.xpath('//h1/text()')).strip()
                audio = tree.xpath('//audio/source') or tree.xpath('//audio')
                url = self._fix(audio[0].get("src","")) if audio else ""
                if not url:
                    m = re.search(r'(https?://[^\s"\']+\.mp3[^\s"\']*)', html)
                    url = m.group(1) if m else ""
                result["list"].append({"vod_id": vid, "vod_name": name, "vod_pic": "", "vod_play_from": "播放", "vod_play_url": f"播放${url}"})
            except Exception: continue
        return result
    def playerContent(self, flag, id, vipFlags): return {"parse": 0, "url": self._fix(id), "header": json.dumps(self.headers)}
```

---

# 直播类模板

```python
    def homeContent(self, filter):
        html = self._get(self.host)
        if not html: return {"class": [], "list": [], "filters": {}}
        tree = etree.HTML(html)
        cats = [{"type_id": self._fix(a.get("href","")), "type_name": a.text.strip()} for a in tree.xpath('//div[contains(@class,"nav")]//a') if a.get("href")]
        return {"class": cats, "list": [], "filters": {}}
    def categoryContent(self, tid, pg, filter, extend):
        html = self._get(self._fix(tid))
        if not html: return {"page": 1, "pagecount": 1, "list": [], "count": 0}
        tree = etree.HTML(html)
        items = []
        for a in tree.xpath('//a[contains(@href,".m3u8")]'):
            name = a.text.strip()
            if not name: continue
            items.append({"vod_id": self._fix(a.get("href","")), "vod_name": name, "vod_pic": ""})
        return {"page": 1, "pagecount": 1, "list": items, "count": len(items)}
    def detailContent(self, ids): return {"list": [{"vod_id": ids[0], "vod_name": "直播", "vod_play_from": "直播", "vod_play_url": f"直播${ids[0]}"}]}
    def playerContent(self, flag, id, vipFlags): return {"parse": 0, "url": self._fix(id), "header": json.dumps(self.headers)}
```

---

# 短剧类模板

与影视模板完全一致，仅分类/URL路径不同，无需额外模板

---