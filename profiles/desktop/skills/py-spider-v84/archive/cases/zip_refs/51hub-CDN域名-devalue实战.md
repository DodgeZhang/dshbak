# 51hub 实战终版（2026-08-25）— CDN 域名 + NUXT_DATA + 图片 AES

> 前一版参考 `nuxt-ssr-devalue-py源.md` 基于首次反爬分析写成，本文件是**用户实测可播放的最终结论**，两处旧结论已被推翻（见文末"旧参考修正"）。可用成品 `templates/51hub.py`（491 行，全链路验证通过）。

## 站点多域名现实

| 域名 | 状态 | 说明 |
|------|------|------|
| `51hub.com` | ❌ Cloudflare 反爬 | 所有非浏览器请求返回 2206 字节政府伪装页 |
| `adjust.cbpjoocbe.com` | ✅ **CDN 直连域，能用** | 165KB 完整 NUXT_DATA；**DNS 间歇性抖动**（解析成功但请求失败，重试又通） |
| `87fe4.odyewhhxh.cc` | ❌ DNS 解析失败 | 备用域名已死 |

**核心教训：主域名被反爬 ≠ 全部域名被反爬。** 用户旧 py 里的 `self.host`（adjust.cbpjoocbe.com）就是可用域名——**用户给的旧 py 里的 host 是第一手线索，先测它再测主域名**。我当时先测 51hub.com 失败就宣布放弃，浪费了整轮。先读用户旧 py / 用户截图里的全部域名逐个测活。

## 请求层：DNS 抖动重试

```python
def _get(self, url):
    if not url.startswith("http"):
        url = self.host + url
    for attempt in range(3):
        try:
            r = self.session.get(url, timeout=15, verify=False)
            if r.status_code == 200:
                return r.text
        except Exception:
            pass
        time.sleep(0.5)
    return ""
```
每次请求最多 3 次重试（DNS 偶发 NameResolutionError 是常态，不是站点挂了）。

## 列表解析：card img 是占位符，真实封面在 NUXT_DATA

卡片 `<img src="data:image/gif;base64,R0lGOD...">` 是**懒加载占位符**，没有真实图。
**正确姿势：先从 `__NUXT_DATA__` 解析出全部带 `video_id`+`cover` 的对象建映射，再按卡片 vid 回填**：

```python
cover_map = {}
nuxt = self._extract_nuxt(html)
if nuxt:
    arr = self._devalue_parse(nuxt)
    for item in arr:
        if isinstance(item, dict) and item.get("video_id") and item.get("cover"):
            cv = item["cover"]
            if isinstance(cv, str) and cv.startswith("http"):
                cover_map[str(item["video_id"])] = cv
# 然后 fit 卡片: pic = cover_map.get(vid, "")
```

## 卡片 href 两种格式（首页 vs 分类页）！

- 首页卡片：`<a href="/drama-detail/{vid}/">`
- 分类页卡片：`<a href="/drama-play?id={vid}&amp;episode_id=0">`（**带 `&amp;episode_id=0` 后缀**）

```python
pat = re.compile(r'<a[^>]*href="(?:/drama-detail/(\d+)/|/drama-play\?id=(\d+)[^"]*)"[^>]*>(.*?)</a>', re.S)
vid = m.group(1) or m.group(2)
```
⚠️ **正则坑**：`/drama-play?id=(\d+)` 后面直接跟 `"` 匹配不到——id 后面还有 `&amp;episode_id=0`，必须 `(\d+)[^"]*`。

## 详情页：集数用真实 episode id（不是 0 起序号！）

详情页 NUXT_DATA 视频对象：
```python
obj = { ... "video_id":11610, "title":..., "cover":...,
        "episodes":[{"id":744007,"title":"XX-第01集"}, {"id":744008,...}, ...],
        "play_url":"https://hls.dscxru.cn/...m3u8?auth_key=...&via=51duanju" }
```
- `episodes` 数组每项的 `id` 是**真实集 id**（744007/744008...）
- 播放串格式：`标题$剧vid:集id`（冒号分隔，playerContent 拆分）

## 播放页：每集独立 m3u8 明文直出

`/drama-play?id={剧vid}&episode_id={集id}`（**必须两个参数**，只传集 id 返回 0 m3u8）：
- 响应 HTML 里有**明文 `https://hls.dscxru.cn/...m3u8?auth_key=...`**（不需 NUXT_DATA、不需解密、不是 `\u002F` 转义）
- 正则 `re.search(r'https://[^"\s<>]*\.m3u8[^"\s<>]*', html)`
- **每集 URL 不同**（不同 hash 目录），auth_key 每请求刷新 → 必须在播放点击瞬间实时请求，不能缓存
- episode_id=1（假序号）返回 0 个 m3u8；episode_id=744007（真实 id）返回 1 个 → **用真实集 id**

## 图片：直链下载但内容是 AES 加密的！

旧参考说"cover 是直链不需要解密"→ **实测推翻**：
- URL 是直链 `pic.xustgq.cn/...png`，但下载内容前 8 字节 `dde28c474c272d2d`（非 JPEG/PNG 魔数）
- AES-CBC 解密（**key=`f5d965df75336270` / iv=`97b60394abc2fbe1`，与 51吃瓜/91jav/黄果同一套密钥**）→ `89504e47` = PNG 魔数 ✅
- localProxy 下载 → 明文魔数检测 → 解密 → 魔数检测 → 返回

```python
def localProxy(self, params):
    if params.get("type") != "tbr_img":
        return [404, "text/plain", "not found"]
    img_url = base64.b64decode(unquote(params.get("url", ""))).decode("utf-8")
    r = self.session.get(img_url, headers=self.headers, timeout=20, verify=False)
    data = r.content
    if data[:3] == b"\xff\xd8\xff": ...   # 明文直接返回
    if data[:4] == b"\x89PNG": ...
    # 否则 AES 解密
    length = len(data) // 16 * 16
    cipher = AES.new(self.img_aes_key.encode(), AES.MODE_CBC, self.img_aes_iv.encode())
    dec = cipher.decrypt(data[:length])
    # 再去 PKCS7 padding 后检测魔数返回
```

**判定链：Content-Type=binary/octet-stream + 前 4 字节非魔数 = 内容加密，不是防盗链。** 带不带 Referer 内容一致。

## devalue 解析：引用可向前指向

`["ShallowReactive",1]` 中的 `1` 是**向前引用**（指向更靠后的元素）——半解析式 `_res(arr, v)` 只处理向后引用，向前引用会失败。**必须两遍**：
1. 第一遍 tokenize 出 raw 数组（整数保留原样）
2. 第二遍递归 resolve（`if isinstance(v,int) and 0<=v<len(raw)` → 查 raw；dict/list 递归），带 `cache` + `depth>50` 防环

完整可用解析器在 `templates/51hub.py` 的 `_devalue_parse`。

## 搜索

`/search?wd={关键词}` GET，返回 drama-play 卡片——直接用同一 `_parse_cards` 复用。

## 旧参考修正（nuxt-ssr-devalue-py源.md）

1. ❌ "cover 直链不需 AES 解密" → ✅ **下载内容 AES 加密**（key/iv 同上，三站通用套件），py 必须 localProxy 解密
2. ❌ "episode_id 用 0 起序号" → ✅ **用真实集 id**（episodes 数组每项的 `id`），播放页 URL 两个参数缺一不可
3. ❌ 主域名测活失败即放弃 → ✅ **先测用户旧 py / 截图里的全部域名**，CDN 域名常幸免于反爬