# 51hub（51短剧）HLS AES-128 完整解密 + localProxy 双模式代理

> 来源：用户会话 2026-08-25，51hub.com 播放结构确认 + 51hub.py 编写
> 站点性质：静态域名 SPA 成人短剧站，反爬严格（curl 全被拦截，只有无头浏览器能拿到内容）
> 播放结构：**HLS AES-128 + `auth_key` 动态密钥 + m3u8 中明确的固定 IV**

---

## 1. 播放结构（用户确认的 m3u8 片段，2026-08-25 实测）

```
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-KEY:METHOD=AES-128,
    URI="https://tts.doudou520.online/videos5/{session_id}/crypt.key?auth_key={AUTH_KEY}",
    IV=0x8a820d65f218cc21c4e35522cd23e302
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-TARGETDURATION:6
#EXTINF:6.000,
https://tts.doudou520.online/videos5/{session_id}/{session_id}0.ts?auth_key={AUTH_KEY}
#EXTINF:4.000,
.../{session_id}1.ts?auth_key={AUTH_KEY}
```

m3u8 直链域名是 `hls.dscxru.cn`（用户 2026-08-25 实测）：
`https://hls.dscxru.cn/videos5/{sid}/{sid}.m3u8?auth_key={AK}&v=3&time=0&via=51duanju`

### 关键特征
| 项 | 值 |
|---|---|
| m3u8 域名 | **`hls.dscxru.cn`**（manifest）；分片/密钥走 `tts.doudou520.online` |
| 密钥 URI | `videos5/{session_id}/crypt.key?auth_key={AUTH_KEY}` |
| 分片 URL | `videos5/{session_id}/{session_id}{seq}.ts?auth_key={AUTH_KEY}` |
| IV | **m3u8 里明确给出** `0x8a820d65f218cc21c4e35522cd23e302` |
| **所有分片共用此固定 IV** | ✅（2026-08-25 实测：ts0/ts1/ts2 用固定 IV 解密出 0x47 MPEG-TS 头） |
| `auth_key` | 每次播放会话动态生成，前缀变化（1787631392/1787631396/1787631911 都出现过）|
| 分片时长 | 4~6 秒 |

> ⚠️ **历史纠偏（重要）**：2026-08-25 前一版误以为 HLS 标准行为是"分片 IV = 固定 IV XOR sequence"，
> 实测 ts 解密全部失败。正确做法 = **m3u8 里 IV 字段明确给出时，所有分片都直接用这个固定 IV**
> （HLS 规范允许 IV 在 #EXT-X-KEY 里固定给出，无需递增）。
> 只有当 IV 字段**未给出**时，才按 sequence 递增（0,1,2,...）。
> 判断法：看 #EXT-X-KEY 那行有没有 `IV=0x...` —— 有就是固定，没有才递增。

---

## 2. 完整解密链路（localProxy 双模式）

### 流程图

```
user 点集 → playerContent(vid|episode_id)
  → GET /drama-play?id=vid&episode_id=N&_={ts}
  → 6 种兜底正则提取 m3u8 直链
  → 返回 localProxy?type=hls&m=<base64(m3u8)>

shell 拉 localProxy type=hls
  → GET m3u8（注意 auth_key 每次不同，不能缓存）
  → 解析 #EXT-X-KEY 拿 crypt.key URL + IV
  → 下载 crypt.key（16 字节）
  → 重写所有 .ts 行 → localProxy?type=ts&m=<base64(m3u8)>&i=<seq>&u=<base64(ts_url)>
  → 返回 application/vnd.apple.mpegurl

shell 逐片拉 localProxy type=ts
  → GET ts_url
  → AES-128-CBC 解密：key=crypt.key, **iv = m3u8 里给的固定 IV**（不递增）
  → 校验 dec[0]==0x47（MPEG-TS 头），不等于则原样返回
  → 返回 video/mp2t
```

### `_extract_m3u8_from_playpage(html)` 6 种兜底

```python
def _extract_m3u8_from_playpage(self, html):
    if not html: return ""
    # 1. hls.dscxru.cn 直链（51hub 实测）
    m = re.search(r'https?://hls\.dscxru\.cn/videos5/[^\s"\'<>]+\.m3u8[^\s"\'<>]*', html)
    if m: return m.group(0)
    # 2. tts.doudou520.online 早期直链
    m = re.search(r'https?://tts\.doudou520\.online/videos5/[^\s"\'<>]+\.m3u8[^\s"\'<>]*', html)
    if m: return m.group(0)
    # 3. data-play-src 属性
    m = re.search(r'data-play-src=["\']([^"\']+\.m3u8[^"\']*)', html, re.I)
    if m: return m.group(1)
    # 4. JSON 字段 videoSrc/hlsUrl/playUrl/url/m3u8
    m = re.search(r'"(videoSrc|hlsUrl|playUrl|url|m3u8)"\s*:\s*"([^"]+\.m3u8[^"]*)"', html, re.I)
    if m: return m.group(2)
    # 5. 任意 .m3u8 字符串
    m = re.search(r'["\']([^"\']+\.m3u8[^"\']*)["\']', html)
    if m: return m.group(1)
    # 6. 只有 session_id（videos5/{32-hex}/），拼 m3u8（无 auth_key，兜底不可靠）
    m = re.search(r'videos5/([0-9a-f]{32})/', html)
    if m: return f"https://hls.dscxru.cn/videos5/{m.group(1)}/{m.group(1)}.m3u8"
    return ""
```

### `_proxy_ts` IV 固定（关键实现，2026-08-25 实测版）

```python
# AES-128 HLS：IV 字段在 m3u8 里明确给出，所有分片共用此 IV（不递增）
iv = crypto["iv"]   # 16 字节，从 #EXT-X-KEY 里取
cipher = AESCipher.new(crypto["key"], AESCipher.MODE_CBC, iv)
dec = cipher.decrypt(r.content)
# 校验：MPEG-TS 头 = 0x47
if dec[0] != 0x47:
    return [200, "video/mp2t", r.content]   # 兜底原样返回
return [200, "video/mp2t", dec]
```

> ⚠️ **不要 unpad**：HLS 分片是流式数据，解密后 raw mp2t 直接返回，用 unpad 会丢尾部数据。
> unpad 是**图片 AES 解密**用的，ts 分片别用。

---

## 3. `vod_play_url` 编码 trick（把 vid 传进 playerContent）

羊壳 `playerContent(flag, id_, flag_)` 只传 episode_id，拿不到 vod_id。
**解法**：detailContent 构造时把 vid 塞进 id：

```python
# detailContent 里：
lines.append(f"{ep_name}${vid}|{ep_id}")
vod_play_url = "#".join(lines)

# playerContent 里：
vid, ep = id_.split("|")[0], id_.split("|")[1]
url = f"/drama-play?id={vid}&episode_id={ep}&_={ts}"
```

---

## 4. 通用化：51 吃瓜/91/黄果短剧 HLS 解密同套架构

51吃瓜、91情报局、黄果短剧、51hub 这四个站用**同一套 CDN + 同套 AES-128 解密**（crypt.key + IV + auth_key 动态）。
差异只在：
- CDN 域名不同（`tts.doudou520.online` vs 其他）
- m3u8 URL 从哪拿（`data-play-src` / JSON / iframe / 直接属性）
- 图片代理要不要 AES 解密（51hub 不需要，其他可能需要）

**可复用的组件：**
- `localProxy type=hls` 重写 ts 行 → 完全通用
- `localProxy type=ts` 解密 → 完全通用（只换 crypt.key URL）
- `_extract_m3u8_from_playpage` → 按站调整正则
- `_pic` 图片代理 → 按站加/去 AES 解密

---

## 5. 51hub 站点特有（写其他 51 系站时注意的差异）

| 项 | 51hub | 51吃瓜/91/黄果 |
|---|---|---|
| 图片代理 | `/_img/base64(url)` → **base64 解码后是直链，不需 AES** | `/_img/` → AES-CBC 解密（key/iv 同一套） |
| 域名 | 静态 `51hub.com`，反爬严格 | 发布页 + 域名轮转 |
| 反爬 | curl 全拦截，只有无头浏览器能通 | 一般 UA 可通 |
| 分页 | 未确认（web_extract 没看到分页控件） | 一般 `?page=N` 或 `/page/N/` |
| 集数获取 | 未确认（SPA 渲染） | 一般详情页 `<a>` 列表 |
| 搜索结果 | SPA 渲染，不可爬 | 各异 |

---

## 8. 51hub 特殊：Cloudflare 严格反爬（服务器端 curl 全部被拦）

`51hub.com` 反爬极严：服务器端 `requests` 直连、米猫代理（`127.0.0.1:7890`）直连、execute_code 直连、`web_extract` 走无头浏览器都只有**无头浏览器能拿到真实内容**，其余全部被 CDN 拦截返回**政府站点伪装壳**（约 2200 字节的 `51hub.com` 空壳，所有 `/drama-detail/{id}/`、`/drama-play?id=&episode_id=`、`/drama/AISD/` 等页面**都返回同一个 SPA shell**）。

**结果**：服务器端完全无法验证分类/图片/播放页结构，**必须靠壳端（浏览器 UA）HTTP 抓页面**。所有调试都依赖用户导入羊壳后实测反馈。

## 9. 调试模式：shell 无法直接打印 HTML 时的诊断套路

⚠️ **场景**：反爬严 + 用户说"啥都看不到"、"简介看不到了"、"壳子不支持打印"——无法在服务器端验证，需要在壳端把抓到的 HTML 展示给用户复制。

**关键坑（51hub 实测，2026-08-25）**：

| 尝试 | 为什么失败 | 正确做法 |
|------|-----------|---------|
| 用 emoji 🐛 当卡片名 | **羊壳不支持 emoji 显示**（`rawCount:1, firstItemName:"🐛诊断:点我看HTML"` 里 emoji 会显示不出来/变方块） | 卡片名用**纯中文**：`诊断-点我看HTML` |
| 塞进首页推荐 | 首页解析失败时首页本身就空，诊断卡片也出不来 | 塞进**分类页**（用户之前确认"分类下有内容"，能保证显示） |
| 把 HTML 塞进 `vod_content` 直接返回 | `detailContent` 被点击时**会重新请求详情页**，`vod_content` 被重算覆盖 | **用实例变量 `self._debug_msg` 暂存**，categoryContent 写入，detailContent 用 `self._debug_msg or desc` 读取 |
| 用 `vod_id="debug"` | `detailContent` 请求 `/drama-detail/debug/` 不存在 → 404/报错 | 用**真实存在的 vid**（如 `vod_id="11610"`）让 `detailContent` 能进正常解析流程 |
| 塞进 `vod_remarks` | 壳只显示一小段 | 塞进 `vod_content`（简介栏可显示长文本） |

**调试模式代码骨架**（写入 51hub.py 的 init/categoryContent/detailContent）：

```python
def init(self, extend=""):
    self.host = "https://51hub.com/"
    self.DEBUG = True          # 调试开关，用户确认后改回 False
    self._debug_msg = ""       # 分类页写，详情页读

def categoryContent(self, tid, pg, filter_=None, extend=None):
    html = self._get(url)
    # 调试模式：在分类页第一张卡片塞 shell 抓到的原始 HTML
    if getattr(self, "DEBUG", False) and html and len(html) > 200:
        idx = html.find("<img")
        first_img = html[max(0, idx-200):idx+400] if idx > 0 else "[无img]"
        card = ""
        for key in ("/drama-detail/", "drama-play"):
            k = html.find(key)
            if k > 0:
                s = html.rfind("<a", 0, k)
                e = html.find("</a>", s) if s >= 0 else -1
                card = html[s:e+4] if (s >= 0 and e > 0) else html[max(0,k-100):k+400]
                break
        if not card: card = html[:600]
        msg = "shell抓到的分类页HTML(复制发Hermes修图):\n\n"
        msg += "===前800字===\n" + html[:800] + "\n\n"
        msg += "===卡片<a>===\n" + card + "\n\n"
        msg += "===图片<img>===\n" + first_img + "\n"
        self._debug_msg = msg   # 存到实例变量
        return {"list": [{"vod_id": "11610",   # 真实存在的 vid
                          "vod_name": "诊断-点我看HTML",  # 纯中文！不用 emoji
                          "vod_pic": "", "vod_content": msg,
                          "vod_remarks": "诊断"}],
                "page": pg, "pagecount": 1, "limit": 60, "total": 0}
    return {"list": self._parse_list(html), "page": pg, "pagecount": 1, "limit": 60, "total": 0}

def detailContent(self, ids):
    ...
    "vod_content": self._debug_msg or desc,   # 调试时显示 shell 抓到的 HTML
```

**诊断内容三段**（用户复制回来就能定位图片/播放/标题任一问题）：
1. `===前800字===` — 页面整体结构
2. `===卡片<a>===` — 列表卡片完整 HTML（定位标题/图片格式）
3. `===图片<img>===` — 图片 tag 块（定位是 `/_img/base64` 还是相对路径还是直链）

拿到 HTML 片段后立刻把 `self.DEBUG` 改回 `False` 重新导入，就是正式版。

## 10. 已知未确认项（写源时需用户配合）

1. **m3u8 URL 从播放页的具体结构**（_extract_m3u8_from_playpage 的正则是否命中，需实测验证）
2. **集数列表怎么拿**（`episode_id` 序列怎么得到，是遍历还是 API）
3. **分页逻辑**（51hub 分类页有没有翻页）
4. **搜索结果页**（51hub 搜索是 API 还是 SPA 表单调取）
5. **图片代理格式**（`/_img/base64` 还是 `data-src` 相对路径还是直链——服务器端看不到，必须 shell 实测）

以上五项都需要 shell 端实测后反馈，无法在服务器端验证（反爬太严）。用第 9 节的调试模式让壳端把原始 HTML 展示给用户。

---

## 11. 交付文件与已知未验证项

- `/opt/data/out/51hub.py`（调试版，`DEBUG = True`，分类页第一个卡片显示 shell 抓到的原始 HTML 片段；用户拿到 HTML 后改 `DEBUG=False` 即正式版）
- HLS AES-128 解密链路：服务器端实测通过（m3u8 200 / crypt.key 16 字节 / ts0-2 解密出 0x47 MPEG-TS 头）✅
- 语法验证：`python3 -m py_compile 51hub.py` ✅

依赖：`requests` / `lxml` / `pycryptodome`（Crypto.Cipher.AES）。pycryptodome 是 51吃瓜/91/黄果同款依赖，羊壳通常自带。

### 已知需要 shell 端实测验证的项（用第 9 节调试模式收集 HTML）

| # | 项 | 状态 | 验证方式 |
|---|---|---|---|
| 1 | 首页推荐数据 | 待测 | 打开壳看首页推荐 |
| 2 | 标题带"原创"前缀/tag串/播放量 | 已写 `_clean_title` | 导入看标题 |
| 3 | 图片代理格式 | **待 shell 实测** | 调试模式拿 HTML 后修 |
| 4 | 集数列表 | 已扩 6 种探测 | 点详情看集数 |
| 5 | 播放正则命中 | 6 种兜底 | 调试模式拿播放页 HTML 后验证 |
