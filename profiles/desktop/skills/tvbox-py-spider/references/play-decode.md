# 播放解析与 CMS 识别速查（spider-create v3.0 精华）

实战沉淀：90% 的播放问题源于 parse 参数配错。先简后繁，能跑不折腾。

## 1. parse 参数三模式

| parse | 含义 | 适用 |
|---|---|---|
| 0 | url 是直链，客户端直接播 | 实测确认的 m3u8/mp4/flv/mp3（响应头/内容验证） |
| 1 | url 是网页，交给内置嗅探或外部解析器 | MacCMS 播放页（/vodplay/、/play/、.html）、需要嗅探的页面 |
| 2 | webview 加载 url 自动嗅探 | 必须执行 JS 才有直链（仅 TVBox/影视仓 v2.0+） |

### 黄金法则：MacCMS 站一律先试 parse=1

播放 URL（`/vodplay/4624-1-1.html`）本身是网页不是直链。parse=1 后客户端会自动处理 encrypt=3、jsjiami 混淆等，**不要自己解密**。在线之家源码验证：核心实现就是 `return {"parse": 1, "url": url, "header": self.headers}`。

决策流程：

```
播放URL
├─ m3u8/mp4 直链（已验证 #EXTM3U/媒体字节）？      → parse=0
├─ 网页路径（/play/、/vodplay/、.html）？           → parse=1（MacCMS 标准做法）
├─ 需要特殊 header/cookie？                         → parse=1 + header
└─ 客户端无法解析
    ├─ iframe 嵌套 → 二次请求 iframe 提取直链       → parse=0
    └─ JS 加密 → 先 parse=1 试，失败再逆向           → parse=0
```

检测到 encrypt/player_aaaa/xgplayer 标识时的优先级：**parse=1 零成本先试 → debug_play_link 分析 → 外部解析 API → 最后才逆向 JS**。

## 2. CMS 识别决策树

### URL 特征

| 特征 | CMS | 处理 |
|---|---|---|
| `/frim/index`、`/search.php?searchtype=5` | MacCMS v8 | v8 骨架（POST 搜索、`var now`），见 maccms.md |
| `/index.php/vod/show`、`/vod/detail` | MacCMS v10 标准 | 先验证 API，可用走 API，不可用走页面 |
| `/vodshow/`、`/voddetail/` | MacCMS v10 非标 | 页面爬取骨架，手动 categories/filters |
| `/api.php/provide/vod` | 采集 API | 先验证再用 api.py 骨架 |
| `wp-content` | WordPress | 自定义 |
| `/templets/` | 织梦 | 自定义 |
| 无特征 | 自定义站 | 深度 HTML 分析或 API 逆向 |

### API 可用性验证（强制，555电影教训）

识别为 MacCMS 后必须 GET `/api.php/provide/vod/`（10s 超时）：返回有效 JSON 才用 API 骨架；超时/404/空/格式错一律页面爬取骨架（手动 categories + filters + make_page_url）。跳过验证直接套 API 骨架 = 交付不可运行代码。

### HTML 结构检查顺序

分类导航（type_id/type_name）→ 列表区选择器（三级兜底）→ 详情页信息+播放源 → 播放页 JS 的 m3u8 提取正则 → 筛选区（地区/年份/排序）。

### 加密/特殊架构识别

| JS/页面特征 | 类型 |
|---|---|
| CryptoJS.AES | AES，提 key/iv 用 Python 复现 |
| XOR/位运算 | XOR，提 key |
| RSA.encrypt/JSEncrypt | RSA 签名链 |
| iframe 播放器 | 二次请求 iframe src |
| sign 参数 | 抓包逆向签名算法（HMAC 见各签名站案例） |
| 图片在加密 data 属性 | 翻页/代理取原图 |
| `__NUXT_DATA__`/`_payload.js` | Nuxt 站，走 strategies/nuxt_devalue_api.md |

## 3. 懒加载属性优先级（a123tv 教训，强制）

只查 `src` 会丢掉全部播放链接和封面。

```
图片: data-original > data-src > data-lazyload > data-lazy-src > src
播放: data-src > data-url > data-play > href > src
```

## 4. Cloudflare/5 秒盾处理

1. 首选浏览器渲染（browser 工具/visit_web）拿 html + cf_clearance cookie，再带 cookie 请求
2. 桌面 UA 直通（部分站只对移动 UA 出盾）
3. 仍不行走 strategies/proxy_network.md；HTML 403 但 `/api/` 返回 JSON 时 API 优先、HTML 兜底

## 5. 通用加密代码片段

```python
# AES-CBC 解密（图片/标题/响应加密通用）
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
import base64
def _aes_decrypt(data, key, iv=b"0000000000000000"):
    try:
        cipher = AES.new(key.encode() if isinstance(key, str) else key, AES.MODE_CBC,
                         iv.encode() if isinstance(iv, str) else iv)
        return unpad(cipher.decrypt(base64.b64decode(data)), AES.block_size).decode("utf-8")
    except Exception:
        return data

# XOR 解密
def _xor_decrypt(data, key):
    k = key.encode() if isinstance(key, str) else key
    b = data.encode() if isinstance(data, str) else data
    return bytes(x ^ k[i % len(k)] for i, x in enumerate(b)).decode("utf-8", errors="ignore")

# iframe 二次提取
def _parse_iframe(self, html):
    m = re.search(r'<iframe[^>]+src=["\']([^"\']+)', html)
    if m:
        txt = self._get(self._fix(m.group(1)))
        if txt:
            mm = re.search(r'(https?://[^\s"\']+\.m3u8[^\s"\']*)', txt)
            return mm.group(1) if mm else None
    return None
```

AES-ECB 整包加密 API（octet-stream + 信封 + 密文响应 + 自定义头）完整范例见本仓库 `webhome/Python/凡客TV.py`。HMAC 签名 API 范例见 `haitun/ext/看剧AI19.py`。AES/RSA APP 接口范例见 `xiaosa/PY/火车影视.py`。

## 6. 通用工具方法

```python
def _fix(self, u):
    if not u: return ""
    if u.startswith("//"): return "https:" + u
    if u.startswith("/"): return self.host + u
    return u

def _extract_m3u8(self, html):
    for p in [r'var\s+now\s*=\s*["\']([^"\']+\.m3u8[^"\']*)',
              r'var\s+player_data\s*=\s*(\{.*?\})',
              r'url:\s*["\']([^"\']+\.m3u8[^"\']*)',
              r'var\s+playurl\s*=\s*["\']([^"\']+)',
              r'(https?://[^\s"\']+\.m3u8[^\s"\']*)']:
        m = re.search(p, html or "")
        if m:
            v = m.group(1)
            if ".m3u8" not in v and "{" in v:
                m2 = re.search(r'"(https?://[^"]+\.m3u8[^"]*)"', v)
                return m2.group(1) if m2 else None
            return v
    return None
```

## 7. 六接口本地验证脚本（改文件名即可用）

```python
import importlib.util
spec = importlib.util.spec_from_file_location('sp', r'webhome/Python/xxx.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
s = m.Spider()
if hasattr(s, 'getName'): print('T4:', s.getName())
print('接口:', [x for x in ['homeContent','homeVideoContent','categoryContent','detailContent','searchContent','playerContent'] if hasattr(s, x)])
r = s.searchContent('测试', '0')
print('搜索数:', len(r['list']))
if r['list']:
    v = r['list'][0]
    d = s.detailContent([v['vod_id']])['list'][0]
    pu = d['vod_play_url'].split('$$$')[0].split('#')[0]
    pid = pu.split('$', 1)[1] if '$' in pu else ''
    if pid: print('播放:', s.playerContent('', pid, '').get('url', '')[:100])
```

## 8. 故障排查表

| 问题 | 方案 |
|---|---|
| `module 'xxx' has no attribute 'Spider'` | 类名必须 Spider；导入/继承匹配目标壳（hipy 继承 base.spider，部分 FongMi 壳用独立类，见 multi-shell-spider-contract.md） |
| 播放 403 | header 带全 Cookie/Referer/UA；必要时 localProxy 伪装 |
| 分类页空 | 重新分析选择器；data-* 属性；羊壳问题见 strategies/yk_runtime.md |
| 选择器 0 匹配 | 多级兜底；lxml 解析；参考真实页面而非模板 |
| 图片空白 | data-original/data-src/data-lazyload 优先；验证图片魔数/0 字节/binary octet-stream |
| 加密解不出 | 先 parse=1；再考虑加密链；响应是密文先尝试 AES 解密再 json.loads |
| 搜索编码 | 关键词 urllib.parse.quote；注意 POST/GET 与 v8/v10 差异 |
| 签名过期 | 时间戳/nonce 参数齐全；HMAC 消息格式抓包确认 |
| MacCMS 播放失败 | 不要自己解密，parse=1 |
| API 超时/不可用 | 不假设 API 可用，改页面爬取骨架 |
| 所有卡片角标显示"1" | status 是上架状态不是集数；角标字段必须对照官网真实渲染 |
| 分类含非数字 ID | 硬编码 categories，支持前缀 label |
| 分页错 | make_page_url 兼容 /page/2、?page=2、/p/2；禁止 pagecount 写 99/999 |

## 9. 一次成检查清单

- [ ] CF/5 秒盾检测
- [ ] 懒加载属性覆盖 data-* 全套
- [ ] parse 按 URL 类型精准配置（直链 0/网页 1/未知兜底 1）
- [ ] MacCMS v10 先验证 API 可用性
- [ ] 选择器多级兜底
- [ ] 加密先 parse=1
- [ ] vod_play_from/vod_play_url 核心字段齐全、$$$ 与 # 段数对应
- [ ] 六接口实测 + 直链内容验证（#EXTM3U/媒体魔数）
