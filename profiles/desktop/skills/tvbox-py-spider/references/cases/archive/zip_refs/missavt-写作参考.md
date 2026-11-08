# MissAVt Spider 写作参考

> MissAV 是 MissAVt（missavt28.com / missavt.com）的壳源，动态域名，Nuxt SSR，图片走"瓜系解密"。
> 完整 py 文件：`/opt/data/out/missav.py`（499 行）。
> 同源：51短剧 v4、91hub2——三站图片 AES 解密 key/iv 相同（`f5d965df75336270` / `97b60394abc2fbe1`）。

---

## 1. 域名获取（动态域名体系）

### 域名结构
```
{5字符前缀}.{3个主域名之一}/{路径}
```

- **前缀**：从 `abcdefghijklmnopqrstuvwxyz0123456789` 随机取 5 字符（不含 `i/l/o/0/1`）
- **3 个主域名**：`kibsbvpft.cc` / `fvtweuyk.cc` / `gcqsnwaam.com`
- **3 个发布站**（3 个 HTML 完全一样，跳转在 `publish.js` 里）：
  - `https://missavt01.github.io`
  - `https://missavt01.netlify.app`
  - `https://missavt01.pages.dev`
- **2 个永久站**：`missavt28.com` / `missavt.com`

### 发布站源码
`<head>` 内 `<script src="/publish.js"></script>`，publish.js 内包含：
- 19 个大学代号前缀（thu/pku/fdu/sjtu/zju/xmu/hitsz/hust/sdu/nju/ustc/xmu/tju/zju/scu/sdu/nju/xmu/hitsz 等）
- 随机选 1 个前缀 + 1 个主域名 → 跳转

### 后端域名解析逻辑（_get_domain）

**并发 10 worker**，从 3 个发布站取后缀 → 随机前缀组合 → 并发探测 → 哪个先通用哪个。

代理探测顺序（`_get_domain` 内）：
1. `127.0.0.1:7890` / `127.0.0.1:1080` / `127.0.0.1:1087`（壳端常见代理端口）
2. `192.168.31.66:7890`（飞牛NAS mihomo，本机/壳端都有时备用）
3. 如果都没代理，**直连兜底**（部分壳端环境直连可用）

并发 10 worker + 12 秒超时，实测 5~9 秒出域名。

**关键优化**：壳端等待时间通常不够，**推荐导入时通过 `ext` 传真实域名**跳过解析：
```
ext: https://scu.fvtweuyk.cc
```
这样 1 秒开。

---

## 2. NUXT_DATA 解析（devalue 编码）

MissAV 用 Nuxt SSR，页面里 `__NUXT_DATA__` 是 devalue 编码格式，不是标准 JSON。

### 结构
```
__NUXT_DATA__ = ["ShallowReactive", 1]
```
- 第一个元素 `"ShallowReactive"` 是**字符串标记**（不是索引！）
- 第二个元素 `1` 是索引，指向 NUXT_DATA 数组里的位置

### 解引用递归
```python
def get(obj, idx, memo):
    if isinstance(obj, list) and obj and isinstance(obj[0], str) and obj[0] == "ShallowReactive":
        idx = obj[1]
        return get(data, idx, memo)
    if isinstance(obj, list) and len(obj) == 2 and isinstance(obj[1], int):
        return memo[obj[1]] if obj[1] in memo else None
    return obj

# 调用时必须加 memo 防循环引用
memo = {}
memo[idx] = get(data, idx, memo)
```

**陷阱**：
- `["ShallowReactive", idx]` 第一个是**字符串不是索引**（我之前写反过）
- NUXT_DATA 数组约 830~900 个元素，索引可达 800+
- **不加 memo 会死循环**（页面里常有循环引用）
- 用户发的源码文件里 `\n` `\r` 是**字面转义字符**，测试时需 `html.replace('\\n','\n')`；`fetch()` 拿真页面不需要

---

## 3. 分类体系（7 大类 + 子分类）

**URL 结构**：
- `/{分类}/{排序或子分类}/` 首页
- `/{分类}/{排序或子分类}/{页码}/` 分页

| 分类 ID | URL 路径 | 筛选字段 |
|---|---|---|
| `sort` | `/sort/{by}/` | `by`: renew/hot/month_hot/ten_minutes/month_comment |
| `jp` | `/category/{cateId}/` | `cateId`: censored/chinese-subtitle/renqishunv/zhifuyouhuo/tiaojiaoSM/jiatingluanlun |
| `cn` | `/category/{cateId}/` | `cateId`: madou/swag/sweet-heart-vlog/ed-mosaic/douyin/91-studio/mr-rabbit/domestic-media/xingbatanhua |
| `uncen` | `/category/{cateId}/` | `cateId`: uncensored-leak/fc2/tokyohot/marriedslash/heyzo/reducing-mosaic/10musume/pacopacomama/xxx-av/caribbeancompr/caribbeancom/1pondo |
| `amateur` | `/category/{cateId}/` | `cateId`: siro/luxu/gana/prestige-premium/s-cute/ara |
| `actresses` | `/actresses/{by}/` | `by`: new/num/hot/name |
| `tags` | `/tags/{cateId}/` | `cateId`: hot/letter/a~z/# |

**actor 二级**（点进女优）：`vod_id = "actress/{中文名}"`，`tag = "folder"`
**tag 二级**（点进标签）：`vod_id = "tag/{英文名}"`，`tag = "folder"`

---

## 4. 图片解密（"瓜系解密"，与 51hub v4 同款）

### AES-128-CBC 固定密钥
```python
IMG_KEY = b'f5d965df75336270'
IMG_IV  = b'97b60394abc2fbe1'
```

### 流程
1. NUXT_DATA 里视频对象的 `cover` 字段是 base64 编码的加密数据
2. base64 解码 → AES-128-CBC 解密 → 得到 PNG/JPG 二进制
3. 通过 `localProxy` 的 `pic` 类型返回：`[200, mime, data]`

### 视频卡片结构（首页/分类页）
```html
<div class="video-item" ...>
  <a href="/watch/mdog-005/" data-url="https://jw-hls.wgmyvq.cn/m3u8/xxx" ...>
    <img class="video-preview-img" data-src="BASE64加密数据" />
    <div class="video-title">男性高潮 双重卡司 ...</div>
  </a>
</div>
```

关键字段：`href`（相对路径）/ `data-src`（加密图片 base64）/ `data-url`（**播放 m3u8 直链**）

**陷阱**：部分视频 `data-src` 为空，需要**跳过或 fallback 到默认图**。

---

## 5. 播放解密（**核心，最容易搞错**）

### 5.1 关键发现

**MissAV 播放不是 eval 加密，不是 91hub 同款**！用户给的"eval packer 解码"要求**是误贴了 91hub 的说明**。

MissAV 首页/分类页 `data-url` 字段里**直接是 m3u8 CDN 直链**：
```
data-url="https://jw-hls.wgmyvq.cn/m3u8/a374bf06ddb200947f3e27a3ea7525cc9ef5a4f39f2?auth_key=..."
```

### 5.2 data-url 正则陷阱

**旧写法**（错）：
```python
re.search(r'data-url=["\x27]([^"\x27]+)["\x27]', html)
```
在 `&` 处截断，丢掉 `.m3u8` 后缀和 `auth_key` 参数。

**正确写法**：
```python
re.search(r'data-url=["\x27]([^"\x27<>]*\.[mM]3[uU]8[^"\x27<>]*)["\x27]', html)
# 或 fallback
re.search(r'data-url=["\x27]([^"\x27<>]+)["\x27]', html)
```

### 5.3 m3u8 里的 ts 段

m3u8 直链可达（200），但里面有：
```
#EXT-X-KEY:METHOD=AES-128,URI="https://tsnew.cpckgr.cn/hc104/m3u8/enc.key?auth_key=xxx",IV=0x64cf692cebc516e4a86ac6081aae50ce
#EXT-X-MEDIA-SEQUENCE:1
tsnew.cpckgr.cn/hc104/m3u8/seg_0.ts?auth_key=xxx
```

**shell 直接放 m3u8 可以**（壳端播放器大多能自动解析 ts AES 段）。

### 5.4 **陷阱：不要用自定义 URI scheme**

我试过加 `m3u8://` 前缀做标记，**壳端不识别，直接超时**。

正确做法：**直接返回完整 URL**，不要加任何 scheme 前缀：
```python
"vod_play_url": vod_name + "$" + play_url   # 正确
# 不要
"vod_play_url": vod_name + "$m3u8://" + play_url   # 错，超时
```

如果必须走代理（比如 shell 不支持 m3u8 里的 ts），可以**通过 m3u8 URL 特征判断**而不是自定义 scheme。

---

## 6. TVBox categoryContent 参数传递（**最容易踩坑**）

**两种壳传参方式**，必须都兼容：

| 壳类型 | `ext` 参数 | `filter` 参数 |
|---|---|---|
| TVBox 主流 | `ext = {"cateId":"censored"}` (dict 或 json 字符串) | `filter = {}` (空) |
| 部分壳 | `ext = ""` (空串) | `filter = {"cateId":"censored"}` (dict) |

**正确写法**（优先 ext，filter 兜底）：
```python
def categoryContent(self, cid, pg, filter, ext):
    f = {}
    if isinstance(ext, dict):
        f = ext
    elif isinstance(ext, str) and ext and ext not in ('{}','null','undefined'):
        try: f = json.loads(ext)
        except: pass
    if not f:
        if isinstance(filter, dict):
            f = filter
        elif isinstance(filter, str) and filter and filter not in ('{}','null','undefined'):
            try: f = json.loads(filter)
            except: pass
    # 用 f.get() 取筛选值
```

**我犯了两次错**：
1. 第一版用 `ext.get('by')` —— shell 传 filter 字典，ext 是空串，`.get()` 永远返回默认值 → **筛选点不动**
2. 第二版改成只用 `filter` —— 有些壳传 ext 字符串，filter 是空 dict → **也没数据**
3. 第三版双兼容 ✅

---

## 7. 完整 py 结构（499 行）

```python
class Spider(Spider):
    IMG_KEY = b'f5d965df75336270'
    IMG_IV  = b'97b60394abc2fbe1'
    PREFIX_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'

    init(extend)              # 域名解析或直接用 ext 传入域名
    _get_domain()             # 并发域名解析（10 worker + 代理探测）
    _fetch_suffixes()         # 抓 3 个发布站的 publish.js
    fetch(url)                # 带 proxy fallback 的 GET
    _fetch_with_proxy(url)    # 代理重试

    homeContent(filter)       # 返回 7 class + 全部 filter
    homeVideoContent()        # 首页推荐

    categoryContent(...)      # 分 7 大类，双兼容 ext/filter
    detailContent(ids)        # 抓 data-url 直链，data-src 抓图
    playerContent(flag, id)   # 直接返回 m3u8 直链

    parse_videos(html)        # 视频卡片解析（video-item / video-preview-img / data-src / data-url / href）
    parse_actors(html)        # 女优列表解析
    parse_tags(html)          # 标签列表解析

    localProxy(params)        # type=pic 走 AES 解密，其他返回空
    proxyPic(params)          # base64 解码 → AES-128-CBC 解密
    _aes_decrypt(encrypted)   # 固定 key/iv
    _detect_ext(data)         # 自动识别 png/jpg/gif/webp

    isVideoFormat(url)        # .m3u8/.mp4/.ts/.flv 判定
    manualVideoCheck()        # 返回 True（不走二次检测）
```

---

## 8. 关键坑位汇总

| 坑 | 现象 | 修复 |
|---|---|---|
| 自定义 scheme | 播放超时 | 直接返回完整 URL，不加 `m3u8://` 之类前缀 |
| data-url 正则 | 只取到一半 URL | 用 `[^"\x27<>]*` 替代 `[^"\x27]+`，允许到 `>` 为止 |
| NUXT_DATA devalue | 解析失败/死循环 | `["ShallowReactive", idx]` 第一个是字符串标记；必须加 memo 防循环 |
| 筛选参数 | 点筛选没变化 | 双兼容 `ext` (dict/json str) + `filter` (dict) |
| 域名解析 | shell 超时 | 并发 10 worker；壳端导入时 ext 传真实域名跳过解析 |
| 测试文件 `\n` 字面 | 正则匹配失败 | `html.replace('\\n','\n')` 还原；真页面 fetch 不需要 |
| `data-src` 为空 | 部分视频没图 | 解析函数内跳过空 `data-src`，或 fallback 默认图 |
| m3u8 里 ts AES 段 | shell 直接放可玩 | 不需要额外代理解密 ts 段（除非壳端不支持） |