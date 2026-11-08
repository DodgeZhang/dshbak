# MissAVt 最终交付版（v3 修复 535 行）

> 参考：`references/missavt-写作步骤.md`（主流程）
> 交付：`/opt/data/out/missav.py`（535 行，已修复筛选+播放超时）

## 交付流程（从 0 到 1）

1. 读 `51短剧用久发布站源码(1).json`（3 发布站 publish.js 同源）→ 提取后缀池 `['kibsbvpft.cc','fvtweuyk.cc','gcqsnwaam.com']`，前缀 5 字符随机
2. 图片：AES-128-CBC（key `f5d965df75336270` / iv `97b60394abc2fbe1`）→ localProxy(type=pic)
3. 播放：**列表页 `data-url` 直接就是 m3u8 直链**（无需解密）；详情页 fallback 到 91hub 同款 eval 混淆解密
4. 分类：sort / category / actresses / tags / actress(二级) / tag(二级) / search 七大入口
5. 详情：`data-src` 取封面 → `data-url` 取播放 → 必填 `vod_play_from` + `vod_play_url=名$url`

## v2 关键修正

### 1. 域名并发解析（58s → 5~9s）

原来 `_get_domain` 串行试后缀×前缀×代理端口，58 秒+，壳端会超时。

**改成**：`concurrent.futures.ThreadPoolExecutor(max_workers=10)` 并发构造 `候选域名列表`（3 后缀 × 2 前缀 × 3 代理端口），12 秒 timeout 内谁先通用谁。

```python
def try_one(item):
    domain, p = item
    try:
        r = self.session.get(domain, headers={"User-Agent": "Mozilla/5.0"}, timeout=3, verify=False, proxies=p)
        if r.status_code == 200 and ('MissAVt' in r.text or 'video-item' in r.text):
            return (domain, p)
    except Exception:
        pass
    return None

with ThreadPoolExecutor(max_workers=10) as ex:
    for domain in candidates:
        for p in proxies:
            futures.append(ex.submit(try_one, (domain, p)))
    for f in as_completed(futures, timeout=12):
        result = f.result()
        if result:
            domain, p = result
            self.session.proxies = p
            return domain
```

代理探测顺序：`127.0.0.1:7890` → `127.0.0.1:1080` → `127.0.0.1:1087` → `192.168.31.66:7890`（飞牛NAS）→ 直连

### 2. 筛选参数走 filter 不走 ext（**核心 bug**）

原来 `categoryContent(cid, pg, filter, ext)` 里用 `ext.get('by')`，TVBox 壳端把筛选参数走 **filter**（dict 形式），ext 是空字符串 → `.get()` 永远返回默认值 → 点哪个筛选都没变化。

**修复**：
```python
f = {}
if isinstance(filter, dict):
    f = filter
if not f and isinstance(ext, str) and ext not in ('', '{}', 'null', 'undefined'):
    try: f = json.loads(ext)
    except: pass
# 后续全部用 f.get('by') / f.get('cateId')
```

**教训**：TVBox 壳端 `categoryContent` 参数顺序为 `(cid, pg, filter, ext)`，**筛选值走 filter 字典，不走 ext**。写 py 源必须确认 shell 传入哪个参数。

### 3. 代理自动回退

`fetch()` 主 session 没代理时自动 `_fetch_with_proxy()` 扫 7890/1080/1087：
```python
def _fetch_with_proxy(self, url):
    for port in ['7890', '1080', '1087']:
        try:
            p = {"http": f"http://127.0.0.1:{port}", "https": f"http://127.0.0.1:{port}"}
            r = self.session.get(url, headers=h, timeout=12, verify=False, proxies=p)
            if r.status_code == 200:
                self.session.proxies = p
                return r.text.replace('\r', '')
        except: pass
    return ""
```

### 4. `sys.path.append('..')` 移除

壳端标准写法不需要，直接 `from base.spider import Spider`。

## 最终交付验证

- `init(extend="")` 自动解析 → `https://7auok.kibsbvpft.cc`（8.9s），24 部有图
- `init(extend="https://scu.fvtweuyk.cc")` 传真实域名 → 跳过解析（1s）
- 7 个 class 全部返回（sort / jp / cn / uncen / amateur / actresses / tags）
- 筛选 `filter={"by":"renew"}` / `filter={"cateId":"madou"}` 全部走正确 URL
- 女优二级 `actress/{name}/{page}/` + URL 编码
- 标签二级 `tag/{name}/{page}/`
- 详情 → `vod_play_from="MissAVt"` + m3u8 直链