# py 源通用套路参考（从每日大赛.py / 黄果短剧.py 提炼）

> 来源：用户发的 `每日大赛_2_.py`（Typecho 加密站，451 行）+ `黄果短剧_16_.py`（黄果短剧 v16，313 行）
> 这两个文件展现了**两套不同风格的 py 源**，里面不少模式可复用到其他站。

## 一、每日大赛.py（Typecho / WordPress 加密站模板）

### 核心特征
- 站点结构：Typecho 博客引擎，`/archives/ID/` 详情页，`/category/SUFFIX/` 分类，`/search/关键词/` 搜索
- 域名防封：发布页 5 个候选域名（publish_urls 数组）→ 循环 GET 每个 → 找 `Base64.decode('...')` 或 `atob('...')` → 解码 → 再找 `words.random() + '.域名后缀'` 或 `.[a-z0-9]{5,}.com` → 拼 `前缀(5随机字母) + 后缀`
- **AES 加密图片**（key=`f5d965df75336270` / iv=`97b60394abc2fbe1`）：和 51吃瓜/91jav/黄果短剧同一套 key，`loadBannerDirect('...')` 里是明文 URL，但**下载的内容字节是加密的**，需 localProxy 下载后 AES-CBC unpad 解密
- **Base64 多层编码**：首页/列表 HTML 里嵌了 `Base64.decode('...')` 内联文本，`_decode_page()` 循环最多 5 轮解码替换后再解析
- 落地页二次跳转：`<a href="https://真实域名">加载中</a>` → 提取后 GET 真实域名

### 可复用模式

**① 发布页域名解析**
```python
def _resolve_domain(self):
    for pub in self.publish_urls:
        r = self.session.get(pub, headers=self.headers, timeout=5)
        if r.status_code != 200: continue
        html = r.text
        m = re.search(r'<a[^>]+href=["\'](https?://[^"\']+)["\'][^>]*>加载中', html, re.I)
        if m:
            r2 = self.session.get(m.group(1), timeout=5)
            if r2.status_code == 200: html = r2.text
        m = re.search(r"Base64\.decode\(['\"]([^'\"]+)['\"]\)", html)
        if not m: m = re.search(r"atob\(['\"]([^'\"]+)['\"]\)", html)
        if not m: continue
        decoded = base64.b64decode(m.group(1)).decode('utf-8', 'ignore')
        m2 = re.search(r'words\.random\(\)\s*\+\s*[\'"]([^\'"]+)[\'"]', decoded)
        if m2: suffix = m2.group(1); break
    prefix = ''.join(random.choices("abcdefghijklmnopqrstuvwxyz", k=5))
    self.host = f"https://{prefix}{suffix}/"
```
- 备用后缀硬编码兜底，前缀 5 位随机字母防封

**② 请求 + 落地页跟随（递归）**
```python
def _req(self, url):
    r = self.session.get(url, headers=self.headers, timeout=15, verify=False)
    if r.status_code == 200:
        html = self._decode_page(r.text)
        j = re.search(r'<a[^>]+href=["\'](https?://[^"\']+)[^>]*>加载中', html, re.I)
        if j: return self._req(j.group(1))  # 跟随落地页
        return html
    return ""
```

**③ 页面 Base64 解码循环**
```python
def _decode_page(self, html):
    for _ in range(5):
        m = re.search(r"Base64\.decode\(['\"]([^'\"]+)['\"]\)", html)
        if not m: break
        decoded = base64.b64decode(m.group(1)).decode('utf-8', 'ignore')
        html = html.replace(m.group(0), f"'{decoded}'")
    return html
```
- 适用场景：页面内嵌 `Base64.decode('...')` 形式的动态字符串（Typecho/WordPress 主题常见）

**④ AES 加密图片 localProxy**
```python
def _aes_img(self, data):
    if data.startswith("http"):
        return self.getProxyUrl() + "&url=" + self.e64(data) + "&type=img"
    raw = base64.b64decode(data)
    cipher = AES.new(self.aes_key, AES.MODE_CBC, self.aes_iv)
    raw = unpad(cipher.decrypt(raw), AES.block_size)
    return "data:image/jpeg;base64," + base64.b64encode(raw).decode()

def localProxy(self, param):
    if param.get("type") == "img":
        url = self.d64(param.get("url", ""))
        res = requests.get(url, headers=self.headers, timeout=10, verify=False)
        if res.status_code == 200:
            raw = res.content
            cipher = AES.new(self.aes_key, AES.MODE_CBC, self.aes_iv)
            raw = unpad(cipher.decrypt(raw), AES.block_size)
            return [200, res.headers.get("Content-Type","image/jpeg"), raw, {}]
    return [404,"text/plain","",""]
```
- AES key=`f5d965df75336270` iv=`97b60394abc2fbe1`（多家站通用）

**⑤ 播放地址多种模式兜底（精确优先）**
```python
# 模式1（优先）：mutex:true 的 video.url（DPlayer/自定义）
r'"mutex"\s*:\s*true[\s\S]*?"video"\s*:\s*\{\s*"url"\s*:\s*"([^"]+)"'
# 模式2：video: { url: "..." }
r'video\s*:\s*\{\s*url\s*:\s*["\']([^"\']+)
# 模式3：直接 .m3u8 / .mp4 链接
r'(https?://[^\s"\']+\.(?:m3u8|mp4)[^\s"\']*)'
# 兜底：var now / var playurl
r'var\s+now\s*=\s*["\']([^"\']+)["\']'
r'var\s+playurl\s*=\s*["\']([^"\']+)["\']'
# HTML video/source
r'<video[^>]+src=["\']([^"\']+)["\']'
r'<source[^>]+src=["\']([^"\']+)["\']'
```

**⑥ 分页最大页数提取**
```python
def _extract_max_page(self, html):
    pagination = re.search(r'<ul[^>]*class="pagination"[^>]*>(.*?)</ul>', html, re.S)
    if not pagination:
        pagination = re.search(r'<ul[^>]*class="page-navigator"[^>]*>(.*?)</ul>', html, re.S)
    if pagination:
        pages = re.findall(r'href="[^"]*?(?:page/|/)(\d+)(?:/|"|>)', pagination.group(1))
        if pages: return max(int(p) for p in pages)
    return 1
```

**⑦ e64/d64 基类缺失时自实现**
```python
def e64(self, t):
    return base64.b64encode(t.encode("utf-8")).decode() if t else ""
def d64(self, t):
    return base64.b64decode(t.encode()).decode("utf-8") if t else ""
```
- ⚠️ 羊壳 Spider 基类**没有** e64/d64，用必须自实现

---

## 二、黄果短剧_16.py（黄果短剧站点模板，黄果短剧 v16 版）

### 核心特征
- API + HTML 混合站：`/api/videos/category/{type}?sort=&page=&size=`（JSON 列表），详情页/专题/排行榜走 HTML
- 域名发现：publish 发布页 + pages.dev/github.io 两个源 → `publish.js` 提取 `var subdomains`（大学前缀池）+ `var urls`（真实域名）→ 组合生成所有候选域名 → 逐个 GET `/api/videos/category/ai-duanju?sort=new&page=1&size=1` 测活（必须返回 `data.items` 是 list）
- **60 分钟域名缓存**（`self.checked` + `time.time()-self.checked < 1800`）
- **AES 加密图片**（同一套 key `f5d965df75336270` / iv `97b60394abc2fbe1`），localProxy 走 `type=img`
- `lxml.etree` + XPath 解析 HTML（不用正则，比每日大赛纯正则稳）

### 可复用模式

**① 域名发现 + 候选池生成**
```python
def _discover(self):
    out = ["https://huangguoai.com","https://huangguoai.ai"]
    for pub in [self.publish,"https://huangguoai.github.io/"]:
        r = self._request(pub)
        if not r: continue
        jsu = urljoin(pub, re.search(r'<script[^>]+src=["\']([^"\']*publish\.js[^"\']*)', r.text)[1])
        j = self._request(jsu)
        if not j: continue
        s = re.sub(r'//[^\n]*','',j.text)
        out += re.findall(r'https://[a-zA-Z0-9.-]+',s)
        sm = re.search(r'var\s+subdomains\s*=\s*\[(.*?)\]',s,re.S)
        dm = re.search(r'var\s+urls\s*=\s*\[(.*?)\]',s,re.S)
        subs = re.findall(r'["\']([^"\']+)["\']',sm.group(1)) if sm else []
        doms = re.findall(r'["\']([^"\']+)["\']',dm.group(1)) if dm else []
        out += ["https://"+a+"."+b.strip(" /") for b in doms for a in subs]
    return list(dict.fromkeys([u.rstrip("/") for u in out if "pages.dev" not in u and "github.io" not in u]))
```
- 适用：发布页是 JS 壳 + `var subdomains/var urls` 数组结构（黄果系/玩物社区同款）

**② 域名缓存 + 测活**
```python
def _ensure(self, force=False):
    if not force and time.time()-self.checked < 1800: return self.host
    for u in self._discover():
        r = self._request(u+"/api/videos/category/ai-duanju?sort=new&page=1&size=1",
                          headers={"Accept":"application/json"})
        try:
            if r and r.status_code==200 and isinstance(r.json().get("data",{}).get("items"),list):
                self.host=u; break
        except: pass
    self.checked=time.time(); return self.host
```

**③ lxml + XPath HTML 解析（比正则稳）**
```python
from lxml import etree
t = etree.HTML(html)
# 遍历卡片
for a in t.xpath('//a[contains(@href,"/detail/") and .//img]'):
    img = a.xpath('.//img[1]')
    name = (img[0].get("alt","") if img else "") or self._txt(a,'.//*[contains(@class,"title")]//text()')
    remark = self._txt(a,'.//*[contains(@class,"episode")]//text()') or self._txt(a,'.//*[contains(@class,"score")]//text()')
# _txt 辅助
def _txt(self,node,xp): return " ".join("".join(node.xpath(xp)).split())
```
- XPath 适合**嵌套卡片结构**，比 `<a&&</a>` 正则更不容易跨卡吃漏

**④ URL 修复 + 相对路径处理**
```python
def _fix(self,u): return urljoin(self.host+"/",u or "")
```
- `urljoin` 比手写 `if starts with "/"` 更可靠

**⑤ 图片代理（b64 编码 URL + localProxy AES 解密）**
```python
def _pic(self,u):
    u=self._fix(u)
    if not u or u.startswith("data:") or "cover-placeholder" in u: return ""
    try: proxy=self.getProxyUrl()
    except: return u
    sep="&" if "?" in proxy else "?"
    return f"{proxy}{sep}type=img&u={base64.urlsafe_b64encode(u.encode()).decode().rstrip('=')}"

def localProxy(self, params):
    typ = str(params.get("type") or "")
    if typ == "img":
        v = str(params.get("u") or "")
        url = base64.urlsafe_b64decode(v+"="*(-len(v)%4)).decode()
        r = self._request(url, headers={...})
        raw = r.content if r and r.status_code==200 else b""
        # 先检测是否是已解密图片
        ext = self.detect_extension(raw)
        if ext != "bin":
            return [200, MIME_MAP[ext], raw]
        # 需要解密
        if len(raw)%16: return [502,"text/plain","invalid encrypted image"]
        raw = self.decrypt_image(raw)
        ext = self.detect_extension(raw)
        if ext=="bin": return [502,"text/plain","image decrypt failed"]
        return [200, MIME_MAP[ext], raw]
    return [404,"text/plain","not found"]

def decrypt_image(self, encrypted_data):
    return AES.new(b'f5d965df75336270', AES.MODE_CBC, b'97b60394abc2fbe1').decrypt(encrypted_data).rstrip(b'\x00')

def detect_extension(self, data):
    if data[:8]==b'\x89PNG\r\n\x1a\n': return 'png'
    if data[:3]==b'\xff\xd8\xff': return 'jpg'
    if data[:6] in (b'GIF87a', b'GIF89a'): return 'gif'
    if data[:4]==b'RIFF' and data[8:12]==b'WEBP': return 'webp'
    return 'bin'

MIME_MAP = {"png":"image/png","jpg":"image/jpeg","jpeg":"image/jpeg","gif":"image/gif","webp":"image/webp"}
```
- ⚠️ **`rstrip(b'\x00')` 零填充解密**（黄果短剧用户重写版风格），不用 unpad——部分站点 padding 不规范用 unpad 会抛异常

**⑥ 播放 URL 实时刷新（防 CDN 换域名）**
```python
def _fresh_play(self, page):
    sep = "&" if "?" in page else "?"
    s = self._get(page + sep + "_" + str(int(time.time()*1000)))  # 加时间戳参数
    url = ""
    # 方式1: data-play-src 属性
    m = re.search(r'<article[^>]*class=["\'][^"\']*\.?is-active[^"\']*["\'][^>]*\bdata-play-src=["\']([^"\']+)', s, re.I|re.S)
    if m: url = m.group(1)
    if not url:
        # 方式2: JSON-LD script
        data = self._play_json(s); url = data.get("videoSrc","") or data.get("previewSrc","")
    if not url:
        urls = re.findall(r'https?://[^"\'<>\ ]+\.(?:m3u8|mp4)[^"\'<>\ ]*', s)
        url = urls[0] if urls else ""
    return url.replace("\\/","/").replace("\\u0026","&").replace("&amp;","&")
```
- 加时间戳参数 `?_=xxx` 绕过 CDN 缓存，强制刷新播放地址

**⑦ 播放页 JSON 提取（script 标签里的 JSON）**
```python
def _play_json(self, s):
    if not s: return {}
    t = etree.HTML(s)
    for x in (t.xpath('//script[not(@src)]/text()') if t is not None else []):
        z = x.strip()
        if z.startswith("{") and ('"videoSrc"' in z or '"epPlaySrcs"' in z):
            try: return json.loads(z)
            except: pass
    m = re.search(r'(\{[^<>]*?"videoSrc"\s*:\s*".*?"[^<>]*?\})\s*</script>', s, re.S)
    if m:
        try: return json.loads(m.group(1))
        except: pass
    return {}
```

**⑧ detailContent 路由多类型（topic: / post: 前缀）**
```python
def detailContent(self, ids):
    vid = str(ids[0])
    if vid.startswith("topic:"):  # 专题页
        slug = vid.split(":",1)[1]; s = self._get(f"/topics/{quote(slug)}/")
        # ...
        return {"list":[{...}]}
    if vid.startswith("post:"):  # 文章页
        pid = vid.split(":",1)[1]; s = self._get(f"/archives/{quote(pid)}/")
        # ...
    # 默认：视频详情页
    s = self._get(f"/detail/{quote(vid)}/")
```
- vod_id 用 `前缀:id` 区分类型，detailContent 路由

---

## 三、两份文件对比总结（写新源时怎么选风格）

| 维度 | 每日大赛.py | 黄果短剧.py |
|------|------------|------------|
| 解析方式 | 纯正则 `re.findall` | `lxml.etree` + XPath |
| 图片处理 | AES 本地解密 → `data:` base64 内联 | AES localProxy → shell 拉流 |
| 域名发现 | publish 多候选 GET + `Base64.decode` | publish + pages.dev/github.io + `var subdomains/var urls` |
| 落地页跟随 | 递归 `_req()` 处理 `<a>加载中</a>` | 无（发布页已直出域名） |
| 播放提取 | 多正则模式兜底（DPlayer/json/mp4） | `data-play-src` 属性 + JSON-LD |
| 分页 | `_extract_max_page()` 从 `<ul class="pagination">` 取 | API 自带 pagination 字段 |
| e64/d64 | 自实现（class 内方法） | 未用（走标准库 urlsafe_b64encode/decode） |
| AES unpad 方式 | `unpad()`（PKCS7） | `rstrip(b'\x00')`（零填充容错） |

### 选择原则
- **Typecho / WordPress 加密站**（每日大赛类）→ 学每日大赛.py 的正则 + Base64 多层解码 + 落地页递归 + unpad
- **发布页 JS 壳 + API 混合站**（黄果短剧/玩物社区类）→ 学黄果短剧.py 的域名发现 + 60 分钟缓存 + lxml XPath + localProxy 解密 + 播放 URL 时间戳刷新
- **AES 图片 key/iv**：两个文件**共用同一套** `f5d965df75336270` / `97b60394abc2fbe1`——多家站通用（51吃瓜/91jav/每日大赛/黄果短剧）

### 通用可复用组件（两个文件共有的）
1. `requests.Session()` 会话复用
2. `ssl._create_default_https_context = ssl._create_unverified_context`（HTTPS 证书验证关闭）
3. 图片 AES 解密 localProxy（key=iv 同一套）
4. try/except 包所有请求（永不抛异常，返回空 list 或 ""）
5. `_request()` 统一请求函数（带 headers/timeout 兜底）
6. `User-Agent` 用安卓真实 UA（带设备型号和版本号，不是通用字符串）
7. UA + `Accept-Language: zh-CN,zh;q=0.9`

### ⚠️ 写新源时注意的差异
- **黄果短剧.py 用 `lxml`**——如果羊壳无 lxml 库，需降级纯正则（每日大赛风格）。测试环境确认 lxml 可用
- **黄果短剧.py 有 `localProxy type=play` 代理 m3u8**（play 代理 + playres 分片代理，防 Referer/Origin 校验）——CDN 有防盗链时这个结构有用
- **每日大赛.py 的 e64/d64 自实现**——羊壳 Spider 基类**没有**这两个方法，所有 py 源用 base64 编码都必须自实现
- **AES padding 容错**：黄果短剧用 `rstrip(b'\\x00')`，每日大赛用 `unpad()`。解不开时两个都试，黄果短剧用户版实测 `rstrip` 更稳（部分字节未完整 16 字节 unpad 会抛）

---

## 四、51短剧（51hub.com）通用套路（v1.0，2026-08-25 沉淀）

### 站点特征
- 站点：`51hub.com`（静态域名，反爬极严——Cloudflare/CDN 会返回 2206 字节的政府站点伪装页），只有浏览器或加了正确 UA 的壳端 HTTP 能拿到真实 HTML
- 技术栈：Nuxt SSR（服务端渲染），所有列表/详情/播放数据都嵌在 HTML 的 `<script id="__NUXT_DATA__" data-nuxt-data="nuxt-app" data-ssr="true">` 里
- **不要走 DOM/XPath 解析**（51hub 的可见 DOM 是空的，数据全在 NUXT_DATA JSON 里）
- API 后端：`api.51dj1.com`（首页 `<link rel="preconnect">` 里泄露）

### 关键解析方式：NUXT_DATA devalue 序列
- Nuxt 把状态用 `devalue` 库序列化成紧凑格式：`[[["ShallowReactive",1],{...},...]]`，顶层是数组，每个元素按索引访问
- **不要 json.loads**（devalue 有 `ShallowReactive` 这种非标准 JSON），要写一个 devalue 解析器（约 100 行，核心看上面 `DVal` 类）
- 索引引用：字段值是数字时代表另一个位置的值，需要递归展开（`_res(arr, v)` 工具函数）
- 但**引用数组（如 episodes）不要展开**，展开会递归成对象——只用一层：`arr[ep_refs_val]` 拿到引用数组 `[27,31,35...]`，再 `arr[27]` 拿每个元素

### 数据结构（NUXT_DATA 顶层数组位置）
```
位置0 = ["ShallowReactive", 1]
位置1 = {data, state, once, _errors, serverRendered, path, pinia}
位置2 = ["ShallowReactive", 3]
位置3 = {hash: value_idx, ...}   ← key→data 索引映射
位置4 = {data, status, msg, crypt, req_time, trace_id}
位置5 = {list: 6}                 ← 分类信息
位置6 = [7,13,17]                 ← 分类项
  [7] = {id:8, title:9, code:10, ...} → id=3,title="AI 成人短剧",code="AISD"
位置24 = {data, ...}              ← drama 数据容器
位置25 = {module:26, total:27, list:28}   ← drama 列表容器
位置28 = [29,43,53,...]            ← 卡片引用数组（最多 30 张）
  [29] = {video_id:30, title:31, cover:32, tags:33, play_count:40, ...}
    展开：video_id=11610, title="xxx", cover="https://pic.xustgq.cn/...", tags=["AI","成人",...]
```

### 详情页/播放页结构（NUXT_DATA 顶层数组）
- 位置 5 = drama 对象，字段含 `video_id/title/cover/description/tags/actor_list/original/serialize_status/serialize_status_text/episode_count/play_count/episodes/current_episode_id/play_url/related_list`
- `play_url`（字段值）展开后就是 m3u8 直链
- `episodes` 字段 = 索引 → arr[索引] = 引用数组 `[27,31,35,...]` → 每个元素 `{id,sort,title,duration}`
- ⚠️ **源站 episodes 数组可能混入其他剧的集引用**（实测第 7、8 个是别的剧）——用数组顺序编号，不要按 `sort` 或 `title`

### 图片处理
- 直链 `https://pic.xustgq.cn/upload_01/upload/YYYYMMDD/xxx.jpeg`（不需要任何 base64 代理）
- CDN 有防盗链，shell 拉不到时加 `Referer: https://51hub.com/`

### 播放处理（HLS AES-128）
```
play_url = https://hls.dscxru.cn/videos5/{32-hex}/{32-hex}.m3u8?auth_key={动态}&v=3&time=0&via=51duanju
  → 拉 m3u8 拿到 #EXT-X-KEY:
     URI="https://tts.doudou520.online/videos5/{32-hex}/crypt.key?auth_key={AK}"
     IV=0x8a820d65f218cc21c4e35522cd23e302
  → ts 分片：https://tts.doudou520.online/videos5/{32-hex}/{32-hex}{N}.ts?auth_key={AK}
  → AES-128-CBC 解密：所有 ts 共用同一 IV（不 XOR）
```
- `auth_key` 每次播放会话都换（前缀 178763xxxx）——不能缓存 m3u8，走 `localProxy type=hls/ts`

### 反爬绕过（最关键！）
- **服务器端 curl 拿到的永远是被反爬的壳（2206 字节）**，只有壳端（浏览器环境）HTTP 才能拿到真实 NUXT_DATA
- 但壳端也可能被拦——需要对比黄果短剧.py 和每日大赛.py 的 HTTP 头找出绕过要点：
  - 安卓真实 UA（带设备型号，不要通用字符串）
  - `Accept-Language: zh-CN,zh;q=0.9`
  - `Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8`
  - `Referer: https://51hub.com/`
  - `verify=False`（HTTPS 证书验证关闭）
  - **加时间戳参数 `?_=xxx` 强制刷新**（防 CDN 返回缓存的反爬页）
- 如果壳端 HTTP 仍被拦，最后手段：**改走浏览器抓取**（用 shell 端的 WebView 请求，或让 py 源通过 `window.fetch` 之类的浏览器 API）
- 反爬绕过失败时的**快速自检方法**：在 py 源里打印 `len(self._get("/drama/AISD/"))`——如果 < 5000 字节，说明拿到的是反爬壳

### 通用函数（可复用）
```python
def _res(arr, v):
    if isinstance(v, int):
        try: return _res(arr, arr[v])
        except (IndexError, TypeError): return v
    if isinstance(v, list):
        return [_res(arr, x) for x in v]
    return v

# 注意：_res 对 episodes 引用数组不要用（会展开成对象）
# episodes = arr[arr[drama['episodes']]]  → 这才是正确的
```

### 测试要点
- 服务器端测试只能用真实 HTML 缓存（用户从浏览器导出的源码）
- 壳端实测：导入 py 源 → 看分类页是否有卡片（30 张）→ 点卡片看详情 → 看集数 → 点播放
- 如果壳端 51hub 反爬过不了（len < 5000），说明壳端 HTTP 也被 Cloudflare 拦了，需要对比壳端 UA 和模板的 UA 差异
