# XBPQ → 海阔视界 py 源转换方法论（用户实战验证）

> 用户工作流：XBPQ JSON 规则 → 海阔视界 py 源（`base.spider.Spider`）。
> 用户会发 xbpq 文件 + 参考 py（如每日大赛1.py/小男娘.py）+ 话术，要求转换。
> 本文件是转换时的**必查清单**——所有坑都来自用户实测反馈（"打开没数据"、"只有推荐页"、"每个视频20集"）。

## 0. 参考模板（先读再写）

- `templates/小男娘.py` — 用户验证过的标准答案（含 _img_proxy/getProxyUrl 模式）
- `templates/sexcnx.py` — 直接播放 + data-preview + js.php 动态播放
- `templates/404xav.py` / `templates/truvaze404.py` — 域名轮询 + play_data 解密 + 双源合一
- 结构：init(发布页/UA/headers/session/域名解析/classes) → _req → _parse_xxx → 各 Content 方法 → playerContent/localProxy/e64/d64

## 1. 致命坑（用户实测报错）

### ① 必须继承基类（否则"打开没数据"）
```python
from base.spider import Spider   # 必须
class Spider(Spider):            # 必须继承，裸 class Spider: 不被海阔视界识别
```
这是"打开没数据"最常见根因——源加载直接失败。

### ② filters 必须是 dict（否则"只有推荐页"）
```python
# ❌ 错误：list
"filters": [{"key": "type", "name": "类型", "value": [...]}]
# ✅ 正确：dict，key=筛选key，value=该key的选项列表
"filters": {"type": [...], "rq": [...]}
# 选项格式: {"key": "by", "name": "排序", "value": [{"n": "点赞", "v": "favorite"}, ...]}
```

### ③ vod_id 用页面链接，不用直链（否则"无法播放"）
- ❌ `vod_id = m3u8直链` → 海阔视界把 m3u8 当详情页请求 → 解析失败
- ✅ `vod_id = 页面链接`（如 `/?play-277272-1-.html`），detailContent 请求页面解析出播放地址
- 兼容：detailContent 开头检测 `.m3u8`/`.mp4` 直链则直接返回播放（防旧缓存）

### ④ 详情页播放地址 = 当前视频的，不是页面全部
- "每个视频20集"根因：`re.findall(r'https?://...m3u8', html)` 抓了页面所有推荐位 m3u8
- 正确：找**动态加载源**（js.php / contentUrl / play_data），失败才 fallback 嗅探
- 广告过滤黑名单：`["ads.", "adc.php", "doubleclick", "googleadservices"]`

## 2. 播放地址获取（按优先级）

| 站点类型 | 锚点 | 方法 |
|---------|------|------|
| sexcnx | `<script src="js/js.php?did=ID">` | 请求 js.php → `m3u8=([^&\s"']+)` |
| truvaze | `"contentUrl":"&&",` | 正则直接提取 |
| 404 系 | `var play_data = "..."` | base64 + raw deflate 解密 → JSON.video |
| 通用 fallback | video/source 标签 | `<video[^>]+src=...` / `<source...` |

**play_data 解密（关键：raw deflate，wbits=-15）：**
```python
import base64, zlib, json
raw = base64.b64decode(pd)
d = zlib.decompressobj(-15)          # pako 默认 raw deflate，无 zlib 头
data = json.loads(d.decompress(raw).decode('utf-8', errors='ignore'))
play_url = data["video"]             # {"info":[标题,封面,时长],"video":"...m3u8","author":"...","frame":1}
```

## 3. _fix_url 必须处理无斜杠相对路径

```python
def _fix_url(self, url):
    url = url.replace('\\/', '/').replace('&amp;', '&')
    if url.startswith('//'): return 'https:' + url
    if url.startswith('/'): return self.host.rstrip('/') + url
    if url.startswith('http'): return url
    return self.host.rstrip('/') + '/' + url.lstrip('/')   # 关键！js/js.php 这类无前导/的相对路径
```
漏掉最后一行 → js.php 请求失败 → 播放地址拿不到。

## 4. 列表块解析：按分隔符 split 优于复杂正则

```python
# 用 <div class="cell_box..."> 或 <div class="relative overflow-hidden"> 作分隔符
parts = re.split(r'<div class="cell_box[^"]*">', html)
for part in parts[1:]:
    link = self._extract_one(part, r'<a href="([^"]*)"')
    ...
```
- 正则边界容易踩：额外 class（`cell_box clf_a`）、HTML 注释（`<!-- xxx -->`）、`</span><span>` 间隔
- split 天然免疫这些变化；每块内独立提取字段
- 注意：**多站点合一**时，各站点列表结构不同 → 各自独立 parse 函数 + 传 site_host 参数拼链接（truvaze 系的相对路径绝不能拼到 404 域名）

## 5. 动态域名（自动挡核心）

### 404 系轮询（两种格式 + 数字前缀）
```python
# 发布页源码: const urls = [\n 'https://4042604.one', 'https://4042604.pro',
# 格式1（第一个域名，* 吃掉换行空格）
re.search(r"const urls\s*=\s*\[\s*'([^']+)'", html, re.S)
# 格式2（第二个域名）
re.search(r"const urls\s*=\s*\[\s*'[^']*'\s*,\s*'([^']+)'", html, re.S)
# 前缀 + 域名
prefix = "".join(random.choices("0123456789", k=4))
self.host = "https://" + prefix + "." + domain
```
- 发布页全失败 → 用已知域名兜底（必须仍加前缀！否则裸域名访问不了）
- 用户要求"5秒内无数据自动切换另一格式" → 每发布页 timeout=8，遍历 publish_urls

### 其他动态域名模式（见 SKILL.md 动态域名章节）
重定向 `[工具:重定向]` / words.random 后缀 / AES 解密 / Base64 两步

## 6. 细节清单

- **标题 HTML 实体**（`&#x5077;`）→ `html_parser.unescape()`（import html as html_parser）
- truvaze 系无文字标题 → 用 `<img alt="...">` 属性
- 观看数/时长 → remarks 拼接（`"00:04:56 👀388"`）
- 测试用 stub 基类：`sys.modules["base.spider"]` 注入空 Spider 类即可本地跑
- 测试环境 DNS 故障会误报"0条"——先确认不是代码问题（换已知可用域名直连验证）
- 每个视频验证 1 集 + m3u8/mp4 实测 HTTP 200 再交付

## 7. 交付流程（用户偏好）

1. 写 py → stub 测试全流程（首页/分类/筛选/详情/播放/搜索）
2. 验证播放地址实测可访问（HTTP 200）
3. 清理测试文件、同步技能库 templates/、发送 `MEDIA:` 文件
4. 用户反馈问题 → 对照本文档清单排查（继承/filters/vod_id/播放源/相对路径）
