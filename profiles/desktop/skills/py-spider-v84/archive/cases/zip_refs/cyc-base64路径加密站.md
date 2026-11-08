# 四色系站点（/cYc + base64 路径加密型）py 源开发

> 2026-08-24 四色(3).py 搜索修复实战（站点代号 R3E2O，源码见 `/opt/data/archive/xbpq资料/四色.py`）
> 这类站点：动态域名（enter.html 落地页轮询）+ 全站路径 `/cYc{base64}.html` 加密 + 字段 AES 加密

## 站点特征识别

- 列表/详情/搜索链接全部是 `/cYc` + Base64 + `.html` 形态：`/cYcL2p1cWluZy9wbGF5LTQzMzM2My5odG1s.html`
- 页面里 JS 用 `encodeString()`/`decodeString()` 处理路径，`Decrypt()`/`Encrypt()` 处理标题等字段
- 动态域名：`_DOMAIN_CANDIDATES` 列表 + GET `/enter.html` 测活（200/301/302 即采用），重定向后取 `{scheme}://{netloc}`
- 分类/路径中文片段也是 base64 编码（如 ZONE_SUB 里 `/cYcL2p1cWluZy9saXN0cy5odG1s.html` = `/juqing/lists.html`）

## 核心：encodeString 不是 AES，是 URL 编码 + Base64！

```js
function encodeString(a) {
    var rv = encodeURIComponent(a)     // URL 编码（中文转 %XX）
    rv = unescape(rv)                   // 还原成 UTF-8 字节串
    rv = window.btoa(rv)                // Base64
    return rv
}
```
Python 对应：`base64.b64encode(path.encode()).decode()` —— **直接对 UTF-8 字节做 base64，不需要额外 URL 编码**（encodeURIComponent+unescape 组合效果就是 UTF-8 字节）。

## 搜索机制（重点，原 py 的 searchContent 常是空函数）

页面 JS：`$.ajax({ url: '/cYc' + encodeString(`/search/${code}-${keyword}-${page}.html`) + '.html', method: 'GET' })`

```python
raw = f"/search/{code}-{key}-{page}.html"
enc = base64.b64encode(raw.encode()).decode()
url = self.H + '/cYc' + enc + '.html'   # → /cYcL3NlYXJjaC9qdXFpbmct6bq76LGGLTEuaHRtbA==.html
r = self.s.get(url, timeout=15, verify=False, headers={...})
d = r.json()   # 返回 JSON 数组
```

- **code 必须用具体分类**（`juqing`/`shipin`/`jingpin` 视频分类实测有效），`all` 返回空 `[]`（该站无全站搜索）——遍历 2-3 个视频分类合并结果
- 搜索响应是 **JSON 数组**，不是 HTML：`[{"id":387603, "title":"<AES密文>", "thumb":"/videos/202505/08/xxx/poster.jpg", "tags":"<AES密文>", "channel":"juqing", "insert_time":1746901698}]`
- `title`/`tags` 是 **AES 加密字段**，用站点自己的 `_py_aes_decrypt` 解（key=`IdTJq0HklpuI6mu8iB%OO@!vd^4K&uXW`，iv=`$0v@krH7V2883346`，AES-CBC，优先 Crypto 库、无库时纯 Python 实现兜底）
- `thumb` 是相对路径 → 走 `_image()` 代理（IMG_HOST + getProxyUrl 本地代理）
- 搜索关键词**明文**放进路径（`/search/{code}-{关键词}-{page}.html`），不需要加密

## 详情页 id 映射

搜索/列表的 vod_id 不直接用数字 id，而是**构造加密详情路径**：
```python
dpath = f"/{code}/play-{vid}.html"          # code 用搜索结果里的 channel 字段
denc = base64.b64encode(dpath.encode()).decode()
detail = self.H + '/cYc' + denc + '.html'
```
列表页同理：`<a class="video-item" href="/cYcL2p1cWluZy9wbGF5LTQzMzM2My5odG1s.html">` → decode 得 `/juqing/play-433363.html`。

## 播放

详情页 `var video = decodeString('...')` + `var m3u8_host = decodeString('...')`（**这俩是 base64，不是 AES**）→ 拼接 m3u8；播放走 `_hls()` 本地代理（kind=hls），localProxy 里 `kind=='img'` 时注意响应可能是 `data:image/` 前缀或直接字节流。

## 关键坑

1. **原 py 搜索经常是空函数**（`return {'list': []}`）——用户报"不能搜索"时先看 searchContent 是不是没实现
2. **请求必须 `verify=False`**（羊壳手机环境证书问题会导致请求失败 → 搜不到），加了之后羊壳里才通
3. **标题解密失败会静默丢条目**——`if not title: continue` 前先确认 `_py_aes_decrypt` 能解（批量解密 `_batch_decrypt` 一次解全部再回填，比逐条解稳）
4. 搜索结果里 `id` 是数字、`channel` 是分类名，**构造详情路径时用 channel 字段**（不是搜索时用的 code 变量）
5. 交付前测试覆盖：搜索中文关键词（麻豆/天美/星空）+ 点结果进详情 + 播放 m3u8 200；本机测通 ≠ 羊壳通（SSL/代理差异），加 `verify=False` + 调试 print（`[R3]搜索请求/响应/成功`）方便用户反馈定位
6. 页面正文"正在加载中..."= 结果 JS 动态加载，**必须在页面 JS 里找 `$.ajax` 的 URL 模板**，直接请求 search.html 拿不到结果
