# 51短剧 py 源完整写作步骤（从 0 到 1）

> 按顺序执行，每一步依赖前一步。最终交付 `/opt/data/out/51hub.py`（359 行）。
> 参考源码：`cache/documents/51短剧用久发布站源码(1).json`（永久发布页）+ `51短剧图片映射(1).json`（含 NUXT_DATA 的图片映射页）

---

## 第 1 步：永久发布页 → 实时发布页

**输入**：永久发布页 `https://51dj20.com/`

**永久发布页源码结构**（验证过的）：
```html
<a id="jPxxqOU0FN" href="https://odyewhhxh.cc/" target="_self">加载中...</a>
```

**操作**：直接 GET 该 URL，从返回的 HTML 里用正则提取 `a` 标签的 `href`：

```python
m = re.search(r'<a[^>]+href=["\x27]([^"\x27]+)["\x27]', html, re.I)
publish_page = m.group(1)  # 例如 https://odyewhhxh.cc/
```

**关键**：
- `a` 标签有 `id="随机字符串"` 属性，代码自带 JS 自动跳转，但我们的代码不依赖 JS，只抓 href
- **`publish_page` 是变量，每次可能不同**（站点换域名），代码不能硬编码

---

## 第 2 步：实时发布页 → 实时域名

实时域名结构：`https://{前缀}{后缀}/`

### 2.1 前缀（固定逻辑）

从前缀池里随机取 **5 个字符**：

```python
import random
prefix = "".join(random.choice("abcdefghjkmnpqrstuvwxy23456789") for _ in range(5))
```

**注意**：前缀池里**没有** `a` 里的 `a`（已含）、`i`、`l`、`o` 等容易混淆字母，只用这 26 个安全字符。

### 2.2 后缀（动态解析，分 3 小步）

**第 1 小步**：访问实时发布页（**变量**，上一步拿到的）

```python
html2 = requests.get(publish_page, headers=h, timeout=12, verify=False).text
```

**第 2 小步**：从源码里截取 `Base64.decode("...")` 里的内容，做 b64 解密

```python
m = re.search(r'Base64\.decode\(["\x27]([^"\x27]+)["\x27]\)', html2, re.I)
decoded = base64.b64decode(m.group(1)).decode("utf-8", "ignore")
```

**第 3 小步**：从解密后的内容里截取 `words.random() + '...'` 的引号内部分

```python
m = re.search(r'words\.random\(\)\s*\+\s*["\x27]([^"\x27]+)["\x27]', decoded, re.I)
suffix = m.group(1).strip()  # 例如 .sysrycady.com
```

**注意**：正则里 `["\x27]` 等价于 `["']`，兼容源码里单引号或双引号两种写法。

### 2.3 拼接实时域名

```python
host = "https://" + prefix + suffix.lstrip("/") + "/"
```

最终 `host` 形如：`https://x7k9j.sysrycady.com/`（前缀每次随机不同，后缀固定不变）

---

## 第 3 步：NUXT_DATA 解析（关键！）

**NUXT_DATA 源码结构**（从真实页面验证）：

```json
<script id="__NUXT_DATA__">
[[
  "ShallowReactive", 1],                          ← 顶层：devalue 包装，索引1是真实根
 {
  "data": 2, "state": 399, "once": 405, ...},     ← 索引1：data=2 引用下一个
 {
  "ca4ae672a2a1b1f67451c97ed54e4a10": 4},         ← 索引2（ShallowReactive解包后）：一个 dict，key 是哈希
 {                                                  ← 索引4：
  "data": 5, "status": 7, "msg": "ok", ...},      ←    data=5 引用下一个
 {                                                  ← 索引5：包含列表数据的容器
  "total": 6, "page": 7, "limit": 8, "list": 9},  ←    字段全是数字索引！
 200, 1, 20,                                       ← 索引6=200(total), 7=1(page), 8=20(limit)
 [10, 31, 48, ...],                                ← 索引9：list 数组（20个视频索引）
 {"video_id": 11, "title": 12, "cover": 13, ...}, ← 索引10：第一个视频对象（字段全是数字索引）
 11712,                                            ← 索引11：video_id 值
 "三国龙起",                                        ← 索引12：title 值
 "https:\\u002F\\u002Fpic.xustgq.cn\\u002Fupload_01\\u002Fupload\\u002F20260817\\u002F2026081719544753967.jpeg",  ← 索引13：cover
 ...
]
```

**关键发现**：
1. NUXT_DATA 是合法 JSON 数组，`json.loads` 能直接解
2. 里面用了 **Nuxt SSR devalue 编码**：`["ShallowReactive", idx]` 或 `["RefCell", idx]` 表示"索引 idx 的值包了壳"
3. 数组里**对象和字符串混排**：偶数索引是 dict（结构），奇数索引可能是数字/字符串/布尔（实际值）
4. 数字字段值通过索引引用：`{"video_id": 11}` 里 `11` 不是值本身，是另一个数组索引，`data[11] = 11712` 才是真正的 video_id
5. cover 字段里 `\u002F` 是 JSON 转义的 `/`，`json.loads` 自动转成 `/`，但**注意**：源码里是 `\\u002F`（双反斜杠），解出来还是 `\\u002F` 字符串——需要手动 `replace("\\u002F", "/").replace("\\/", "/")`

**解析器代码**（已验证通过，能正确解出 200 条/20 页的视频列表）：

```python
import re, json

def parse_nuxt(html):
    m = re.search(r'<script[^>]+id=["\x27]__NUXT_DATA__["\x27][^>]*>(.*?)</script>', html, re.S)
    if not m: return None
    data = json.loads(m.group(1).strip())
    memo = {}
    def get(idx):
        if not isinstance(idx, int) or idx < 0 or idx >= len(data):
            return idx
        if idx in memo:
            return memo[idx]
        x = data[idx]
        # devalue 编码：["ShallowReactive", idx] 或 ["RefCell", idx]
        if isinstance(x, list) and len(x) >= 2 and isinstance(x[0], str):
            if x[0] in ("ShallowReactive", "RefCell") and isinstance(x[1], int):
                memo[idx] = None
                return get(x[1])
        if isinstance(x, list):
            out = []
            memo[idx] = out
            for v in x: out.append(get(v))
            return out
        if isinstance(x, dict):
            out = {}
            memo[idx] = out
            for k, v in x.items(): out[k] = get(v)
            return out
        memo[idx] = x
        return x
    return get(0)
```

**从解析结果里找视频列表**（递归找 `total+page+limit+list` 容器）：

```python
def find_list_containers(obj, depth=0):
    found = []
    if depth > 30: return found
    if isinstance(obj, dict):
        if "total" in obj and "list" in obj:
            found.append(obj)
        for v in obj.values():
            found.extend(find_list_containers(v, depth + 1))
    elif isinstance(obj, list):
        for v in obj:
            found.extend(find_list_containers(v, depth + 1))
    return found

root = parse_nuxt(html)
containers = find_list_containers(root)
# containers[0] = {"total": 200, "page": 1, "limit": 20, "list": [...20条视频...]}
```

**视频对象字段**（从真实源码验证，共 15 个字段）：
```python
{
    "video_id": 11712,              # int，剧集唯一ID
    "title": "三国龙起",             # str，剧名
    "cover": "https://pic.xustgq.cn/upload_01/upload/20260817/2026081719544753967.jpeg",  # str，封面URL
    "tags": ["AI", "三国", "魔改"],  # list[str]，标签
    "description": "穿越回到三国...",  # str，简介
    "chase_count": 43625,            # int，追剧人数
    "actor_list": [],                # list，演员列表（分类页常为空）
    "play_count": 30654,             # int，播放量
    "play_count_text": "3.1W",       # str，播放量文本（直接显示用）
    "original": 0,                   # int/bool，是否原创
    "serialize_status": 7,           # int，连载状态码
    "serialize_status_text": "连载中",  # str，连载状态文本（直接显示用）
    "episode_id": 750483,            # int，首集episode_id
    "is_chased": False,              # bool，是否已追
    "rank_score": 20707              # int，排名分数
}
```

---

## 第 4 步：图片解析

**AES 密钥**（与每日大赛相同）：
- key = `b"f5d965df75336270"`（bytes，16字节）
- iv = `b"97b60394abc2fbe1"`（bytes，16字节）

**图片获取流程**：

1. NUXT_DATA 里视频对象的 `cover` 字段**直接有完整 URL**（不是空的！）
2. cover 是 `https://pic.xustgq.cn/upload_01/upload/YYYYMMDD/YYYYMMDDHHMMSSSSS.jpeg` 格式
3. 走壳端 `localProxy` 时，**服务器返回 AES-128-CBC 加密的二进制**
4. 壳端必须用 pycryptodome 解密：

```python
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad

def decrypt_image(ciphertext):
    try:
        return unpad(
            AES.new(media_key, AES.MODE_CBC, media_iv).decrypt(ciphertext),
            AES.block_size
        )
    except:
        return ciphertext  # 解密失败返回原始数据
```

**shell 端 localProxy 写法**：

```python
def localProxy(self, param):
    if param.get("type") != "img":
        return [404, "text/plain", "", ""]
    try:
        url = self.d64(param.get("url", ""))  # 先 base64 解码
        r = self.session.get(url, headers=self.headers, timeout=15, verify=False)
        content = r.content
        content = decrypt_image(content)  # AES 解密
        ctype = "image/jpeg"
        if content.startswith(b"\x89PNG"):
            ctype = "image/png"
        elif content[:4] == b"RIFF" and content[8:12] == b"WEBP":
            ctype = "image/webp"
        return [r.status_code, ctype, content, {}]
    except Exception as e:
        return [404, "text/plain", "", ""]
```

**图片 URL 传给壳端时用 base64 编码**（避免特殊字符破坏 URL）：

```python
pic_url = self.getProxyUrl() + "&url=" + urllib.parse.quote(self.e64(cover), safe="") + "&type=img"
```

---

## 第 5 步：播放解析

**播放页 URL**：`{host}drama-play?id={video_id}&episode_id={episode_id}`

`video_id` 和 `episode_id` 从分类页视频对象里取。

访问播放页 → 解析 NUXT_DATA → 用 `find_list_containers` 或递归找 `episode_title + video_url` 成对对象：

```python
def find_episodes(root):
    items = []
    def go(obj, depth=0):
        if depth > 30: return
        if isinstance(obj, dict):
            if "episode_title" in obj and "video_url" in obj:
                items.append(obj)
            for v in obj.values(): go(v, depth+1)
        elif isinstance(obj, list):
            for v in obj: go(v, depth+1)
    go(root)
    return items

# 每集对应 {"episode_title": "第1集", "video_url": "https://xxx.m3u8"}
# video_url 可能是相对路径，补全为完整 URL
```

播放串格式（`#` 分隔每集）：
```
第1集$url1#第2集$url2#...
```

---

## 第 6 步：分类体系

### 6.1 剧集筛选页（核心分类）
`{host}explore-drama/{theme}-{setting}-{background}-{audience}-{time}-{recommend}/`

6 段参数，每段是数字 ID。做成 `filters` 面板，用户选完自动拼 URL。
- 示例：`explore-drama/9-0-0-0-0-0/`（theme=9 其他全 0）

### 6.2 榜单
- 周榜：`{host}rank-drama/week/page/{n}/`
- 月榜：`{host}rank-drama/month/page/{n}/`

### 6.3 演员
- 男演员：`{host}explore-actor/2/page/{n}/`
- 女演员：`{host}explore-actor/1/page/{n}/`
- 演员推荐榜：`{host}rank-actor/recommend/page/{n}/`
- 演员热度榜：`{host}rank-actor/hot/page/{n}/`
- 演员新人榜：`{host}rank-actor/new/page/{n}/`

**演员二级**（`vod_id = "actor_detail_" + actor_id`，`vod_tag = "folder"`）：
- 壳端识别为文件夹，点开进 `detailContent`
- `detailContent` 访问 `actor-detail/{id}/` 页面
- NUXT_DATA 里用 `find_list_containers` 找作品列表
- 返回**剧集列表**（每条独立 vod，vod_tag="video"）
- **关键**：返回的每条必须补 `vod_play_from` 和 `vod_play_url`，否则点播放报错

### 6.4 AI成人短剧
`{host}drama/AISD/page/{n}/`

### 6.5 翻页
所有列表页 URL 末尾加 `page/{n}/`，首页（第1页）省略。

---

## 第 7 步：演员头像（进阶优化）

演员详情页 NUXT_DATA 里该演员所有作品都有 `cover` 字段。

**自动化策略**：用户进演员列表页时，**自动为当前页所有演员**请求详情页：
- 拿第一张作品封面当头像
- 同时把该演员所有作品图缓存进 `image_id_map` / `image_map`（后续翻页/进详情页直接命中，不重复请求）
- 翻演员页时继续累积

**为什么这么做**：NUXT_DATA 里 `/files/.../avatar.jpg` 路径返回 0 字节，不可用；唯一能拿头像的方式就是去演员详情页取其作品封面。

---

## 第 8 步：完整 py 文件

`/opt/data/out/51hub.py`（359 行，最终交付版，语法验证通过）

**结构**：
```python
import json, ssl, re, base64, random, urllib.parse
from base.spider import Spider
import requests
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad

class Spider(Spider):
    def getName(self): return "51短剧"

    def init(self, extend=""):
        # 1. 设 UA / session / AES key
        # 2. 解析域名（第1步+第2步）
        # 3. 初始化空缓存字典
        # 4. 设置 classes 和 filters

    def _resolve_domain(self): ...   # 第2步：域名解析
    def _req(self, url): ...          # 通用请求
    def parse_nuxt(self, html): ...   # 第3步：NUXT_DATA 解析
    def find_list_containers(self, obj): ...  # 找列表容器
    def _pic(self, x): ...            # 图片 URL → 代理 URL
    def _media(self, x): ...          # 播放 URL 补全
    def _num(self, n): ...            # 数字格式化（万）
    def _actor_cover(self, aid): ...  # 第7步：自动拉演员头像+缓存作品图
    def _vod(self, x, actor=False): ...  # 组装 vod 字典
    def _meta(self, html): ...        # 提取 total/page/limit
    def _page(self, html, actor=False): ...  # 分类页解析
    def _fix(self, url): ...          # 相对路径补全
    def _url(self, cid, pg, ext=None): ...  # 拼分类 URL

    def homeContent(self, filter): ...
    def homeVideoContent(self): ...
    def categoryContent(self, cid, pg, filter, ext): ...
    def detailContent(self, ids): ...
    def searchContent(self, key, quick, pg="1"): ...
    def playerContent(self, flag, id, vipFlags): ...
    def isVideoFormat(self, url): ...
    def e64(self, text): ...
    def d64(self, text): ...
    def localProxy(self, param): ...   # 第4步：图片 AES 解密
    def destroy(self): ...
```

---

## 常见坑

1. **NUXT_DATA 解析**：`["ShallowReactive", idx]` 是 devalue 编码，第一个元素是字符串标记，第二个才是索引。不能当普通 list 处理
2. **递归引用**：NUXT_DATA 是"扁平数组 + 数字索引"结构，`{"video_id": 11}` 里 `11` 是数组下标不是值本身。必须写 `get(idx)` 递归解引用
3. **循环引用**：`memo = {}` 缓存已解的索引，防止 `data[idx]` 指向自己导致无限递归
4. **`\u002F`**：`json.loads` 后 cover 字段里 `\u002F` 会被自动转成 `/`，但如果源码是 `\\u002F`（双反斜杠），解出来还是字符串 `\\u002F`——需要手动 `replace`
5. **演员列表页 NUXT_DATA 里演员对象和剧集对象混在一起**：`_walk(data, ["actor_id","name"])` 会误匹配剧集对象（剧集也有 name）。演员列表必须走 DOM 解析 `/actor-detail/(\d+)/` 链接
6. **演员二级返回**：必须补 `vod_play_from` 和 `vod_play_url` 字段
7. **图片服务器返回 0 字节**：`/files/.../avatar.jpg` 路径返回 0 字节，不可用；唯一可靠的图片是 `upload_01/...` 路径（AES 加密，壳端解密）