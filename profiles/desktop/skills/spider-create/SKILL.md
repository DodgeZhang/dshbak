---
name: spider-create
description: 全类型Spider开发Skill v3.0，基于211个实战爬虫源的分析成果+在线之家源码深度分析优化。用户提到"写个爬虫""写个源""Python源""影视源""小说源""图片源""漫画源""音乐源""直播源""短剧源""T4源""TVBox源""把这个网站写成Spider""帮我写个源"时使用。覆盖站点分析→选择器提取→Spider类代码生成→五接口验证全流程。配套 MCP 工具（本环境 mcp_PY_MCP_S）：analyze_website/one_click_spider/debug_selector/debug_play_link/test_interface/evaluate_source；MCP 服务器源码在同目录 py-spider-pro/，电脑端安装见 电脑端使用指南.txt。
---

# Spider开发Skill v3.0 校验与修正版

## 核心理念：分析驱动，一次写成功

**禁止不分析直接套模板！** 每个网站写源前必须完成以下分析流程：

```
1. py_mcp:analyze_website(url) → 获取CMS类型+HTML结构
2. 根据分析结果选择对应的骨架代码
3. 用分析返回的真实选择器填充骨架
4. py_mcp:debug_selector验证关键选择器
5. py_mcp:test_interface测试五大接口
6. py_mcp:evaluate_source检查v2.0规范
```

## 内容类型自动判定

| URL/关键词特征 | type | playerContent输出 |
|---|---|---|
| MacCMS路径、影视/电影/电视剧/动漫/综艺 | video | `{"parse":0,"url":"m3u8","header":{}}` |
| 小说/书/文学/笔趣阁 | novel | `{"parse":0,"url":"text://内容"}` |
| 图片/写真/图/壁纸 | image | `{"parse":0,"url":"pics://u1&&u2"}` |
| 漫画/动漫(图片类)/manga | manga | `{"parse":0,"playUrl":"type=manga","url":"pics://..."}` |
| 音乐/歌/MP3/音频 | music | `{"parse":0,"url":"mp3url","header":{}}` |
| 直播/live/直播源 | live | `{"parse":0,"url":"m3u8","header":{}}` |
| 短剧/微短剧/竖屏 | short | `{"parse":0,"url":"m3u8","header":{}}` |

优先级：用户显式指定 > URL路径特征 > 页面内容特征

## 运行模式

| | T4服务端（影视TV/影视仓） | 客户端（TVBox） |
|---|---|---|
| 类定义 | `class Spider(Spider):` 继承base | `class Spider:` 独立类 |
| 导入 | `from base.spider import Spider` | 无需导入 |
| getName | 必须返回站点名 | 可选 |
| subs/header | 支持 | 不支持 |
| 判断 | "T4/影视TV/影视仓/服务端" | "TVBox/猫影视/jar/客户端" |
| 默认 | 未明确→T4模式 | |

## 代码精简原则（强制）

1. 零注释零docstring
2. 禁止`__main__`测试块
3. 禁止空壳方法（isVideoFormat/manualVideoCheck/proxy不声明）
4. 核心字段：vod_name/vod_pic/vod_play_from/vod_play_url，其他能一行搞定才加
5. 无筛选条件时，`filters`字段必须显式返回空字典，不可省略
6. 单行优先：三元、推导、链式
7. import最小化

## 标准接口

| 方法 | 功能 | 返回 |
|------|------|------|
| `init(self, extend="")` | 初始化 | 无 |
| `homeContent(self, filter)` | 首页+分类+筛选 | `{"class":[],"list":[],"filters":{}}` |
| `categoryContent(self, tid, pg, filter, extend)` | 分类浏览 | `{"page":n,"pagecount":n,"list":[],"count":0}` |
| `detailContent(self, ids)` | 详情+线路/章节 | `{"list":[vod]}` |
| `searchContent(self, key, quick, pg="1")` | 搜索 | `{"list":[]}` |
| `playerContent(self, flag, id, vipFlags)` | 播放/阅读/查看 | `{"parse":0,"url":""}` |

T4额外必须：`getName(self)` 返回string

字段名必须`vod_`前缀。线路：vod_play_from用`$$$`，vod_play_url用`$$$`对应，线路内`#`分隔，格式`集名$播放ID`

---

# parse参数决策树（⭐核心优化！2025-04新增）

**这是开发影视Spider最重要的决策点，90%的播放问题源于parse参数配置错误！**

## parse参数的三种模式

| parse值 | 含义 | 适用场景 |
|---------|------|----------|
| `parse: 0` | url是直链，客户端直接播放 | 已获取到m3u8/mp4等直接可播放的URL |
| `parse: 1` | url是网页地址，客户端调用外部解析器/sniff处理 | 播放页是HTML（如`/vodplay/xxx.html`），需要解析器提取直链 |
| `parse: 2` | 客户端用webview加载url，自动嗅探 | 需要JS执行才能获取直链的特殊情况（仅TVBox/影视仓v2.0+支持） |

## ⭐黄金法则：MacCMS站点必用parse=1

**实战教训**：MacCMS v8/v10站点的播放URL（如`/vodplay/4624-1-1.html`）本身就是网页地址，不是直链。只需设置`parse=1`，TVBox/影视仓会自动将其交给：
- 内置嗅探器（sniff）
- 或用户在客户端配置的外部解析器（如通用解析接口、哔哩解析等）

**不要自己解密！** 外部解析器会处理 encrypt=3、jsjiami.com.v6混淆等加密逻辑。

## playerContent决策流程

```
播放URL → 
├─ 是m3u8/mp4直链？→ parse=0 ✅
├─ 是网页路径（如/play/xxx.html、/vodplay/xxx.html）？→ parse=1 ✅✅
├─ 需要特殊header/cookie？→ parse=1 + header字段
└─ 客户端无法解析 → debug_play_link分析
    ├─ iframe嵌套 → 二次提取直链 → parse=0
    └─ JS加密 → 尝试提取直链 → parse=0（最后手段）
```

## 加密检测后的策略优先级（重要！）

```
检测到encrypt/player_aaaa/xgplayer等加密标识
├─ 第1步：直接返回 parse=1 + 原始URL ← 先试！零成本
├─ 第2步：如客户端无法解析，用debug_play_link分析
├─ 第3步：检查是否有可用的外部解析API
└─ 第4步（最后手段）：逆向JS解密逻辑
```

**原则**：先简后繁，能跑不折腾。parse=1失败率极低，不值得自己写解密代码。

---

# CMS识别决策树（核心！）

## 第一步：从URL特征判断

| URL特征 | CMS类型 | 下一步 |
|---------|---------|--------|
| `/frim/index` 或 `/search.php?searchtype=5` | MacCMS v8 | 用v8骨架 |
| `/index.php/vod/show` 或 `/index.php/vod/detail` | MacCMS v10 | **先验证API** → 可用用API骨架，不可用用页面爬取骨架 |
| `/vodshow/` 或 `/voddetail/` | MacCMS v10非标 | **先验证API** → 必须页面爬取骨架 |
| `/api.php/provide/vod` | 采集API | 用API骨架（但也需验证可用性） |
| 页面含`<meta name="generator" content="苹果CMS">` | MacCMS | 检查版本 + 验证API |
| 页面含`wp-content` | WordPress | 自定义爬取 |
| 页面含`/templets/` | 织梦CMS | 自定义爬取 |
| 无明显CMS特征 | 自定义站 | 深度HTML分析 |

### ⭐ API可用性验证（555电影实战教训，强制！）

```
识别为MacCMS站点
├─ 访问 /api.php/provide/vod/（超时10秒）
│   ├─ 返回有效JSON → API可用 → 采集API骨架
│   └─ 超时/404/空/格式错误 → API不可用 → 页面爬取骨架
│       └─ 必须手动配置：categories + filters + make_page_url
└─ 跳过验证直接用API骨架 = 生成不可运行的代码！
```

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
# -*- coding: utf-8 -*-
import re, json, requests, urllib.parse
from lxml import etree
from base.spider import Spider

class Spider(Spider):
    def getName(self): return "站点名"
    def init(self, extend=""):
        self.host = "https://example.com"
        self.headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Referer": self.host + "/"}
        self.categories = [{"type_id": "1", "type_name": "电影"}, {"type_id": "2", "type_name": "电视剧"}, {"type_id": "3", "type_name": "动漫"}, {"type_id": "4", "type_name": "综艺"}]
    def _get(self, url):
        try: r = requests.get(url, headers=self.headers, timeout=15); r.encoding = r.apparent_encoding or "utf-8"; return r.text
        except: return None
    def _post(self, url, data):
        try: r = requests.post(url, data=data, headers=self.headers, timeout=15); r.encoding = r.apparent_encoding or "utf-8"; return r.text
        except: return None
    def _fix(self, u): return "https:" + u if u and u.startswith("//") else self.host + u if u and u.startswith("/") else u or ""
    def _parse_list(self, html):
        if not html: return []
        tree = etree.HTML(html); results, seen = [], set()
        items = tree.xpath('//a[contains(@class,"videopic")]') or tree.xpath('//div[contains(@class,"item")]//a[contains(@href,"/movie/") and .//img]') or tree.xpath('//a[contains(@href,"/movie/") and .//img]')
        for item in items:
            try:
                href = item.get("href", ""); m = re.search(r"/(\d+)\.html", href)
                if not m or m.group(1) in seen: continue
                seen.add(m.group(1))
                img = item.xpath('.//img')
                pic = ""; title = ""
                if img: pic = self._fix(img[0].get("data-original") or img[0].get("data-src") or img[0].get("src", ""))
                title = item.get("title", "") or "".join(item.xpath('.//img/@alt')).strip() or "".join(item.xpath('.//text()')).strip()
                results.append({"vod_id": m.group(1), "vod_name": title, "vod_pic": pic})
            except: continue
        return results
    def homeContent(self, filter):
        html = self._get(self.host + "/")
        return {"class": self.categories, "list": self._parse_list(html) if html else [], "filters": {}}
    def categoryContent(self, tid, pg, filter, extend):
        url = f"{self.host}/search.php?searchtype=5&tid={tid}&page={pg}"
        return {"page": int(pg), "pagecount": 99, "limit": 36, "total": 999, "list": self._parse_list(self._get(url)) if self._get(url) else []}
    def detailContent(self, ids):
        result = {"list": []}
        for vid in ids:
            try:
                html = self._get(f"{self.host}/movie/index{vid}.html")
                if not html: continue
                tree = etree.HTML(html)
                name = "".join(tree.xpath('//h1/text()')).strip() or "".join(tree.xpath('//h2/text()')).strip()
                pic = self._fix("".join(tree.xpath('//div[contains(@class,"pic")]//img/@src')) or "".join(tree.xpath('//div[contains(@class,"detail")]//img/@src')))
                sources, episodes = [], []
                panels = tree.xpath('//div[contains(@class,"panel")]') or tree.xpath('//div[contains(@class,"playlist")]')
                for p in panels:
                    src = p.xpath('.//a[contains(@class,"option")]')
                    src_name = src[0].get("title", "") or "".join(src[0].xpath('.//text()')).strip() if src else f"线路{len(sources)+1}"
                    eps = p.xpath('.//ul[contains(@class,"playlist")]//a') or p.xpath('.//ul//a[contains(@href,"/play/")]')
                    ep_list = [f'{"".join(a.xpath(".//text()")).strip()}${self._fix(a.get("href", ""))}' for a in eps]
                    if ep_list: sources.append(src_name); episodes.append("#".join(ep_list))
                result["list"].append({"vod_id": vid, "vod_name": name, "vod_pic": pic, "vod_play_from": "$$$".join(sources), "vod_play_url": "$$$".join(episodes)})
            except: continue
        return result
    def searchContent(self, key, quick, pg="1"):
        html = self._post(self.host + "/search.php", {"searchword": key})
        return {"list": self._parse_list(html) if html else [], "page": int(pg)}
    def playerContent(self, flag, id, vipFlags):
        # ⭐核心：MacCMS站点直接返回 parse=1，让客户端解析器处理
        url = id if id.startswith("http") else self._fix(id)
        return {"parse": 1, "url": url, "header": self.headers}
```

## 客户端模式骨架

```python
#!/usr/bin/python
# -*- coding: utf-8 -*-
import re, json
from urllib.parse import quote
try: import requests; from lxml import etree
except: pass
BASE = "https://example.com"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Referer": BASE + "/"}
def _get(url):
    try: r = requests.get(url, headers=UA, timeout=15); r.encoding = r.apparent_encoding or "utf-8"; return r.text
    except: return None
def _fix(u): return "https:" + u if u and u.startswith("//") else BASE + u if u and u.startswith("/") else u or ""

class Spider:
    def init(self, extend=""): self.site_url = BASE; self.headers = UA
    def homeContent(self, filter): return {"class": [], "list": [], "filters": {}}
    def categoryContent(self, tid, pg, filter, extend): return {"page": int(pg), "pagecount": 99, "limit": 36, "count": 0, "list": []}
    def detailContent(self, ids): return {"list": []}
    def searchContent(self, key, quick, pg="1"): return {"list": []}
    # ⭐核心：MacCMS站点用parse=1
    def playerContent(self, flag, id, vipFlags):
        url = id if id.startswith("http") else _fix(id)
        return {"parse": 1, "url": url, "header": self.headers}
```

---

# MacCMS v10 骨架（占影视站30%+）

## 关键差异

```
分类URL(标准): /index.php/vod/show/id/{分类ID}/page/{页码}/area/{地区}/year/{年份}/by/{排序}
分类URL(非标): /vodshow/{分类ID}-----------.html（筛选条件嵌入URL路径）
详情URL(标准): /index.php/vod/detail/id/{ID}.html
详情URL(非标): /voddetail/{ID}.html
播放URL(标准): /index.php/vod/play/id/{ID}/sid/{播放源序号}/nid/{集数序号}.html
播放URL(非标): /vodplay/{ID}-{源序号}-{集序号}.html
搜索(标准):   GET /index.php/vod/search.html?wd={关键词}
搜索(非标):   GET /vodsearch/{quote(关键词)}-------------.html
首页(标准):   /
首页(非标):   /index/home.html
播放JS:       player_data={"url":"m3u8_url"} 或 url:"m3u8_url"
排序:         time(最新) / hits(最热) / score(评分)
```

## ⭐ 两种模式选择（555电影实战教训）

```
MacCMS v10站点
├─ API(/api.php/provide/vod/)可用 → 标准v10骨架（下方"v10差异代码"）
└─ API不可用 → 页面爬取骨架（见spider-create底部"页面爬取模式完整骨架"）
    ├─ 手动配置categories
    ├─ 手动配置filters（value为完整URL路径）
    ├─ 分页URL用make_page_url函数
    ├─ 图片属性data-original > data-src > src
    ├─ 搜索URL /vodsearch/{quote(key)}---...html
    └─ playerContent用parse=1
```

## v10差异代码（仅标注与v8不同处）

```python
    def categoryContent(self, tid, pg, filter, extend):
        url = f"{self.host}/index.php/vod/show/id/{tid}/page/{pg}"
        return {"page": int(pg), "pagecount": 99, "limit": 36, "total": 999, "list": self._parse_list(self._get(url)) if self._get(url) else []}
    def detailContent(self, ids):
        result = {"list": []}
        for vid in ids:
            try:
                html = self._get(f"{self.host}/index.php/vod/detail/id/{vid}.html")
                if not html: continue
                tree = etree.HTML(html)
                name = "".join(tree.xpath('//h1/text()')).strip() or "".join(tree.xpath('//h2/text()')).strip()
                pic = self._fix("".join(tree.xpath('//div[contains(@class,"pic")]//img/@src')) or "".join(tree.xpath('//div[contains(@class,"detail")]//img/@src')))
                sources, episodes = [], []
                panels = tree.xpath('//div[contains(@class,"panel")]') or tree.xpath('//div[contains(@class,"playlist")]')
                for p in panels:
                    src = p.xpath('.//a[contains(@class,"option")]')
                    src_name = src[0].get("title", "") or "".join(src[0].xpath('.//text()')).strip() if src else f"线路{len(sources)+1}"
                    eps = p.xpath('.//ul[contains(@class,"playlist")]//a') or p.xpath('.//ul//a[contains(@href,"/play/")]')
                    ep_list = [f'{"".join(a.xpath(".//text()")).strip()}${self._fix(a.get("href", ""))}' for a in eps]
                    if ep_list: sources.append(src_name); episodes.append("#".join(ep_list))
                if not sources:
                    m = re.search(r'player_data\s*=\s*(\{.*?\})', html)
                    if m:
                        try:
                            pd = json.loads(m.group(1))
                            sources.append("默认"); episodes.append(f'01${pd.get("url","")}')
                        except: pass
                result["list"].append({"vod_id": vid, "vod_name": name, "vod_pic": pic, "vod_play_from": "$$$".join(sources), "vod_play_url": "$$$".join(episodes)})
            except: continue
        return result
    def searchContent(self, key, quick, pg="1"):
        url = f"{self.host}/index.php/vod/search.html?wd={quote(key)}&page={pg}"
        return {"list": self._parse_list(self._get(url)) if self._get(url) else [], "page": int(pg)}
    # ⭐核心：v10同样用parse=1
    def playerContent(self, flag, id, vipFlags):
        url = id if id.startswith("http") else self._fix(id)
        return {"parse": 1, "url": url, "header": self.headers}
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
# -*- coding: utf-8 -*-
import re, json, requests
from base.spider import Spider

class Spider(Spider):
    def getName(self): return "站点名"
    def init(self, extend=""):
        self.host = "https://example.com"
        self.api = self.host + "/api.php/provide/vod/"
        self.headers = {"User-Agent": "Mozilla/5.0", "Referer": self.host + "/"}
    def _get(self, url):
        try: return requests.get(url, headers=self.headers, timeout=15).json()
        except: return {}
    def _fix(self, u): return "https:" + u if u and u.startswith("//") else u or ""
    def homeContent(self, filter):
        data = self._get(self.api + "?ac=list")
        classes = [{"type_id": str(c.get("type_id","")), "type_name": c.get("type_name","")} for c in data.get("class", [])]
        return {"class": classes, "list": [], "filters": {}}
    def categoryContent(self, tid, pg, filter, extend):
        data = self._get(f"{self.api}?ac=list&tid={tid}&pg={pg}")
        items = []
        for v in data.get("list", []):
            items.append({"vod_id": str(v.get("vod_id","")), "vod_name": v.get("vod_name",""), "vod_pic": self._fix(v.get("vod_pic",""))})
        return {"page": int(pg), "pagecount": data.get("pagecount", 1), "limit": data.get("limit", 30), "total": data.get("total", 0), "list": items}
    def detailContent(self, ids):
        data = self._get(f"{self.api}?ac=detail&ids={ids[0]}")
        result = {"list": []}
        for v in data.get("list", []):
            result["list"].append({"vod_id": str(v.get("vod_id","")), "vod_name": v.get("vod_name",""), "vod_pic": self._fix(v.get("vod_pic","")), "vod_play_from": v.get("vod_play_from",""), "vod_play_url": v.get("vod_play_url","")})
        return result
    def searchContent(self, key, quick, pg="1"):
        data = self._get(f"{self.api}?ac=detail&wd={key}&pg={pg}")
        items = [{"vod_id": str(v.get("vod_id","")), "vod_name": v.get("vod_name",""), "vod_pic": self._fix(v.get("vod_pic",""))} for v in data.get("list", [])]
        return {"list": items, "page": int(pg)}
    # ⭐采集API通常是直链，用parse=0；如返回网页URL则用parse=1
    def playerContent(self, flag, id, vipFlags):
        url = self._fix(id)
        if not any(x in url for x in [".m3u8", ".mp4"]):
            html = requests.get(url, headers=self.headers, timeout=15).text
            m = re.search(r'(https?://[^\s"\']+\.m3u8[^\s"\']*)', html)
            url = m.group(1) if m else url
        return {"parse": 0, "url": url, "header": json.dumps(self.headers)}
```

---

# 加密/特殊架构处理模块

## AES-CBC解密（图片/标题加密站通用）

```python
from functools import partial
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
import base64

def _aes_decrypt(self, data, key, iv=b"0000000000000000"):
    try:
        cipher = AES.new(key.encode() if isinstance(key, str) else key, AES.MODE_CBC, iv.encode() if isinstance(iv, str) else iv)
        return unpad(cipher.decrypt(base64.b64decode(data)), AES.block_size).decode("utf-8")
    except: return data
```

## XOR解密（128字节密钥）

```python
def _xor_decrypt(self, data, key):
    k = key.encode() if isinstance(key, str) else key
    return bytes(b ^ k[i % len(k)] for i, b in enumerate(data.encode() if isinstance(data, str) else data)).decode("utf-8", errors="ignore")
```

## RSA签名链（API签名站）

```python
import rsa as rsa_lib

def _rsa_sign(self, data, private_key_pem):
    priv = rsa_lib.PrivateKey.load_pkcs1(private_key_pem.encode())
    return rsa_lib.sign(data.encode(), priv, "SHA-256").hex()
```

## iframe二次解析（加密播放器通用）

```python
def _parse_iframe(self, html):
    m = re.search(r'<iframe[^>]+src=["\']([^"\']+)', html)
    if m:
        iframe_url = self._fix(m.group(1))
        iframe_html = self._get(iframe_url)
        if iframe_html:
            return re.search(r'(https?://[^\s"\']+\.m3u8[^\s"\']*)', iframe_html)
    return None
```

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
                result["list"].append({"vod_id": vid, "vod_name": name, "vod_pic": "", "vod_play_from": "正文", "vod_play_url": "#".join(f"{t}${u}" for t, u in chapters)})
            except: continue
        return result
    def playerContent(self, flag, id, vipFlags):
        html = self._get(id)
        if not html: return {"parse": 0, "url": "", "header": json.dumps(self.headers)}
        tree = etree.HTML(html)
        content = "".join(tree.xpath('//div[contains(@class,"content")]//text()')).strip()
        return {"parse": 0, "url": f"text://{content}", "header": json.dumps(self.headers)}
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
            except: continue
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

同图片但playUrl带type=manga，按章节分图

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
                result["list"].append({"vod_id": vid, "vod_name": name, "vod_pic": "", "vod_play_from": "漫画", "vod_play_url": "#".join(f"{t}${u}" for t, u in chapters)})
            except: continue
        return result
    def playerContent(self, flag, id, vipFlags):
        html = self._get(id)
        if not html: return {"parse": 0, "url": "", "header": json.dumps(self.headers)}
        tree = etree.HTML(html)
        imgs = [self._fix(i.get("data-src") or i.get("data-original") or i.get("src","")) for i in tree.xpath('//div[contains(@class,"comic")]//img')]
        imgs = [u for u in imgs if u]
        return {"parse": 0, "playUrl": "type=manga", "url": f'pics://{"&&".join(imgs)}', "header": json.dumps(self.headers)}
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
            except: continue
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

# 通用工具方法

```python
def _fix(self, u): 
    if not u:
        return ""
    if u.startswith("//"):
        return "https:" + u
    elif u.startswith("/"):
        return self.host + u
    return u

def _get(self, url):
    try: 
        r = requests.get(url, headers=self.headers, timeout=15)
        r.encoding = r.apparent_encoding or "utf-8"
        return r.text
    except: 
        return None

def _extract_m3u8(self, html):
    if not html:
        return None
    patterns = [
        r'var\s+now\s*=\s*["\']([^"\']+\.m3u8[^"\']*)["\']',
        r'var\s+player_data\s*=\s*(\{.*?\})',
        r'url:\s*["\']([^"\']+\.m3u8[^"\']*)["\']',
        r'var\s+playurl\s*=\s*["\']([^"\']+)["\']',
        r'(https?://[^\s"\']+\.m3u8[^\s"\']*)'
    ]
    for p in patterns:
        m = re.search(p, html)
        if m:
            val = m.group(1)
            if ".m3u8" not in val and "{" in val:
                m2 = re.search(r'"(https?://[^"]+\.m3u8[^"]*)"', val)
                return m2.group(1) if m2 else None
            return val
    return None
```

---

# 验证流程

```python
import sys; sys.path.insert(0, '/sdcard/Download')
# 替换为实际的脚本文件名
import spider_demo; s = spider_demo.Spider()
if hasattr(s, 'getName'): 
    print("T4模式:", s.getName())
# 检查核心接口是否存在
api_list = ['homeContent','categoryContent','detailContent','searchContent','playerContent']
exist_api = [m for m in api_list if hasattr(s, m)]
print("已实现接口:", exist_api)
# 测试搜索接口
r = s.searchContent("测试", "0")
print(f"搜索结果数量: {len(r['list'])}")
if r['list']:
    first_vod = r['list'][0]
    print(f"首个结果名称: {first_vod.get('vod_name', '空')}")
    # 测试详情接口
    d = s.detailContent([first_vod['vod_id']])
    if d.get('list'):
        vod_detail = d['list'][0]
        print(f"详情页名称: {vod_detail.get('vod_name', '空')}")
        print(f"播放线路: {vod_detail.get('vod_play_from', '空')}")
        # 提取首个播放ID（增加异常处理）
        play_url = vod_detail.get('vod_play_url', '')
        pid = ''
        if '$$$' in play_url:
            play_url = play_url.split('$$$')[0]
        if '#' in play_url:
            play_url = play_url.split('#')[0]
        if '$' in play_url:
            pid = play_url.split('$')[1]
        # 测试播放接口
        if pid:
            p = s.playerContent("", pid, "")
            print(f"播放URL（前80字符）: {p.get('url','')[:80]}")
        else:
            print("无有效播放ID")
    else:
        print("详情接口返回空")
else:
    print("搜索接口返回空")
```

---

# 故障排查

| 问题 | 方案 |
|------|------|
| `module 'xxx' has no attribute 'Spider'` | 确认Spider类已正确定义，且继承/导入逻辑匹配运行模式（T4/客户端） |
| 影视仓无法加载T4源 | T4模式需配置`type:4`，且API地址为`http(s)://域名/接口路径`（确保路径正确） |
| 字幕不显示 | playerContent返回subs字段（格式：`"subs": ["字幕名称$字幕URL"]`） |
| 播放403 | playerContent返回完整header（包含Cookie/Referer/User-Agent等） |
| 分类页空数据 | 用py_mcp:analyze_website重新分析选择器，检查data-*属性是否被忽略 |
| 播放链接获取失败 | 用py_mcp:debug_play_link递归调试，验证parse参数是否配置正确 |
| 选择器匹配0个 | 用py_mcp:debug_selector验证，检查contains条件是否准确，补充多级兜底选择器 |
| 小说正文为空 | 检查内容区XPath，覆盖`data-content`/`data-text`等属性，增加多级兜底 |
| 图片不全 | 检查分页逻辑、懒加载属性（data-original/data-src/data-lazyload） |
| 加密内容无法解密 | 用py_mcp:analyze_website检测加密类型 → **优先试parse=1**，最后才自己解密 |
| JSON API站 | 使用采集API骨架，跳过HTML解析，优先验证API可用性 |
| 搜索编码问题 | 关键词必须用`urllib.parse.quote()`编码，适配不同站点的编码规则 |
| iframe播放器空白 | 二次请求iframe src提取m3u8，或直接返回parse=1让客户端处理 |
| 签名过期 | 检查API签名算法，添加时间戳/nonce等参数，确保签名链完整 |
| **★ MacCMS播放失败** | **不要自己解密！用parse=1让客户端处理** |
| **★ API超时/不可用** | **不要假设API可用！验证后改用页面爬取骨架** |
| **★ 图片全部空白** | **检查data-original/data-src/data-lazyload属性，不要只看src** |
| **★ 变量未定义(apiVer)** | **spider_generator bug，改用页面爬取模式重新生成** |
| **★ 分类含非数字ID** | **手动硬编码categories，支持label/等前缀** |
| **★ 分页URL构造错误** | **使用make_page_url函数处理多种分页格式** |

---

# 211实战源经验速查表 + 在线之家深度分析优化

| 场景 | 占比 | 快速方案 |
|------|------|----------|
| MacCMS v8标准站 | 40% | v8骨架，改host+分类，**play用parse=1** |
| MacCMS v10标准站(API可用) | 20% | v10骨架，改host+分类，**play用parse=1** |
| MacCMS v10非标站(API不可用) | 10% | **页面爬取骨架**，手动配categories+filters，**play用parse=1** |
| 采集API站 | 10% | API骨架，改api路径（**先验证API可用性**） |
| 非标准影视站 | 10% | 深度分析HTML结构，自定义XPath（覆盖data-*属性） |
| 加密站（AES/XOR/RSA） | 5% | **先试parse=1**，失败再用加密模块 |
| 异步站（aiohttp） | 3% | 同步改写，requests替代 |
| 双源聚合站 | 2% | 两套API合并，$$$分隔线路 |

---

# 在线之家源码分析总结（2025-04优化核心）

## 关键突破

**原来不需要自己实现 encrypt=3 的解密！** 只需设置 `parse=1`，让TVBox/影视仓自带的解析器去处理加密的播放地址即可。

## 源码关键点

```python
# 在线之家.py核心实现（优化版）
def playerContent(self, flag, id, vipFlags):
    if not id.startswith('http'):
        url = self.site_url + id
    else:
        url = id
    return {"parse": 1, "url": url, "header": self.headers}
```

**核心就是返回`parse: 1`，让TVBox调用外部解析器处理。无需编写解密代码！**

## 根本教训

| 维度 | 错误认知 | 正确认知 |
|------|----------|----------|
| playerContent职责 | "我要解密出直链" | "告诉客户端去哪里找播放资源" |
| encrypt加密 | 自己逆向JS解密 | 交给外部解析器处理 |
| 播放URL | 必须是m3u8直链 | 网页URL也可以，parse=1即可 |

## MCP开发原则更新（强制）

1. **遇到encrypt参数或其他加密机制时，优先尝试`parse: 1`**
2. **只有当外部解析器失效（如返回空白/错误）时才需自己实现解密**
3. **先验证简单方案，再考虑复杂方案**
4. **任何时候不要先想到自己解密！**

## 优化后的MCP开发流程

```
1. 检测到加密播放地址时
   ↓
2. 先尝试直接返回 parse=1
   ↓
3. 用spider-create测试playerContent返回
   ↓
4. 如客户端无法播放，再走 analyze_website → 提取JS → 逆向加密算法
```

**这个顺序不能颠倒！先简后繁，能跑不折腾。**

---

# a123tv实战经验沉淀（2025-06新增 ⭐一次成功方法论）

## 核心发现：三个关键决策点决定成败

| 决策点 | 错误选择 | 正确选择 | 影响 |
|--------|----------|----------|------|
| 懒加载属性 | 只查`src` | 优先查`data-src`/`data-original`/`data-lazyload` | 图片+播放链接全丢失 |
| CF保护页 | 直接requests | visit_web获取cf_cookie | 拿到的是5秒盾HTML |
| parse值 | 统一parse=1 | 直链m3u8用parse=0 | 直链站播放失败 |

## ⭐一次成功流程（one_click_spider增强版）

```
输入URL
  ├─ CF保护？→ visit_web获取html+cf_cookie → 传入one_click_spider
  ├─ 非CF站点 → 直接one_click_spider(url)
  │
  └─ one_click_spider内部：
     1. analyze_website(带html/cf_cookie)
     2. 检查data-*属性优先级 ← a123tv经验
     3. 判断直链vs网页URL → 精准parse值
     4. create_spider_source → 生成源码
     5. test_interface验证5大接口
```

## data-*属性检测优先级（a123tv经验，强制！）

**实战痛点**：a123tv.com的m3u8链接藏在`<a data-src="xxx.m3u8">`中，`src`属性为空。MCP默认只查`src`，导致播放链接为空。

```
图片属性检测顺序：
  data-original > data-src > data-lazyload > data-lazy-src > src

播放链接检测顺序：
  data-src > data-url > data-play > href > src

提取逻辑（通用）：
  pic = img.get("data-original") or img.get("data-src") or img.get("data-lazyload") or img.get("data-lazy-src") or img.get("src", "")
  play_url = a.get("data-src") or a.get("data-url") or a.get("data-play") or a.get("href", "")
```

## Cloudflare保护站处理流程

```
站点访问 → 响应含"cf-browser-metadata"/"challenge-platform"/"just a moment"
  │
  ├─ 方案1（首选）: visit_web(url) → 获取html + cf_clearance cookie
  │   ↓ 传入 one_click_spider(url, html=..., cf_cookie=...)
  │
  ├─ 方案2: visit_web(url, user_agent_preset="desktop")
  │   ↓ 某些CF站点对移动UA触发验证，桌面UA直通
  │
  └─ 方案3: 带cf_cookie的requests直接请求
      ↓ headers={"Cookie": cf_cookie, "User-Agent": ...}
```

## parse值精准判定（a123tv经验优化版）

```
获取到的播放URL →
  ├─ 包含.m3u8/.mp4/.flv直链特征 → parse=0 ✅
  ├   但URL可能藏在data-src里！必须检查所有属性
  │
  ├─ 是网页路径（/play/xxx /vodplay/xxx .html结尾）→ parse=1 ✅
  │   MacCMS站点标准做法，不需要自己解密
  │
  ├─ 检测到加密但URL是直链 → parse=0 ✅
  │   a123tv就是这种情况：有加密特征但data-src里直接是m3u8
  │
  └─ 无法确定 → parse=1（安全兜底，客户端会尝试解析）
```

## 非标站点选择器扩容策略

a123tv.com暴露的问题：现有selectors.json覆盖不了data-*属性和自定义CSS类名。

**新增检测逻辑（已同步升级MCP）：**
1. 视频列表：在标准选择器失败后，搜索含`data-src`/`data-url`属性的`<a>`标签
2. 播放链接：在`href`提取失败后，检查`data-src`/`data-url`/`data-play`
3. 图片属性：优先检测`data-original`/`data-src`/`data-lazyload`，而非默认`src`

## 一次成检查清单

开发任何站点前过一遍，逐项确认：

- [ ] CF保护检测：访问URL是否返回5秒盾？
- [ ] 懒加载属性：是否覆盖data-original/data-src/data-lazyload？
- [ ] parse值：是否根据URL类型精准配置（直链0/网页1/未知1）？
- [ ] API验证：MacCMS v10站点是否先验证API可用性？
- [ ] 选择器：是否配置多级兜底，覆盖自定义CSS类名？
- [ ] 加密处理：是否优先尝试parse=1，而非直接解密？
- [ ] 字段完整性：是否包含vod_play_from/vod_play_url核心字段？
- [ ] 验证流程：是否运行test_interface验证五大接口？
```