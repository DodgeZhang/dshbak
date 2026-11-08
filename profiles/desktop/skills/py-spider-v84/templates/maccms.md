# MacCMS / 影视模板模块 v8.4

本模块保留 v5.0 中 CMS 识别、MacCMS v8/v10、采集前的影视 HTML 解析和通用工具核心。最终代码必须按主文件冲突规则修正。

# CMS识别决策树（核心！）

## 第一步：从URL特征判断

| URL特征 | CMS类型 | 下一步 |
|---------|---------|--------|
| `/frim/index` 或 `/search.php?searchtype=5` | MacCMS v8 | 用v8骨架 |
| `/index.php/vod/show` 或 `/index.php/vod/detail` | MacCMS v10 | 用v10骨架 |
| `/api.php/provide/vod` | 采集API | 用API骨架 |
| 页面含`<meta name="generator" content="苹果CMS">` | MacCMS | 检查版本 |
| 页面含`wp-content` | WordPress | 自定义爬取 |
| 页面含`/templets/` | 织梦CMS | 自定义爬取 |
| 页面含`/forum.php` 或 `discuz` | Discuz! | 论坛爬取 |
| 页面含`/admin/typecho` | Typecho | 博客爬取 |
| 页面含`/node_modules/hexo` | Hexo | 静态博客爬取 |
| 页面含`/components/com_content` | Joomla | 内容管理系统爬取 |
| 页面含`/core/modules/node` | Drupal | 内容管理框架爬取 |
| 无明显CMS特征 | 自定义站 | 深度HTML分析 |

## 第二步：从HTML结构判断

```
检查顺序：
1. 分类导航 → 提取type_id和type_name
2. 视频列表区域 → 确定列表选择器（3级兜底）
3. 详情页结构 → 确定信息+播放源选择器
4. 播放页JS → 确定m3u8提取正则
5. 筛选区域 → 提取地区/年份/排序选项
```

## 第三步：加密/特殊架构识别

| 特征 | 类型 | 处理方式 |
|------|------|----------|
| JS中含`CryptoJS.AES.decrypt` | AES加密 | 提取key/iv，Python复现解密 |
| JS中含`XOR`或位运算解密 | XOR加密 | 提取key，Python复现 |
| JS中含`RSA.encrypt`或`JSEncrypt` | RSA签名 | Python rsa库复现签名链 |
| 页面使用iframe加载播放器 | iframe嵌套 | 二次请求iframe src |
| API需要sign签名参数 | API签名 | 抓包分析签名算法 |
| 图片src为加密data属性 | 图片加密 | 翻页请求原图URL |
| 异步加载(aiohttp/asyncio) | 异步站 | 可选同步改写 |
| 本地SQLite存储 | 离线缓存 | 非爬虫必要，跳过 |

---

# MacCMS v8 骨架（占影视站40%+）

## 关键特征

```
分类URL: /search.php?searchtype=5&tid={分类ID}&page={页码}&area={地区}&year={年份}&order={排序}
详情URL: /movie/index{ID}.html
播放URL: /play/{ID}-{播放源序号}-{集数序号}.html
搜索: POST /search.php searchword={关键词}
播放JS: var now="m3u8_url"
排序: time(最新) / hit(最热) / score(评分)
```

## 完整T4代码骨架

```python
#!/usr/bin/python
import json
import re
from urllib.parse import urljoin, urlparse
import requests
from lxml import etree
from base.spider import Spider

class Spider(Spider):
    def getName(self): return "站点名"
    def init(self, extend=""):
        self.name = "站点名"
        self.host = "https://example.com"
        self.headers = {"User-Agent": "Mozilla/5.0", "Referer": self.host + "/"}
        self.categories = []
        self.session = requests.Session(); self.session.headers.update(self.headers)
    def _get(self, url):
        try:
            r = self.session.get(url, headers=self.headers, timeout=15, verify=False, proxies=self.session.proxies or None); r.encoding = r.apparent_encoding or "utf-8"; return r.text
        except Exception: return ""
    def _fix(self, url): return urljoin(self.host + "/", url or "")
    def _is_media(self, url): return urlparse(url).scheme in ("http", "https") and bool(re.search(r"\.(?:m3u8|mp4)(?:$|[?#])", urlparse(url).path, re.I))
    def _probe_media(self, url):
        if not self._is_media(url): return ""
        try:
            r = self.session.get(url, headers={**self.headers, "Range": "bytes=0-4095"}, timeout=15, verify=False, stream=True, proxies=self.session.proxies or None); data = next(r.iter_content(4096), b""); ctype = r.headers.get("Content-Type", "").lower(); final = r.url
            if not r.ok: return ""
            if re.search(r"\.m3u8(?:$|[?#])", urlparse(final).path, re.I): return final if b"#EXTM3U" in data else ""
            return final if "video/" in ctype or data[4:12].find(b"ftyp") >= 0 else ""
        except Exception: return ""
    def _resolve_media(self, url, depth=0):
        url = self._fix(url)
        if self._is_media(url): return self._probe_media(url)
        if depth > 3: return ""
        body = self._get(url)
        m = re.search(r'player_data\s*=\s*(\{.*?\})', body, re.S)
        if m:
            try:
                value = json.loads(m.group(1)).get("url", "")
                if value: return self._resolve_media(urljoin(url, value), depth + 1)
            except Exception: pass
        m = re.search(r'(?:var\s+now|var\s+playurl)\s*=\s*["\']([^"\']+)', body)
        if m: return self._resolve_media(urljoin(url, m.group(1).replace("&amp;", "&")), depth + 1)
        frame = re.search(r'<iframe[^>]+src=["\']([^"\']+)', body, re.I)
        if frame: return self._resolve_media(urljoin(url, frame.group(1)), depth + 1)
        scopes = re.findall(r'<(?:script|video|source)[^>]*>.*?</(?:script|video|source)>|<(?:video|source)[^>]*>', body, re.I | re.S)
        haystack = "\n".join(scopes) if scopes else body
        candidates = re.findall(r'https?://[^"\'<>\s]+\.(?:m3u8|mp4)[^"\'<>\s]*', haystack, re.I)
        bad = re.compile(r'(?:^|[/_.-])(ad|ads|advert|preview|trailer|recommend|demo|sample)(?:[/_.-]|$)', re.I)
        candidates = list(dict.fromkeys(x.replace("&amp;", "&") for x in candidates if not bad.search(urlparse(x).path)))
        tokens = re.findall(r'[A-Za-z0-9]{4,}', urlparse(url).path + "?" + urlparse(url).query)
        current_ids = [x for x in tokens if any(c.isdigit() for c in x) and x.lower() not in ("html", "m3u8", "index")]
        candidates.sort(key=lambda x: (not any(i in x for i in current_ids), len(x)))
        return self._resolve_media(candidates[0], depth + 1) if candidates else url
    def _text(self, node): return " ".join("".join(node.xpath(".//text()")).split()) if node is not None else ""
    def _pagecount(self, html, pg):
        tree = etree.HTML(html or ""); nums = []
        nodes = tree.xpath('//*[contains(@class,"page") or contains(@class,"pagination") or contains(@class,"pager")]//a')
        for a in nodes:
            href = a.get("href", ""); text = "".join(a.xpath(".//text()")).strip()
            m = re.search(r"(?:[?&]page=|/page/)(\d+)", href, re.I)
            if m: nums.append(int(m.group(1)))
            elif text.isdigit(): nums.append(int(text))
        nxt = tree.xpath('//a[@rel="next" or contains(@class,"next") or contains(normalize-space(.),"下一页")]')
        return max(nums + [pg + 1 if nxt else pg])
    def _list(self, html):
        tree = etree.HTML(html or ""); out = []; seen = set()
        items = tree.xpath('//a[contains(@class,"videopic")]') or tree.xpath('//div[contains(@class,"item")]//a[.//img]') or tree.xpath('//a[contains(@href,"/movie/") and .//img]')
        for a in items:
            try:
                href = self._fix(a.get("href")); m = re.search(r"(?:index|detail)?(\d+)\.html", href)
                if not m or m.group(1) in seen: continue
                seen.add(m.group(1)); img = a.xpath('.//img')[0] if a.xpath('.//img') else None
                pic = self._fix((img.get("data-original") or img.get("data-src") or img.get("src")) if img is not None else "")
                name = a.get("title") or (img.get("alt") if img is not None else "") or self._text(a)
                out.append({"vod_id": m.group(1), "vod_name": name, "vod_pic": pic})
            except Exception: continue
        return out
    def homeContent(self, filter): return {"class": self.categories, "list": self._list(self._get(self.host)), "filters": {}}
    def homeVideoContent(self): return {"list": self._list(self._get(self.host))}
    def categoryContent(self, tid, pg, filter, extend):
        pg = int(pg) if str(pg).isdigit() else 1; html = self._get(f"{self.host}/search.php?searchtype=5&tid={tid}&page={pg}"); items = self._list(html); limit = len(items) or 20; pagecount = self._pagecount(html, pg)
        return {"page": pg, "pagecount": pagecount, "limit": limit, "total": 0, "list": items}
    def detailContent(self, ids):
        out = []
        for vid in ids:
            try:
                tree = etree.HTML(self._get(f"{self.host}/movie/index{vid}.html")); name = self._text(tree.xpath("//h1 | //h2")[0]) if tree.xpath("//h1 | //h2") else str(vid)
                pic = self._fix((tree.xpath('//div[contains(@class,"pic")]//img/@src') or tree.xpath('//img/@data-original') or [""])[0])
                fs = []; us = []
                for panel in tree.xpath('//div[contains(@class,"panel")]') or tree.xpath('//div[contains(@class,"playlist")]'):
                    opt = panel.xpath('.//a[contains(@class,"option")]'); source = (opt[0].get("title") or self._text(opt[0])) if opt else f"线路{len(fs)+1}"
                    eps = panel.xpath('.//ul[contains(@class,"playlistlink")]//a') or panel.xpath('.//ul//a[contains(@href,"/play/")]')
                    links = [self._text(a) + "$" + self._fix(a.get("href")) for a in eps if a.get("href")]
                    if links: fs.append(source); us.append("#".join(links))
                out.append({"vod_id": str(vid), "vod_name": name, "vod_pic": pic, "vod_play_from": "$$$".join(fs), "vod_play_url": "$$$".join(us)})
            except Exception: continue
        return {"list": out}
    def searchContent(self, key, quick, pg="1"):
        try: r = self.session.post(self.host + "/search.php", data={"searchword": key}, headers=self.headers, timeout=15, verify=False, proxies=self.session.proxies or None); r.encoding = r.apparent_encoding or "utf-8"; return {"list": self._list(r.text), "page": int(pg)}
        except Exception: return {"list": [], "page": int(pg)}
    def playerContent(self, flag, id, vipFlags):
        url = self._resolve_media(id)
        return {"parse": 0 if self._is_media(url) else 1, "url": url, "header": json.dumps(self.headers)}
```

## 客户端模式骨架

```python
#!/usr/bin/python
# -*- coding: utf-8 -*-
import json
import re
from urllib.parse import quote, urljoin, urlparse
import requests
from lxml import etree
from base.spider import Spider

class Spider(Spider):
    def getName(self): return "客户端站点"
    def init(self, extend=""):
        self.name = "客户端站点"; self.host = "https://example.com"; self.headers = {"User-Agent": "Mozilla/5.0", "Referer": self.host + "/"}; self.session = requests.Session(); self.session.headers.update(self.headers)
    def _get(self, url):
        try:
            r = self.session.get(url, headers=self.headers, timeout=15, verify=False, proxies=self.session.proxies or None); r.encoding = r.apparent_encoding or "utf-8"; return r.text
        except Exception: return ""
    def _fix(self, url): return urljoin(self.host + "/", url or "")
    def _text(self, node): return " ".join("".join(node.xpath(".//text()")).split()) if node is not None else ""
    def _items(self, html):
        tree = etree.HTML(html or ""); out = []; seen = set(); nodes = tree.xpath('//a[contains(@class,"videopic")]') or tree.xpath('//div[contains(@class,"item")]//a[.//img]') or tree.xpath('//a[.//img and (@href)]')
        for node in nodes:
            try:
                href = self._fix(node.get("href")); key = href; img = node.xpath('.//img')[0] if node.xpath('.//img') else None; name = node.get("title") or (img.get("alt") if img is not None else "") or self._text(node); pic = self._fix((img.get("data-original") or img.get("data-src") or img.get("src")) if img is not None else "")
                if not href or key in seen: continue
                seen.add(key); out.append({"vod_id": href, "vod_name": name, "vod_pic": pic})
            except Exception: continue
        return out
    def homeContent(self, filter): return {"class": [], "list": self._items(self._get(self.host)), "filters": {}}
    def homeVideoContent(self): return {"list": self._items(self._get(self.host))}
    def categoryContent(self, tid, pg, filter, extend):
        page = int(pg) if str(pg).isdigit() else 1; html = self._get(self._fix(str(tid) + ("/page/" + str(page) if page > 1 else ""))); items = self._items(html); return {"page": page, "pagecount": page, "limit": len(items), "total": 0, "list": items}
    def detailContent(self, ids):
        out = []
        for vid in ids if isinstance(ids, list) else [ids]:
            try:
                url = self._fix(vid); tree = etree.HTML(self._get(url)); title = self._text(tree.xpath("//h1 | //h2")[0]) if tree is not None and tree.xpath("//h1 | //h2") else str(vid); pic = self._fix((tree.xpath('//img/@data-original') or tree.xpath('//img/@src') or [""])[0]) if tree is not None else ""; eps = tree.xpath('//a[contains(@href,".m3u8") or contains(@href,".mp4")]') if tree is not None else []; urls = [self._text(x) + "$" + self._fix(x.get("href")) for x in eps if x.get("href")]; out.append({"vod_id": str(vid), "vod_name": title, "vod_pic": pic, "vod_play_from": "默认线路" if urls else "", "vod_play_url": "#".join(urls)})
            except Exception: continue
        return {"list": out}
    def searchContent(self, key, quick, pg="1"):
        page = int(pg) if str(pg).isdigit() else 1; items = self._items(self._get(self.host + "/search.php?wd=" + quote(str(key)) + "&page=" + str(page))); return {"page": page, "pagecount": page, "limit": len(items), "total": 0, "list": items}
    def playerContent(self, flag, id, vipFlags):
        url = self._fix(id); return {"parse": 1, "url": url, "header": json.dumps(self.headers)}
```

---

# MacCMS v10 骨架（占影视站30%+）

## 关键差异

```
分类URL: /index.php/vod/show/id/{分类ID}/page/{页码}/area/{地区}/year/{年份}/by/{排序}
详情URL: /index.php/vod/detail/id/{ID}.html
播放URL: /index.php/vod/play/id/{ID}/sid/{播放源序号}/nid/{集数序号}.html
搜索: GET /index.php/vod/search.html?wd={关键词}
播放JS: player_data={"url":"m3u8_url"} 或 url:"m3u8_url"
排序: time(最新) / hits(最热) / score(评分)
```

## MacCMS v10 完整代码骨架

```python
#!/usr/bin/python
import json
import re
from urllib.parse import urljoin, urlparse
import requests
from lxml import etree
from base.spider import Spider

class Spider(Spider):
    def getName(self): return "站点名"
    def init(self, extend=""):
        self.name = "站点名"
        self.host = "https://example.com"
        self.headers = {"User-Agent": "Mozilla/5.0", "Referer": self.host + "/"}
        self.categories = []
        self.session = requests.Session(); self.session.headers.update(self.headers)
    def _get(self, url):
        try:
            r = self.session.get(url, headers=self.headers, timeout=15, verify=False, proxies=self.session.proxies or None); r.encoding = r.apparent_encoding or "utf-8"; return r.text
        except Exception: return ""
    def _fix(self, url): return urljoin(self.host + "/", url or "")
    def _is_media(self, url): return urlparse(url).scheme in ("http", "https") and bool(re.search(r"\.(?:m3u8|mp4)(?:$|[?#])", urlparse(url).path, re.I))
    def _probe_media(self, url):
        if not self._is_media(url): return ""
        try:
            r = self.session.get(url, headers={**self.headers, "Range": "bytes=0-4095"}, timeout=15, verify=False, stream=True, proxies=self.session.proxies or None); data = next(r.iter_content(4096), b""); ctype = r.headers.get("Content-Type", "").lower(); final = r.url
            if not r.ok: return ""
            if re.search(r"\.m3u8(?:$|[?#])", urlparse(final).path, re.I): return final if b"#EXTM3U" in data else ""
            return final if "video/" in ctype or data[4:12].find(b"ftyp") >= 0 else ""
        except Exception: return ""
    def _resolve_media(self, url, depth=0):
        url = self._fix(url)
        if self._is_media(url): return self._probe_media(url)
        if depth > 3: return ""
        body = self._get(url)
        m = re.search(r'player_data\s*=\s*(\{.*?\})', body, re.S)
        if m:
            try:
                value = json.loads(m.group(1)).get("url", "")
                if value: return self._resolve_media(urljoin(url, value), depth + 1)
            except Exception: pass
        m = re.search(r'(?:var\s+now|var\s+playurl)\s*=\s*["\']([^"\']+)', body)
        if m: return self._resolve_media(urljoin(url, m.group(1).replace("&amp;", "&")), depth + 1)
        frame = re.search(r'<iframe[^>]+src=["\']([^"\']+)', body, re.I)
        if frame: return self._resolve_media(urljoin(url, frame.group(1)), depth + 1)
        scopes = re.findall(r'<(?:script|video|source)[^>]*>.*?</(?:script|video|source)>|<(?:video|source)[^>]*>', body, re.I | re.S)
        haystack = "\n".join(scopes) if scopes else body
        candidates = re.findall(r'https?://[^"\'<>\s]+\.(?:m3u8|mp4)[^"\'<>\s]*', haystack, re.I)
        bad = re.compile(r'(?:^|[/_.-])(ad|ads|advert|preview|trailer|recommend|demo|sample)(?:[/_.-]|$)', re.I)
        candidates = list(dict.fromkeys(x.replace("&amp;", "&") for x in candidates if not bad.search(urlparse(x).path)))
        tokens = re.findall(r'[A-Za-z0-9]{4,}', urlparse(url).path + "?" + urlparse(url).query)
        current_ids = [x for x in tokens if any(c.isdigit() for c in x) and x.lower() not in ("html", "m3u8", "index")]
        candidates.sort(key=lambda x: (not any(i in x for i in current_ids), len(x)))
        return self._resolve_media(candidates[0], depth + 1) if candidates else url
    def _text(self, node): return " ".join("".join(node.xpath(".//text()")).split()) if node is not None else ""
    def _pagecount(self, html, pg):
        tree = etree.HTML(html or ""); nums = []
        nodes = tree.xpath('//*[contains(@class,"page") or contains(@class,"pagination") or contains(@class,"pager")]//a')
        for a in nodes:
            href = a.get("href", ""); text = "".join(a.xpath(".//text()")).strip()
            m = re.search(r"(?:[?&]page=|/page/)(\d+)", href, re.I)
            if m: nums.append(int(m.group(1)))
            elif text.isdigit(): nums.append(int(text))
        nxt = tree.xpath('//a[@rel="next" or contains(@class,"next") or contains(normalize-space(.),"下一页")]')
        return max(nums + [pg + 1 if nxt else pg])
    def _list(self, html):
        tree = etree.HTML(html or ""); out = []; seen = set()
        items = tree.xpath('//a[contains(@class,"videopic")]') or tree.xpath('//div[contains(@class,"item")]//a[.//img]') or tree.xpath('//a[contains(@href,"/movie/") and .//img]')
        for a in items:
            try:
                href = self._fix(a.get("href")); m = re.search(r"(?:index|detail)?(\d+)\.html", href)
                if not m or m.group(1) in seen: continue
                seen.add(m.group(1)); img = a.xpath('.//img')[0] if a.xpath('.//img') else None
                pic = self._fix((img.get("data-original") or img.get("data-src") or img.get("src")) if img is not None else "")
                name = a.get("title") or (img.get("alt") if img is not None else "") or self._text(a)
                out.append({"vod_id": m.group(1), "vod_name": name, "vod_pic": pic})
            except Exception: continue
        return out
    def homeContent(self, filter): return {"class": self.categories, "list": self._list(self._get(self.host)), "filters": {}}
    def homeVideoContent(self): return {"list": self._list(self._get(self.host))}
    def categoryContent(self, tid, pg, filter, extend):
        pg = int(pg) if str(pg).isdigit() else 1; html = self._get(f"{self.host}/index.php/vod/show/id/{tid}/page/{pg}"); items = self._list(html); limit = len(items) or 20; pagecount = self._pagecount(html, pg)
        return {"page": pg, "pagecount": pagecount, "limit": limit, "total": 0, "list": items}
    def detailContent(self, ids):
        out = []
        for vid in ids:
            try:
                tree = etree.HTML(self._get(f"{self.host}/index.php/vod/detail/id/{vid}.html")); name = self._text(tree.xpath("//h1 | //h2")[0]) if tree.xpath("//h1 | //h2") else str(vid)
                pic = self._fix((tree.xpath('//div[contains(@class,"pic")]//img/@src') or tree.xpath('//img/@data-original') or [""])[0])
                fs = []; us = []
                for panel in tree.xpath('//div[contains(@class,"panel")]') or tree.xpath('//div[contains(@class,"playlist")]'):
                    opt = panel.xpath('.//a[contains(@class,"option")]'); source = (opt[0].get("title") or self._text(opt[0])) if opt else f"线路{len(fs)+1}"
                    eps = panel.xpath('.//ul[contains(@class,"playlistlink")]//a') or panel.xpath('.//ul//a[contains(@href,"/index.php/vod/play/")]')
                    links = [self._text(a) + "$" + self._fix(a.get("href")) for a in eps if a.get("href")]
                    if links: fs.append(source); us.append("#".join(links))
                out.append({"vod_id": str(vid), "vod_name": name, "vod_pic": pic, "vod_play_from": "$$$".join(fs), "vod_play_url": "$$$".join(us)})
            except Exception: continue
        return {"list": out}
    def searchContent(self, key, quick, pg="1"):
        try: r = self.session.get(self.host + "/index.php/vod/search.html", params={"wd": key, "page": pg}, headers=self.headers, timeout=15, verify=False, proxies=self.session.proxies or None); r.encoding = r.apparent_encoding or "utf-8"; return {"list": self._list(r.text), "page": int(pg)}
        except Exception: return {"list": [], "page": int(pg)}
    def playerContent(self, flag, id, vipFlags):
        url = self._resolve_media(id)
        return {"parse": 0 if self._is_media(url) else 1, "url": url, "header": json.dumps(self.headers)}
```

---

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
    def _is_media(self, url): return urlparse(url).scheme in ("http", "https") and bool(re.search(r"\.(?:m3u8|mp4)(?:$|[?#])", urlparse(url).path, re.I))
    def _probe_media(self, url):
        if not self._is_media(url): return ""
        try:
            r = self.session.get(url, headers={**self.headers, "Range": "bytes=0-4095"}, timeout=15, verify=False, stream=True, proxies=self.session.proxies or None); data = next(r.iter_content(4096), b""); ctype = r.headers.get("Content-Type", "").lower(); final = r.url
            if not r.ok: return ""
            if re.search(r"\.m3u8(?:$|[?#])", urlparse(final).path, re.I): return final if b"#EXTM3U" in data else ""
            return final if "video/" in ctype or data[4:12].find(b"ftyp") >= 0 else ""
        except Exception: return ""
    def _resolve_media(self, url, depth=0):
        url = self._fix(url)
        if self._is_media(url): return self._probe_media(url)
        if depth > 3: return ""
        body = self._html(url)
        m = re.search(r'player_data\s*=\s*(\{.*?\})', body, re.S)
        if m:
            try:
                value = json.loads(m.group(1)).get("url", "")
                if value: return self._resolve_media(urljoin(url, value), depth + 1)
            except Exception: pass
        m = re.search(r'(?:var\s+now|var\s+playurl)\s*=\s*["\']([^"\']+)', body)
        if m: return self._resolve_media(urljoin(url, m.group(1).replace("&amp;", "&")), depth + 1)
        frame = re.search(r'<iframe[^>]+src=["\']([^"\']+)', body, re.I)
        if frame: return self._resolve_media(urljoin(url, frame.group(1)), depth + 1)
        scopes = re.findall(r'<(?:script|video|source)[^>]*>.*?</(?:script|video|source)>|<(?:video|source)[^>]*>', body, re.I | re.S)
        haystack = "\n".join(scopes) if scopes else body
        candidates = re.findall(r'https?://[^"\'<>\s]+\.(?:m3u8|mp4)[^"\'<>\s]*', haystack, re.I)
        bad = re.compile(r'(?:^|[/_.-])(ad|ads|advert|preview|trailer|recommend|demo|sample)(?:[/_.-]|$)', re.I)
        candidates = list(dict.fromkeys(x.replace("&amp;", "&") for x in candidates if not bad.search(urlparse(x).path)))
        tokens = re.findall(r'[A-Za-z0-9]{4,}', urlparse(url).path + "?" + urlparse(url).query)
        current_ids = [x for x in tokens if any(c.isdigit() for c in x) and x.lower() not in ("html", "m3u8", "index")]
        candidates.sort(key=lambda x: (not any(i in x for i in current_ids), len(x)))
        return self._resolve_media(candidates[0], depth + 1) if candidates else url
    def _item(self, v): return {"vod_id": str(v.get("vod_id", "")), "vod_name": v.get("vod_name", ""), "vod_pic": self._fix(v.get("vod_pic", ""))}
    def homeContent(self, filter):
        d = self._json(self.api, {"ac": "list"}); return {"class": d.get("class", []), "list": [], "filters": {}}
    def homeVideoContent(self):
        d = self._json(self.api, {"ac": "detail", "pg": 1}); items = d.get("list", [])
        return {"list": [self._item(v) for v in items]}
    def categoryContent(self, tid, pg, filter, extend):
        pg = int(pg) if str(pg).isdigit() else 1; d = self._json(self.api, {"ac": "detail", "t": tid, "pg": pg})
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
<!-- 演进: 2026-08-28 | 来源: 耐看点播 MacCMS 播放线路修复 | 类型: pattern -->
## 线路四层模型（v8.3）

MacCMS 播放线路必须区分四层：内部 `sid`、播放器 `from`、显示 `show`、最终媒体 URL。

- `sid` 只用于剧集分组，不代表展示顺序；线路可按 `6,2,1,4,5,3` 出现，禁止数值排序或用 `sid-1` 索引 tab。
- 线路顺序以每个 sid 在详情页的首次出现顺序为准；用有序列表记录首次出现，用字典聚合剧集。
- `选择播放源/播放线路/展开/收起/立即播放` 是 UI 文本，不得进入 `vod_play_from`。
- `player_aaaa.link` 可能指默认线路，不能代表当前线路；当前项优先看当前 URL、`sid`、`nid`、`from`、`link_next`。
- 名称优先级：`playerconfig.js player_list[from].show` → `player_aaaa.from` → 当前 tab → `线路{sid}`。
- `encrypt=0` 只表示 MacCMS 外层未做标准编码，不代表 `player_aaaa.url` 已是直链。

```python
groups, order, seen = {}, [], set()
for href, title in episodes:
    if not title or title in ("立即播放", "选择播放源"): continue
    sid = extract_sid(href)
    if sid not in groups: groups[sid] = []; order.append(sid)
    item = f"{title}${fix_url(href)}"
    if item not in seen: groups[sid].append(item); seen.add(item)
```