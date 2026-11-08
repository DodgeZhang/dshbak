# TVBox Spider 开发规范（修复兼容版）

版本：v2.1
适用：WebHomeTV、影视仓、OK影视、PickTV、PeekPro 及兼容 FongMi Spider 接口的 TVBox 壳。

## 一、核心加载契约

交付文件必须包含：

```python
class Spider:
    pass
```

必须满足：

- 类名必须是 `Spider`。
- `Spider()` 必须能够无参数实例化。
- 不要写 `class Spider(Spider)`。
- 不要导入并继承 `from base.spider import Spider`。
- `init()` 由宿主在无参实例化后单独调用。
- 代码必须可以被 `SourceFileLoader(...).load_module().Spider()` 加载。
- 文件顶层不能依赖宿主未提供的自定义模块。

推荐的最小结构：

```python
import re
import json
from urllib.parse import urljoin, quote

try:
    import requests
except ImportError:
    requests = None


class Spider:
    def __init__(self):
        pass
```

## 二、必需接口

以下接口必须存在，参数必须兼容宿主调用：

```python
def getDependence(self):
    return []

def init(self, extend=""):
    pass

def homeContent(self, filter=None):
    return {"class": [], "filters": {}}

def homeVideoContent(self):
    return {"list": []}

def categoryContent(self, tid, pg=1, filter=None, extend=None):
    return {"list": [], "page": 1, "pagecount": 1}

def detailContent(self, ids):
    return {"list": []}

def searchContent(self, key, quick=False, pg="1"):
    return {"list": [], "page": 1, "pagecount": 1}

def playerContent(self, flag, ids, vipFlags=None):
    return {"parse": 1, "jx": 0, "playUrl": "", "url": "", "header": {}}

def localProxy(self, param):
    return [404, "text/plain", b"Not Found", {}]

def manualVideoCheck(self):
    return False

def isVideoFormat(self, url):
    return False

def action(self, action):
    return {}

def destroy(self):
    return None
```

`getDependence()` 很重要，宿主初始化时可能在 `init()` 前调用；缺少它会直接初始化失败。

`homeVideoContent()` 也必须存在。部分壳会无条件调用它，并在返回的 `list` 非空时覆盖首页列表。

## 三、参数兼容规则

### 1. extend

`extend` 可能是空字符串、URL、字典或 JSON 字符串，必须兼容：

```python
if isinstance(extend, str) and extend.strip().startswith("{"):
    try:
        extend = json.loads(extend)
    except Exception:
        extend = {}
if not isinstance(extend, dict):
    extend = {}
```

### 2. ids

`detailContent()` 和 `playerContent()` 的 ID 可能是字符串、列表或元组：

```python
if isinstance(ids, (list, tuple)):
    vid = str(ids[0]) if ids else ""
else:
    vid = str(ids or "")
```

### 3. localProxy 参数

Chaquopy 和部分壳可能传入字典，也可能传入 JSON 字符串：

```python
if isinstance(param, str):
    try:
        param = json.loads(param)
    except Exception:
        param = {}
if not isinstance(param, dict):
    param = {}
```

## 四、标准返回值

### homeContent

```python
{
    "class": [
        {"type_id": "1", "type_name": "电影"}
    ],
    "filters": {}
}
```

筛选器格式：

```python
{
    "1": [
        {
            "key": "area",
            "name": "地区",
            "value": [
                {"n": "全部", "v": ""},
                {"n": "中国", "v": "中国"}
            ]
        }
    ]
}
```

### categoryContent

列表项目至少包含：

```python
{
    "vod_id": "123",
    "vod_name": "片名",
    "vod_pic": "https://example.com/a.jpg"
}
```

推荐返回：

```python
{
    "list": [],
    "page": 1,
    "pagecount": 1,
    "limit": 20,
    "total": 20
}
```

所有列表必须使用 `seen_ids` 或等价集合去重。

### detailContent

```python
{
    "list": [{
        "vod_id": "123",
        "vod_name": "片名",
        "vod_pic": "https://example.com/a.jpg",
        "vod_content": "简介",
        "vod_play_from": "线路一$$$线路二",
        "vod_play_url": "第一集$地址1#第二集$地址2$$$第一集$地址3"
    }]
}
```

分隔符必须严格遵守：

- 多线路：`$$$`
- 多集：`#`
- 集名和地址：`$`

列表接口不要提前写入播放地址，否则部分壳会跳过详情页，直接进入播放流程。

### playerContent

正确格式：

```python
{
    "parse": 0,
    "jx": 0,
    "playUrl": "",
    "url": "https://cdn.example.com/video/index.m3u8",
    "header": {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://example.com/"
    },
    "format": "application/x-mpegURL"
}
```

硬性要求：

- `header` 必须是字典，不能是字符串。
- m3u8 使用 `format: application/x-mpegURL`。
- 直链播放使用 `parse: 0`、`jx: 0`。
- 需要解析器时使用 `parse: 1`。
- 播放主 URL 应返回绝对 URL。
- 不要把 `proxy://` 直接当作播放器主播放地址；需要本地代理时应转换为 `http://127.0.0.1:端口/proxy?...`。

错误示例：

```python
{"header": "User-Agent: Mozilla/5.0\\r\\nReferer: https://example.com/"}
```

### localProxy

标准返回格式：

```python
[状态码, MIME类型, body, header字典]
```

例如：

```python
[200, "application/vnd.apple.mpegurl", playlist_bytes, {
    "Access-Control-Allow-Origin": "*"
}]
```

规则：

- 图片、m3u8、媒体内容推荐返回 `bytes`。
- 不要返回 `BytesIO`、文件对象或自定义流对象。
- 错误也应返回四项结构。
- m3u8 MIME 推荐使用 `application/vnd.apple.mpegurl` 或 `application/x-mpegURL`。
- 代理请求必须带 User-Agent 和 Referer。

## 五、请求与降级

建议维护三个会话别名：

```python
self.s = session
self.session = session
self.sess = session
```

requests 不可用时必须提供 urllib 降级，至少支持 GET：

```python
try:
    import requests
except ImportError:
    requests = None
```

请求头建议包含：

```python
{
    "User-Agent": "Mozilla/5.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": host + "/"
}
```

统一使用 `urljoin()` 处理相对地址：

```python
def fix_url(url, host):
    if not url:
        return ""
    if url.startswith("//"):
        return "https:" + url
    return urljoin(host.rstrip("/") + "/", url)
```

## 六、HTML 提取规则

- XPath 或 CSS 选择器不要依赖完整 class 精确匹配。
- class 应优先使用包含匹配。
- 关键字段至少准备两级以上兜底。
- 单条数据解析必须使用异常隔离，不能因一条坏数据中断整页。
- 读取 HTML 属性时兼容 `src`、`data-src`、`data-original`。
- 解析结果为空时使用空字符串，不要让 `None` 进入返回 JSON。
- 标题使用 HTML 反转义并清理标签。
- URL 必须统一绝对化。
- 列表必须去重。

推荐正则写法：

```python
r'<img[^>]*(?:src|data-src|data-original)=["\']([^"\']+)'
```

## 七、MacCMS 识别

### MacCMS v8

常见地址：

- 分类：`/frim/index{id}.html` 或 `/search.php`
- 详情：`/movie/index{ID}.html`
- 播放：`/play/{ID}-{源序号}-{集序号}.html`
- 播放变量：`now`、`m3u8_url`

### MacCMS v10

常见地址：

- 分类：`/index.php/vod/show/id/{id}/page/{pg}`
- 详情：`/index.php/vod/detail/id/{ID}.html`
- 播放：`/index.php/vod/play/id/{ID}/sid/{sid}/nid/{nid}.html`
- 搜索：`/index.php/vod/search.html?wd={关键词}&page={pg}`
- 播放变量：`player_data`、`player_aaaa`

提取播放器对象时必须使用括号/大括号平衡扫描，不能简单使用贪婪正则吞掉整页脚本。

## 八、播放链接处理

按以下顺序尝试：

1. 播放对象中的 `url`、`url_next`、`src`。
2. 页面中的绝对 m3u8/mp4/flv 地址。
3. iframe 地址的二次请求。
4. 播放器 JSON 或 JS 变量。
5. 最后才返回解析器地址。

播放 URL 处理必须兼容：

- `http://`、`https://`
- `//cdn.example.com/a.m3u8`
- `/vod/a.m3u8`
- JSON 转义的 `https:\/\/...`
- 带 query、token、sign、expires 的地址

不要随意删除播放 URL 的 query 参数。

## 九、m3u8 代理规则

只有在目标站点需要防盗链、签名续期、清洗广告或重写分片地址时才使用 `localProxy()`。

清洗 m3u8 时：

- 保留 `#EXTM3U`。
- 保留 `#EXT-X-*` 控制标签。
- 不要无条件删除所有短片段。
- 不能破坏 `#EXT-X-KEY`、`#EXT-X-MAP`、`#EXT-X-MEDIA-SEQUENCE`。
- 分片地址必须绝对化或使用播放器可解析的同端口绝对路径。
- 保留 token、签名、过期时间等 query 参数。

## 十、反爬与加密

反爬处理必须基于实际探测结果，不得凭经验伪造 Cookie 或签名。

常见情况：

- Cloudflare/WAF：优先报告需要浏览器或住宅网络验证。
- Base64：确认解码层数后再解码。
- AES：确认 key、iv、模式和 padding。
- XOR：确认密钥和结果文件头。
- gzip：根据魔数或响应头判断。
- eval/混淆 JS：只有具备可靠执行环境时才执行。

不应把不能验证的加密算法直接写进通用生成器。

## 十一、探测与生成流程

### 探测顺序

1. 首页和分类导航。
2. 分类第一页列表。
3. 列表详情页。
4. 搜索页或搜索接口。
5. 播放页及真实播放 URL。
6. 至少验证一次 m3u8 主清单和分片响应。

### 生成前判断

- 网站不可访问：报告网络、域名或 WAF 问题。
- 详情页不可访问：不要假装生成可播放 Spider。
- 播放页没有真实媒体地址：标记为待解析或需浏览器嗅探。
- 只能拿到 HTML：不能把 HTML 地址当成 m3u8 返回。
- 任何关键项失败时，应在源码中保留明确兜底，但不能宣称播放已验证。

## 十二、验证清单

生成后必须执行：

```python
import json
import py_compile
import importlib.util

py_compile.compile(path, doraise=True)
```

契约测试至少包括：

1. 无参实例化 `Spider()`。
2. `getDependence()`。
3. `init("")`。
4. `homeContent(False)`。
5. `homeVideoContent()`。
6. `categoryContent("1", "1", False, {})`。
7. `detailContent(["1"])`。
8. `searchContent("测试", False, "1")`。
9. `playerContent("线路", "1", [])`。
10. `localProxy({"url": ""})`。
11. `manualVideoCheck()`。
12. `action("")`。
13. `destroy()`。

检查结果：

- 所有普通接口返回值必须可 JSON 序列化。
- `playerContent().get("header")` 必须是 `dict`。
- `localProxy()` 必须返回长度为 4 的列表。
- `localProxy()[2]` 媒体内容应为 `bytes` 或宿主明确支持的字符串。
- 不能出现 `class Spider(Spider)`。
- 不能出现 `from base.spider import Spider` 并将其作为交付类。
- 必须真实检查播放 URL，而不是只检查源码字符串。

## 十三、代码风格

- 允许必要注释，禁止用“零注释”作为硬性规则；复杂加密、代理、签名逻辑必须说明。
- 不要求生成文件包含 `__main__` 测试块；验证代码应放在独立测试脚本中。
- import 尽量最小化，但不能为了少 import 删除 urllib 降级或必要解析模块。
- 不使用裸 `except:`，优先使用 `except Exception:`。
- 不打印 Cookie、Token、API Key 等敏感信息。
- 不把真实密钥硬编码进通用模板。

## 十四、交付格式

每次交付建议包含：

1. 站点分析：CMS、域名、列表、详情、搜索、播放结构。
2. 源码文件：可下载的 `.py` 文件。
3. 验证结果：编译、实例化、接口、播放地址、分片状态。
4. 使用方式：适用的 TVBox 壳、源码 URL 形式、特殊依赖。
5. 已知限制：WAF、登录、Cookie、签名过期、仅浏览器可用等。

不要把规范文档、生成器脚本和最终 Spider 混为同一个文件交付。

## 十五、最终自检

交付前确认：

- [ ] 文件包含 `class Spider:`。
- [ ] 可以无参实例化。
- [ ] 没有继承宿主 `base.spider.Spider`。
- [ ] 有 `getDependence()`。
- [ ] 有 `homeVideoContent()`。
- [ ] 所有接口参数有兼容默认值。
- [ ] `header` 是字典。
- [ ] m3u8 有正确 MIME。
- [ ] `localProxy()` 返回四项。
- [ ] 列表去重。
- [ ] 相对 URL 已绝对化。
- [ ] 播放 URL 已实际验证。
- [ ] 未把 HTML、iframe 或错误页当成媒体地址。
- [ ] 已记录未验证项目和运行限制。
