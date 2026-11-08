# MissAV(missavt) py 源完整写作步骤

> 参考：`cache/documents/51短剧用久发布站源码(1).json`（3个发布站同源 publish.js）+ `51短剧图片映射(1).json`（列表页源码）+ `missavt所需源码与要求.json`（详细分类结构）+ `91hub2.py` / `51吃瓜.py` / `91hub.py`（解密参考）
> 交付：`/opt/data/out/missav.py`（535 行）

---

## 第 1 步：域名自动解析（从 3 个发布站动态取后缀）

### 1.1 发布站同源
`missavt01.netlify.app` / `missavt01.github.io` / `missavt01.pages.dev` 三个发布站**代码完全一致**，`publish.js` 结构：

```js
var urls = ['kibsbvpft.cc', 'fvtweuyk.cc', 'gcqsnwaam.com'];
var JumpPage = "https://missavt28.com";
var foreverUrls = ["https://missavt.com", JumpPage];
```

### 1.2 后缀动态提取
访问任一发布站的 `publish.js`，正则抓取 `['\"]([^'\"]*?\.(?:cc|com))['\"]`。

### 1.3 前缀随机生成
从 `abcdefghijklmnopqrstuvwxyz0123456789` 随机取 5 个字符。

### 1.4 域名结构
```python
domain = "https://" + prefix + "." + suffix + "/"
# 例：https://x7k9j.kibsbvpft.cc/
```

### 1.5 域名轮询策略（⚠️ 必用并发，避免 58s 超时）

**串行逐个测 58 秒（羊壳会超时）**——必须用 `ThreadPoolExecutor` 并发，压到 5~9 秒：

```python
from concurrent.futures import ThreadPoolExecutor, as_completed

# 构造候选域名池
candidates = []
for suffix in suffixes:
    for _ in range(2):
        prefix = ''.join(random.choices("abcdefghijklmnopqrstuvwxyz0123456789", k=5))
        candidates.append("https://" + prefix + "." + suffix + "/")

# 代理端口探测（本机 + 飞牛NAS）
proxies = []
for port in ['7890', '1080', '1087']:
    try:
        self.session.get("http://127.0.0.1:" + port, timeout=1)
        proxies.append({"http": "http://127.0.0.1:" + port, "https": "http://127.0.0.1:" + port})
    except Exception: pass
try:
    self.session.get("http://192.168.31.66:7890", timeout=1)
    proxies.append({"http": "http://192.168.31.66:7890", "https": "http://192.168.31.66:7890"})
except Exception: pass
if not proxies:
    proxies.append({})  # 直连兜底

def try_one(item):
    domain, p = item
    try:
        r = self.session.get(domain, headers={"User-Agent": "Mozilla/5.0"}, timeout=3, verify=False, proxies=p)
        if r.status_code == 200 and ('MissAVt' in r.text or 'video-item' in r.text):
            return (domain, p)
    except Exception: pass
    return None

with ThreadPoolExecutor(max_workers=10) as ex:
    futures = [ex.submit(try_one, (d, p)) for d in candidates for p in proxies]
    for f in as_completed(futures, timeout=12):
        result = f.result()
        if result:
            self.session.proxies = result[1]
            return result[0]
return ""
```

- **fallback**：`init(extend)` 支持用户传真实域名，跳过域名解析

---

## 第 2 步：图片解密（瓜系 AES，与 91hub/51吃瓜 同款）

**密钥**：key = `b'f5d965df75336270'`，iv = `b'97b60394abc2fbe1'`，AES-128-CBC + PKCS7 unpad

**图片位置**：`img data-src="https://image.cpckgr.cn/upload_01/..."`

**实现**：`data-src` 提取 → `_img()` base64 编码拼 `localProxy(type=pic)` URL → 壳端 `localProxy` 收到 → base64 解码 → GET 图片 → AES 解密 → 返回

```python
def proxyPic(self, params):
    url = base64.b64decode(params['url']).decode('utf-8')
    r = requests.get(url, headers=self.header, timeout=15, verify=False)
    data = AES.new(IMG_KEY, AES.MODE_CBC, IMG_IV).decrypt(r.content)
    return [200, 'image/jpeg', unpad(data, AES.block_size)]
```

---

## 第 3 步：视频列表解析

**页面结构**（`<div class="video-item">` 到 `<div class="video-preview w-full h-full left-0 top-0">`）：

```html
<div class="video-item">
  <a href="/watch/1pondo_071217_551/">
    <div class="poster" data-url="https://jw-hls.wgmyvq.cn/.../xxx.m3u8?auth_key=...">
      <img data-src="https://image.cpckgr.cn/upload_01/...jpeg"
           alt="标题">
    </div>
  </a>
</div>
```

**字段提取**：
- `vod_id` = href 里 `/watch/xxx/` 中的 xxx（正则：`/watch/[^"\x27]*/`）
- `vod_name` = `img alt` 属性
- `vod_pic` = `img data-src` → 走 `_img()` 加密代理
- **`data-url`** = m3u8 直链，**详情页直接取**（无需 eval 解密）

---

## 第 4 步：分类体系

### 4.1 近期更新
`{host}sort/{by}/{page}/`，筛选 `renew`（最近更新，默认）/`hot`/`month_hot`/`ten_minutes`/`month_comment`

### 4.2 日本AV / 国产AV / 无码AV / 素人AV
`{host}category/{cateId}/{page}/`

| 分类 | cateId |
|---|---|
| 日本AV | censored / chinese-subtitle / renqishunv / zhifuyouhuo / tiaojiaoSM / jiatingluanlun |
| 国产AV | madou / swag / sweet-heart-vlog / ed-mosaic / douyin / 91-studio / mr-rabbit / domestic-media / xingbatanhua |
| 无码AV | uncensored-leak / fc2 / tokyohot / marriedslash / heyzo / reducing-mosaic / 10musume / pacopacomama / xxx-av / caribbeancompr / caribbeancom / 1pondo |
| 素人AV | siro / luxu / gains / prestige-premium / s-cute / ara |

### 4.3 女优（二级文件夹）
一级：`{host}actresses/{by}/{page}/`，筛选 `num/new/hot/name`
二级：`{host}actress/{urlencode(女优名)}/{page}/`

**关键**：`vod_id="actress/" + name`，`vod_tag="folder"`；二级页 href 里的中文名要 `urllib.parse.quote` 编码。

### 4.4 标签（二级文件夹）
一级：`{host}tags/{cateId}/{page}/`，筛选 `hot`/`letter/a`~`letter/z`/`letter/%23`
二级：`{host}tag/{urlencode(标签名)}/{page}/`

### 4.5 搜索
`{host}search/{urlencode(key)}/{page}/`

### 4.6 筛选参数路由（⚠️ 必测！壳端 ext vs filter 传参不一致）

壳端 `categoryContent(cid, pg, filter, ext)` 的 4 个参数，**不同壳实现传参规则完全不同**：

| 壳实现 | 筛选值放哪 | filter 类型 | ext 类型 |
|--------|----------|------------|---------|
| TVBox 主流 | `ext` | `{}` 空 dict | `"{}"` 空字符串 或 `{"cateId":"xxx"}` JSON 字符串 |
| 部分影视壳 | `filter` | `{"cateId":"xxx"}` dict | `""` 空字符串 |
| 少量壳 | 都在 `ext` | 任意 | dict |

**结论：筛选值必须先从 `ext` 取，再从 `filter` 兜底，两个参数都要处理**：

```python
def categoryContent(self, cid, pg, filter, ext):
    page = int(pg) if pg else 1
    f = {}
    if isinstance(ext, dict): f = ext
    elif isinstance(ext, str) and ext and ext not in ('{}', 'null', 'undefined'):
        try: f = json.loads(ext)
        except Exception: pass
    if not f:
        if isinstance(filter, dict): f = filter
        elif isinstance(filter, str) and filter and filter not in ('{}', 'null', 'undefined'):
            try: f = json.loads(filter)
            except Exception: pass
    by = f.get('by', 'renew')
    c  = f.get('cateId', 'default')
```

**⚠️ 常见翻车（2026-08-26 MissAV 排障实证）**：
- 只写 `ext.get('by')` → 壳把筛选走 filter，ext 空 → 所有分类返回默认内容（"内容都一样"）
- 只写 `filter.get('by')` → 壳把筛选走 ext → 整个源没数据（"现在没数据了"）
- **两种都写就 100% 兼容**

**⚠️ 交付前必测 3 种调用方式**：
```python
s.categoryContent("jp", "1", {}, '{"cateId":"censored"}')   # TVBox 主流
s.categoryContent("jp", "1", {"cateId":"censored"}, "")     # 部分壳
s.categoryContent("jp", "1", {}, "")                        # 空筛选
```
三种都要返回正确分类内容才算通过。

---

## 第 5 步：详情与播放

### 5.1 详情页
`{host}watch/{vod_id}/`

### 5.2 播放直链（**优先**）
详情页 HTML 里 `<div class="poster" data-url="https://jw-hls.wgmyvq.cn/...m3u8?auth_key=...">` 直接就是 m3u8 直链，**无需解密**。

**⚠️ 正则必用 `.m3u8` 锚点兜底，不能只用 `[^"\x27]+`**（2026-08-26 MissAV 播放超时根因实证）：

```python
# ❌ 错误：在 URL 的 & 处截断，丢了 m3u8 后缀和 auth_key 参数
um = re.search(r'data-url=["\x27]([^"\x27]+)["\x27]', html)
# 匹配结果: .../853c9c26bc9a8d4c744e48b3738c37a0  ← 截断

# ✅ 正确：.m3u8 作为锚点，到 .m3u8 后允许任意字符（除 > 和引号）
um = re.search(r'data-url=["\x27]([^"\x27]*\.[mM]3[uU]8[^"\x27<>]*)["\x27]', html) \
   or re.search(r'data-url=["\x27]([^"\x27<>]+)["\x27]', html)
```

原因：`data-url="...m3u8?auth_key=xxx&v=3"` 里的 `&` 是合法 URL 字符，`[^"\x27]+` 只到首个 `&` 就停。**解法 = 正则里让 `.m3u8` 作为锚点，从 `.m3u8` 之后允许任意字符**。

### 5.3 播放解密 fallback（91hub 同款 eval）
如果 `data-url` 为空，fallback 到详情页里的 `eval(function(p,a,c,k,e,d))` 混淆脚本：提取 api/key/iv → GET api → b64 解码 → AES-CBC 解密 → m3u8 直链。

### 5.4 HLS 128 解密播放链路（⚠️ 必测！m3u8 时效签名 + ts 段加密）

MissAV CDN 的 m3u8 结构：
```
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-KEY:METHOD=AES-128,URI="https://tsnew.xxx.cn/.../enc.key?auth_key=...",IV=0x...
#EXT-X-TARGETDURATION:3
#EXTINF:3.0,
https://tsnew.xxx.cn/.../seg-001.ts?auth_key=...
```

**壳无法直接播放的 3 个根因（逐一修复）**：

**根因 1：`data-url` 正则截断**（上节 5.2 已覆盖）

**根因 2：m3u8 链接无 `.m3u8` 后缀**（CDN 用 hash 路径如 `/m3m/a374bf06ddb200947...`）
`playerContent` 里 `.lower().find(".m3u8")` 匹配失败 → 直接返回 CDN 直链 → 壳无法识别 m3u8。
- **修复**：detailContent 给 m3u8 打 `m3u8://` 前缀标记，`playerContent` 先剥标记再走代理

**根因 3：ts 段时效签名 + AES-128 加密**
CDN 缓存过期后 401/410，且 ts 段加密。
- **修复**：`localProxy` 加 `m3u8`/`ts`/`mkey` 三分支，m3u8 里把所有 ts/key URL 改写为代理地址

```python
# detailContent：给 m3u8 打标记
vod["vod_play_url"] = vod_name + "$m3u8://" + play_url

# playerContent
def playerContent(self, flag, id, vipFlags):
    url = id if str(id).startswith("http") else self._href(id)
    if str(url).startswith("m3u8://"):
        url = url[7:]  # 剥标记
    if ".m3u8" in str(url).lower():
        return {"parse": 0, "url": self.getProxyUrl() + "&type=m3u8&url=" + self._b64(str(url)), "header": self.header}
    return {"parse": 0, "url": url, "header": self.header}

# proxyM3u8：把 m3u8 里的 ts 和 key 改成代理地址
def proxyM3u8(self, url):
    url = self._d64_safe(url)
    h = {"User-Agent": self.header["User-Agent"], "Referer": self.xurl + "/"}
    r = self.session.get(url, headers=h, timeout=15, verify=False)
    if r.status_code != 200:
        return [404, "text/plain", ""]
    text = r.text
    domain = url[:url.rfind('/')]
    b64 = self._b64
    lines = text.split("\n")
    new_lines = []
    for line in lines:
        mm = re.search(r'URI=["\x27]([^"\x27]+)["\x27]', line)
        if mm:
            key_url = mm.group(1)
            if not key_url.startswith("http"):
                key_url = domain + "/" + key_url.lstrip("/")
            line = line.replace(mm.group(1), self.getProxyUrl() + "&type=mkey&url=" + b64(key_url))
        elif not line.startswith("#") and line.strip() != "":
            ts = line.strip()
            if not ts.startswith("http"):
                ts = domain + "/" + ts.lstrip("/")
            line = self.getProxyUrl() + "&type=ts&url=" + b64(ts)
        new_lines.append(line)
    return [200, "application/vnd.apple.mpegurl", "\n".join(new_lines)]

# proxyTs：流回 ts 密文字节（不 AES 解密）
def proxyTs(self, url):
    url = self._d64_safe(url)
    r = self.session.get(url, headers={"User-Agent": self.header["User-Agent"], "Referer": self.xurl + "/"},
                         stream=True, timeout=15, verify=False)
    return [200, "video/MP2T", r.content]

# proxyKey：返回 AES key 原始 16 字节
def proxyKey(self, url):
    url = self._d64_safe(url)
    r = self.session.get(url, headers={"User-Agent": self.header["User-Agent"]}, timeout=10, verify=False)
    return [200, "application/octet-stream", r.content]

def _d64_safe(self, t):
    try: return base64.b64decode(t.encode()).decode()
    except Exception: return t

def _b64(self, t):
    try: return base64.b64encode(t.encode()).decode()
    except Exception: return t

# localProxy 分发（必带 4 分支）
def localProxy(self, params):
    t = params.get('type')
    if t == 'pic': return self.proxyPic(params)
    if t == 'm3u8': return self.proxyM3u8(params.get('url', ''))
    if t == 'ts': return self.proxyTs(params.get('url', ''))
    if t == 'mkey': return self.proxyKey(params.get('url', ''))
    return [200, 'text/plain', '']
```

**⚠️ ts 段是否要 AES 解密取决于壳的播放实现**：
- 多数壳（OK 影视/海阔视界）拿到 m3u8 后**会自行用 IV+key 解密 ts** → `proxyTs` 直接流回密文就行
- 少数壳不调用 mkey → 需要在 `proxyTs` 里自行 `AES.new(key, AES.MODE_CBC, iv)` 解密后返回
- **优先方案：不解密流回密文**；用户反馈花屏再上 AES 解密

---

## 常见坑

1. **域名解析**：本机连不上 3 个主域名（DNS 超时），必须走代理（飞牛NAS 192.168.31.66:7890 或壳环境代理）；`init(extend)` 传真实域名兜底
2. **`data-url` vs `data-src`**：`data-src` 是图片（AES 解密），`data-url` 是视频直链（不加密，直接返回）
3. **`href="/watch/xxx/"` 正则要用 `*` 不是 `+`**，`/watch/` 前可能没有别的字符
4. **女优/标签二级 URL 里的中文名必须 URL 编码**：`urllib.parse.quote(name)`
5. **页面源码里 `\r` 换行符**：`fetch()` 里 `.replace('\r', '')` 去掉
6. **`&amp;` 转义**：`data-url` 里的 `&` 被源码写成 `&amp;`，解码用 `.replace('&amp;', '&')`
7. **女优 data-src 可能为空字符串**：空 data-src 直接跳过不出图
8. **`data-url` 正则截断**：`[^"\x27]+` 在 `&` 处停，丢了 m3u8 后缀 → 用 `.m3u8` 锚点正则
9. **筛选参数路由**：壳端 ext vs filter 传参不一致，必须两种都处理
10. **域名解析并发**：串行 58 秒 → 并发 5~9 秒（ThreadPoolExecutor + as_completed timeout=12）

---

## 完整 py 文件（535 行，已交付 /opt/data/out/missav.py）