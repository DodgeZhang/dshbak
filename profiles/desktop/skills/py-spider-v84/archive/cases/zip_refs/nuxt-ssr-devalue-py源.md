# Nuxt SSR Devalue 解析 — py 源中的 NUXT_DATA 提取

## 适用场景

Nuxt.js 服务端渲染（SSR）的站点，HTML 中有一个 `<script id="__NUXT_DATA__">` 标签，内含站点所有数据（分类列表、视频卡片、详情、播放地址等）的 devalue 紧凑序列化格式。

**典型特征**：
- HTML 源码中 `<div id="__nuxt">` 是空的（或极少内容），但 `__NUXT_DATA__` 里有完整 JSON 数据
- 服务器端 curl 正常返回 HTML（非 SPA 空壳）
- 分类/详情/播放页 URL 格式为 `/drama/AISD/`、`/drama-detail/{id}/`、`/drama-play?id={id}&episode_id=0` 等

**代表站点**：51hub.com（51短剧）

## 相比 DOM 解析的优势

| 对比项 | DOM 解析（lxml XPath） | NUXT_DATA 解析 |
|--------|------------------------|-----------------|
| 可靠性 | 依赖 class 名/标签结构，站点改版即碎 | 100% 稳定：JSON 字段名不变碎片 |
| 抗反爬 | 壳端需渲染完整 DOM | 直接取 JSON，无需渲染 |
| 标题 | 需正则清理"原创"前缀/N万播放 | 直接从 `title` 字段取，干净 |
| 图片 | 需猜 `data-src`/`src`/`/_img/` 代理 | 直接从 `cover` 字段取，直链 |
| 集数 | 6 种正则兜底 | 直接从 `episodes` 数组取，含 id/sort/title |
| 播放地址 | 正则猜 m3u8 格式 | 直接从 `play_url` 字段取 |
| 简介 | 猜 class 名 | 直接从 `description` 字段取 |
| 标签 | 猜 class 名 | 直接从 `tags` 数组取 |

## devalue 格式解析

Nuxt 的 `__NUXT_DATA__` 使用 [devalue](https://github.com/unjs/devalue) 序列化，格式是**扁平数组**，每个元素按索引引用：

```javascript
// 原格式示例（紧凑，无多余空格换行）
[["ShallowReactive",1],{"data":2,"state":308,...
  "once":...,"path":...},["ShallowReactive",3],
  {...},...,{"video_id":6,"title":7,"cover":8,
  "description":9,"tags":10,"episode_count":20,
  "episodes":26,"play_url":60,...},11610,
  "极品特务·别惹卖猪肉的",
  "https://pic.xustgq.cn/upload_01/...",
  "蛰伏八年、禁欲隐忍的...",[11,12,13,14,15,16],
  "AI","成人","原创",...]
```

### 解析规则

1. **顶层是数组**：`[0, 1, 2, 3, ...]`，每个元素按索引顺序排列
2. **字符串**：用引号包裹，`\u002F` 转义 = `/`
3. **数字**：直接数字，负号前缀
4. **布尔值**：`true`/`false`
5. **null**：`null`
6. **数组**：`[元素1, 元素2, ...]`，元素可以是数字索引（引用其他位置的值）
7. **对象**：`{key: 值/索引, ...}`，值可以是数字索引
8. **特殊标记**：`["ShallowReactive", 1]` 等是 Nuxt 内部标记，跳过即可

### 关键原理

- 视频/剧集对象的字段值**全是索引**（数字），指向数组中的真实值
- 对象 `{"video_id":6,"title":7,...}` → `arr[6]=11610`, `arr[7]="极品特务..."`
- 访问公式：`arr[obj.field]`（一层）或 `_res(arr, obj.field)`（递归展开）
- `_res` 函数：如果值是数字索引，递归展开到真实值；如果是数组，展开每个元素；如果是对象，展开每个字段值

## Python 解析器实现

```python
import re

class DVal:
    """Nuxt devalue 序列解析器"""
    def __init__(self, s):
        self.s = s
        self.i = 0
        self.n = len(s)

    def _ws(self):
        while self.i < self.n and self.s[self.i] in ' \t\n\r':
            self.i += 1

    def _str(self):
        out = []
        while self.i < self.n:
            c = self.s[self.i]
            if c == '\\':
                self.i += 1
                if self.i >= self.n: break
                nc = self.s[self.i]
                if nc == 'u' and self.i + 4 < self.n:
                    h = self.s[self.i+1:self.i+5]
                    try:
                        out.append(chr(int(h, 16)))
                    except ValueError:
                        out.append(nc)
                    self.i += 5
                    continue
                out.append(nc)
                self.i += 1
            elif c == '"':
                self.i += 1
                return ''.join(out)
            else:
                out.append(c)
                self.i += 1
        return ''.join(out)

    def _num(self):
        i = self.i
        neg = True if self.s[self.i] == '-' else False
        if neg: i += 1
        while i < self.n and self.s[i].isdigit():
            i += 1
        v = int(self.s[self.i:i])
        self.i = i
        return -v if neg else v

    def val(self):
        self._ws()
        c = self.s[self.i]
        if c == '"':
            self.i += 1; return self._str()
        if c in '-0123456789':
            return self._num()
        if self.s[self.i:self.i+4] == 'true':
            self.i += 4; return True
        if self.s[self.i:self.i+5] == 'false':
            self.i += 5; return False
        if self.s[self.i:self.i+4] == 'null':
            self.i += 4; return None
        return self._arr() if c == '[' else self._obj()

    def _arr(self):
        self.i += 1
        items = []
        self._ws()
        if self.s[self.i] == ']': self.i += 1; return items
        while True:
            items.append(self.val())
            self._ws()
            if self.s[self.i] == ']': self.i += 1; return items
            self.i += 1; self._ws()

    def _obj(self):
        self.i += 1
        d = {}
        self._ws()
        if self.s[self.i] == '}': self.i += 1; return d
        while True:
            self.i += 1
            key = self._str()
            self._ws(); self.i += 1; self._ws()
            d[key] = self.val()
            self._ws()
            if self.s[self.i] == '}': self.i += 1; return d
            self.i += 1; self._ws()


def parse_devalue(s):
    return DVal(s).val()


def _res(arr, v):
    """递归展开 devalue 引用"""
    if isinstance(v, int):
        try:
            return _res(arr, arr[v])
        except (IndexError, TypeError):
            return v
    if isinstance(v, list):
        return [_res(arr, x) for x in v]
    return v


def extract_nuxt_data(html):
    """从 HTML 中提取 __NUXT_DATA__ 并解析"""
    m = re.search(r'<script[^>]*id="__NUXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
    if not m:
        return None
    return parse_devalue(m.group(1))
```

## 关键字段映射

### 分类列表页（首页/分类页）
```python
# 定位 drama 列表容器：找含 module/total/list 的 dict
for v in arr:
    if isinstance(v, dict) and 'module' in v and 'list' in v and 'total' in v:
        lst_ref = v['list']  # 指向列表数组的索引
        cards = arr[lst_ref]  # 卡片数组 [ref1, ref2, ...]
        for card_ref in cards:
            card = arr[card_ref]
            vid = _res(arr, card['video_id'])
            title = _res(arr, card['title'])
            cover = _res(arr, card['cover'])  # 直链！不需代理
            tags = _res(arr, card['tags'])     # 标签列表
```

### 详情/播放页
```python
# 找 drama 对象：含 video_id/play_url/episodes 等
for v in arr:
    if isinstance(v, dict) and 'play_url' in v and 'video_id' in v:
        vid_val = _res(arr, v['video_id'])
        if str(vid_val) == target_vid:
            title = _res(arr, v['title'])
            desc = _res(arr, v['description'])
            cover = _res(arr, v['cover'])
            tags = _res(arr, v['tags'])
            play_url = _res(arr, v['play_url'])  # m3u8 直链！
            serialize_status = _res(arr, v.get('serialize_status_text'))
            episodes = v['episodes']  # 注意：这里是索引，不是直接数组！
            ep_refs = arr[episodes]  # [27,31,35,...] 引用数组
            for idx, e_ref in enumerate(ep_refs):
                e = arr[e_ref]
                ep_id = _res(arr, e['id'])
                ep_sort = _res(arr, e['sort'])
                ep_title = _res(arr, e['title'])
```

## 注意事项

1. **`episodes` 字段是索引 → arr[索引] 才是引用数组**：`drama.get('episodes')` 返回的是数字（如 26），`arr[26]` 才是 `[27,31,35,...]`。**不要用 `_res` 展开 episodes 引用数组**——`_res` 会把每个引用递归展开成对象，变成 `[dict, dict, ...]`，后续按索引循环的逻辑就全错了。

2. **`cover` 字段是直链**（如 `pic.xustgq.cn`），**不需要 `/_img/` 代理或 AES 解密**。直接用原 URL 即可。

3. **`play_url` 字段是 m3u8 直链**（如 `hls.dscxru.cn`），**auth_key 每次会话动态生成**，每次请求播放页时都不同。不能缓存，要走 localProxy 实时拉。

4. **集数 episode_id 参数用 0 起序号**（`sort-1` 或 `idx`），不是真实 episode_id。播放页 URL：`/drama-play?id={vid}&episode_id={0起序号}`

5. **源站 episodes 数组可能混入其他剧的集引用**（51hub 实测：第 7、8 个引用指向"我家祖宅直通1895"的集）。**按数组顺序编号（第1集~第N集）**，不要用标题或 id 推理。

6. **HLS AES-128 固定 IV**：当 m3u8 明确给出 `IV=0x...` 时，所有 ts 分片共用同一 IV（**不是** base_iv XOR sequence）。实测：3 个 ts 分片用同一 IV 解密全部得到 `0x47` MPEG-TS 头。

7. **图片 CDN 直链**：`pic.xustgq.cn` 反爬严，壳端可能需要 Referer 头才能拉图。如果壳端不显示图片，加 http header。

8. **搜索**：搜索页 `/search/` 也是 SPA，可能走 `api.51dj1.com` API 接口。如果搜索接口无法确认，留空（`return {'list': []}`）。