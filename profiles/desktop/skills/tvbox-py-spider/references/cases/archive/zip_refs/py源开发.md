# 海阔视界 py 视频源开发（XBPQ 规则的 Python 形态）

> 用户 2026-08-11 提供"授人以渔"话术+模板（小男娘案例），指导从 XBPQ JSON 规则迁移到 py 源。
> 参考文件：`/opt/data/archive/xbpq资料/每日大赛1.py`（框架模板，永久备份目录）、`templates/用户规则库/xbpq/小男娘.json`（xbpq 对照）、`templates/小男娘.py`（完整可运行成品）。
> 同一站可同时写 xbpq（JSON）和 py 两种形态，分类/二级结构保持一致。

## 框架结构（base.spider.Spider）

```python
# coding=utf-8
import json, time, ssl, re, base64, random, hashlib, html as html_parser
from base.spider import Spider          # ← 必须继承海阔视界基类！
import requests
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad

class Spider(Spider):                    # ← 裸类 class Spider: 海阔视界不识别
    def getName(self): return "站名"
    def init(self, extend=""):
        self.publish_urls = [...]        # 发布页列表
        self.ua = "..."; self.headers = {...}
        self.session = requests.Session()
        ssl._create_default_https_context = ssl._create_unverified_context
        self.aes_key = b"f5d965df75336270"   # 图片 AES key（多家站通用）
        self.aes_iv = b"97b60394abc2fbe1"    # 图片 AES iv（多家站通用）
        self._resolve_domain()               # 动态域名
        self.classes = [{"type_id": "...", "type_name": "..."}]  # 分类
```

必须实现的方法：
- `homeContent(filter)` → {"class", "list", "filters"}
- `homeVideoContent()` → {"list"}
- `categoryContent(cid, pg, filter, ext)` → {"list","page","pagecount","limit","total"}
- `detailContent(ids)` → {"list":[{vod_id,vod_name,vod_pic,vod_content,vod_play_from,vod_play_url}]}
- `searchContent(key, quick, pg)` → 同 categoryContent
- `playerContent(flag, id, vipFlags)` → {"parse":0,"url":...,"header":json}
- `localProxy(param)` → 图片代理 [200, content_type, bytes, {}]
- `e64/d64` → base64 工具

## 7 步动态域名获取（key→SHA→AES→zz_line）

小男娘案例（发布页源码里有 `key: "0726001"` 和 `data: "密文"`）：

```python
def _resolve_domain(self):
    suffix = None
    for pub in self.publish_urls:
        try:
            r = self.session.get(pub, headers=self.headers, timeout=10, verify=False)
            if r.status_code != 200: continue
            html = r.text
            m = re.search(r'key\s*:\s*"([^"]+)"', html, re.I)   # 步骤1 截取 key
            if not m: continue
            key_raw = m.group(1)
            key_sha256_hex = hashlib.sha256(key_raw.encode()).hexdigest()
            aes_key = bytes.fromhex(key_sha256_hex)              # 步骤2 SHA hex→bytes = AES key
            aes_iv = key_sha256_hex[:16].encode("utf-8")         # 步骤3 iv=hex前16位
            m2 = re.search(r'data\s*:\s*"([^"]+)"', html, re.I)  # 步骤4 截取密文
            if not m2: continue
            cipher = AES.new(aes_key, AES.MODE_CBC, aes_iv)
            dec = unpad(cipher.decrypt(base64.b64decode(m2.group(1))), AES.block_size).decode("utf-8","ignore")
            m3 = re.search(r'"zz_line"\s*:\s*"([^"]+)"', dec)     # 步骤5 zz_line=后缀
            if m3: suffix = m3.group(1); break
            m4 = re.search(r'"zz_backup_line"\s*:\s*"([^"]+)"', dec)  # 备用
            if m4: suffix = m4.group(1); break
        except Exception as e:
            continue
    if not suffix: suffix = "兜底域名.com"
    prefix = "".join(random.choices("abcdefghijklmnopqrstuvwxyz0123456789", k=5))  # 步骤6 随机5字符
    self.host = "https://" + prefix + "." + suffix + "/"          # 步骤7 拼域名
    self.domains = [self.host]
```

**AES key 两种写法等价，用户答案版标准用 `bytes.fromhex(SHA_hex)`**（不是 `.digest()`，也不是直接喂 hex 字符串）。`bytes.fromhex(hex)` 与 `.digest()` 数学等价，但以用户答案版为准。iv 用 `hex[:16].encode()`。

## 图片处理（用户答案版标准：走壳代理）

**用户答案版用 `_img_proxy()`（图片走 getProxyUrl 代理，防防盗链/墙），不是直接返回 URL：**

```python
def _img_proxy(self, img_url):
    if not img_url: return ""
    img_url = img_url.strip("`")
    if not img_url.startswith("http"): return ""
    return self.getProxyUrl() + "&url=" + self.e64(img_url) + "&type=img"
```

- 列表/详情里图片 URL 先 `strip("`")` 去反引号，再走 `_img_proxy`
- localProxy 里 `d64(param.get("url"))` 还原 → requests 拉图 → 返回 bytes（可先试 AES 解密，失败原样返回）
- `_aes_decrypt_img(data)` 备用：AES key/iv = `b"f5d965df75336270"`/`b"97b60394abc2fbe1"`（多家站通用）

```python
def _aes_img(self, data):
    if not data: return ""
    if data.startswith("http"): return data   # 明文URL直接返回
    raw = base64.b64decode(data)
    cipher = AES.new(self.aes_key, AES.MODE_CBC, self.aes_iv)
    raw = unpad(cipher.decrypt(raw), AES.block_size)
    return "data:image/jpeg;base64," + base64.b64encode(raw).decode()
```

- 固定 key `f5d965df75336270` + iv `97b60394abc2fbe1`，91jav/51吃瓜/每日大赛/小男娘 通用
- 小男娘当前页面图片是**明文 URL**（z-image-loader-url="`https://...jpeg`" 反引号格式）→ 但答案版仍走 `_img_proxy` 代理
- `_fix_url`：`\\\\/`→`/`、`&amp;`→`&`、`//`→`https:`、`/`开头→拼 host

## 列表解析（按页面实际结构写正则）

小男娘：`<div class="xqbj-list-rows-image">` 开始，split 切块（比 findall 可靠），块内取：
- 链接 `<a href="...">`、标题 `<h3>...</h3>`
- 图片 `z-image-loader-url="\`([^\`]+)\`"`（反引号）
- 副标题 `xqbj-list-rows-bottom-tags-text`（作者名）
- 过滤 `sponsored`/`ad-item`/`加载中...`

标签列表（tags-group）：`<a href="/tag/伪娘/"...><h3>伪娘</h3>(8450)</a>` → 数量在 `</h3>(\d+)`。

## ⚠️ 常见翻车点（sexcnx/404 实战踩坑，写 py 前必读）

1. **必须 `from base.spider import Spider` + `class Spider(Spider)` 继承基类**——裸类海阔视界不识别，症状"打开没数据/加载失败"。
2. **filters 必须是 dict**：`"filters": {"type": [...], "rq": [...], "letter": [...]}`（key=筛选key，value=选项列表 `[{"key","name","value":[{"n","v"}]}]`）。返回 list 会"只有推荐页、分类不显示"。homeContent 里拼好 dict 返回。
3. **vod_id 用页面链接**（详情页 URL），不要用 m3u8 直链当 vod_id——点进去 detailContent 会把 m3u8 当 HTML 请求导致"无法播放"。播放地址在 detailContent 里解析。
4. **详情页播放地址可能是动态加载**：sexcnx 详情页里 20 个 m3u8 全是推荐位，真实播放地址在 `<script src="js/js.php?did=视频ID">` 返回的 JS 里（`m3u8=https://...`）。流程：详情页找 `js.php` src → 请求它 → 正则 `m3u8=([^&\s"']+)` 提取。fallback 顺序：js.php → data-preview → video/source 标签。**广告 iframe 域（ads.xnavxx.com/adc.php）要黑名单过滤**：`["ads.", "adc.php", "advertising", "doubleclick", "googleadservices"]`。
5. **_fix_url 必须处理无斜杠相对路径**：`js/js.php`（不带 `/` 前缀）也要拼 host，否则请求失败：最后一行返回 `self.host.rstrip('/') + '/' + url.lstrip('/')`。
6. **HTML 实体标题解码**：`&#x5077;&#x60c5;` 这类实体 → `html_parser.unescape()`（import html as html_parser），再 `_clean_html`。
7. **列表块边界不统一时按分隔符切**：`re.split(r'<div class="cell_box[^"]*">', html)` 再逐块提取，比 findall 边界正则稳（cell_box 有 `clf_a` 额外 class、块间有 HTML 注释 `<!-- xxx -->`、`</span><span>` 等变体）。
8. **广告/推荐位污染**：列表页或详情页会有推荐视频混入，标题/链接/播放地址都要过滤（`[不包含:广告]` 对应 py 里的关键词黑名单）。
9. **播放地址实测可播再交付**：m3u8 返回 200 才算过（requests GET 验证）。

## 播放地址提取（dplayer data-config）

小男娘详情页：`data-config='{...mutex:true,"video":{"url":"https:\/\/hls.dscxru.cn\/...m3u8"}}'`（单引号 JSON）
```python
m_cfg = re.search(r"data-config='(\{[\s\S]*?\})'", html)
cfg = json.loads(m_cfg.group(1))
url = cfg.get("video", {}).get("url", "")
```
fallback：`"video"\s*:\s*\{\s*"url"\s*:\s*"([^"]+)"` → m3u8/mp4 直链正则。

## 分类/二级结构（与 xbpq 对齐）

xbpq 的 `分类url: {{域名-c}}{cateId}/page/{catePg}/` 但分类页实际翻页是 `{cid}/{pg}/`（第一页无页码）→ py 里：
```python
if pg == 1: url = f"{self.host}{cid}/"
else:       url = f"{self.host}{cid}/{pg}/"
```
二级目录（folder$）：标签页 `tags/page/{pg}/`、up主 `authors_blogger/creator/page/{pg}/`、收藏榜 `authors_up/favorite-all/{pg}/`、原创主 `authors_blogger/original/`（单页）。xbpq 的 `特殊分类链接` 直接映射到 py 的 categoryContent 分支。

### ⚠️ 二级目录（列表项点进去是"列表"不是"播放"）正确写法（18j 实战教训，用户反复纠正）

**核心原则：点击父项（如女优/演员）应显示子项列表，点击子项才进播放。** 做法是让父项 vod_id 用 `dir_` 前缀，**壳点击后调 categoryContent（不是 detailContent）**——detailContent 返回多 vod 时羊壳只取第一个或直接播放，症状"点击还是播放/只显示一部"。

```python
# 父项（女优）列表项：vod_id 用 dir_ 前缀携带详情页路径
actors.append({'vod_id': 'dir_' + f'/actor/detail/{slug}/',
               'vod_name': name, 'vod_pic': pic, 'vod_remarks': '女优'})

def categoryContent(self, tid, pg, filter, extend):
    if isinstance(tid, str) and tid.startswith('dir_'):
        href = tid[4:]  # /actor/detail/xxx/
        # ① 先取演员名（详情页 h1，去掉括号别名部分）
        html = self._req(self.host + href)
        hm = re.search(r'<h1[^>]*>([^<]+)</h1>', html)
        name = hm.group(1).split('(')[0].split('（')[0].strip() if hm else ''
        # ② 用名字搜索该演员所有作品（"点击先搜索所有内容"）
        shtml = self._req(self.host + f'/cn/s/page/{page}/wd/{quote(name)}/')
        vods = self._parse_videos(shtml)
        # ③ 必须过滤：只保留标题含演员名的结果，防"无结果时站点返回热门填充"
        real = [v for v in vods if name in v['vod_name']]
        if real:
            return {'list': real, 'page': page, 'pagecount': 100, 'limit': 30, 'total': 9999}
        # ④ 搜索失败回退：解析详情页作品列表（去重，详情页每部视频出现2次：桌面+移动布局）
        works = self._parse_videos(html)  # 去重 by vod_id
        return {'list': works, ...}
```

关键点：
- **父项前缀用 `dir_`（参考 404xav_用户标准版.py）或 `folder$`（小男娘）**，categoryContent 里分支处理；子项 vod_id 用正常 `v:xxx`，点子项 → detailContent → 播放
- **搜索过滤防热门**：站点搜索无结果时返回首页热门（16 条不相关），必须 `name in v['vod_name']` 过滤，否则女优作品列表被热门污染
- 详情页作品去重：每部视频在页面出现 2 次（桌面+移动两套布局），按 vod_id 去重
- 列表分块解析用 `<li class=""><div class="box">...` 逐块提取（findall 贪婪跨块会吃掉最后几部作品）
- 女优/演员详情页作品筛选（如 `?by=hits_day`）用 query 参数，翻页 `?page={pg}`（不是路径翻页）

## 本地测试方法（无海阔视界环境）

```python
# venv: uv venv + uv pip install requests pycryptodome
spec = importlib.util.spec_from_file_location("xnn", "小男娘.py")
mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
sp = mod.Spider(); sp.init()
home = sp.homeContent(False); cat = sp.categoryContent("category/wnzp","1",None,None)
det = sp.detailContent([cat['list'][0]['vod_id']]); s = sp.searchContent("伪娘",False,"1")
```
逐项断言非空：域名解析 / 首页 / 分类+页数 / 详情播放URL / 搜索 / 标签+二级 / up主。

## 实战要点

- 发布页多备选（nanniang10.com + nanniang6.com），逐个尝试，失败 continue
- 域名兜底：所有发布页失败用已知后缀
- 图片 localProxy 只代理非 http 的密文；明文 URL 直接给
- 搜索 URL encode：`urllib.parse.quote(key)`（答案版直接拼 key 也行，requests 会编码）
- 分页最大页数：`van-pagination__item--page total` 里的数字（Vant UI 分页组件）

## ⚠️ 用户答案版对齐清单（写 py 源前逐项核对，这是用户标准）

2026-08-11 用户给出加密答案版（zip 密码 123，`pyzipper.AESZipFile` 解），逐项对齐后确认以下**用户标准写法**（我的初版 vs 答案版的 8 处差异，全部已修正进 `templates/小男娘.py`）：

| # | 项 | 用户答案版标准（以此为准） | 我初版的错误 |
|---|----|--------------------------|-------------|
| 1 | AES key | `bytes.fromhex(SHA_hex)` | `.digest()`（等价但非标准） |
| 2 | 图片 | `_img_proxy()` 走 `getProxyUrl()+&url=e64+&type=img` | 直接返回明文 URL |
| 3 | 播放流 | 优先 `"video_h265"` → `"video"` → m3u8直链 → `var now/playurl` | 只找 `"video"` |
| 4 | 列表块边界 | `xqbj-list-rows-image">(.*?)xqbj-list-rows-bottom-tags-text is-mobile` 正则 | split 切块 |
| 5 | 分类URL | `{host}{cid}/{pg}/` **第一页也带页码** | 第一页省略页码 |
| 6 | 二级ID | `folder$tag_伪娘` / `folder$author_278556`（ID 形式） | folder$完整URL |
| 7 | 分类名 | 不带 📌 emoji | 带 📌 |
| 8 | 无分页分类 | `pc = pg+1 if vods else pg`（可继续翻页加载） | 返回 1 |

其他细节：
- `favorite-all`（不是 favorite）；`home` 分类 → `{host}page/{pg}/`；`date` 往期 → 独立 `_parse_date_list`
- 标题优先 `title="..."` 属性，其次 `<h3>`；副标题取 `is-desktop` 版块（桌面端显示标签）
- 详情封面兜底链：z-image-loader → og:image meta；简介：description meta → og:description
- 播放 `play_from` 用"自动档"；`vod_content` 空时回退 title
- 标签页 section 截取：`<div class="tags-group">...(.*?)<nav role="navigation"`（无 nav 时兜底到 `</div>`）
- up主解析：`<a href="/author/(\d+)/new/" class="rank-card">(.*?)</a>`，粉丝/获赞 `粉丝{N} · 获赞{N}`

**用户工作流：** 用户给"授人以渔"话术 + 参考 py（如每日大赛1.py）+ 加密答案版（zip 密码通常 123）。写完 py 后用密码解开答案版逐项 diff 对齐，而不是重新发明。加密 zip 用 `pyzipper.AESZipFile(path).read(name, pwd=b"123")`（stdlib zipfile 不支持 AES 加密方法，报 "compression method is not supported"）。
