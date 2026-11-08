# 跳转页 href 直接提取（用户"每日大赛优化逻辑"，2026-08-24 四色站实证）

> 适用于 py 源的动态域名解析：换域名时旧域名返回"加载中"跳转页

## 跳转页 HTML 特征

```html
<!doctype html><html><body><a id="_6Hu0wqI6lC" href="https://新域名/" target="_self">加载中...</a>
<script>(function(x){if(typeof(x.click)=='function'){x.click()}else{window.location.replace(x.href)}})(document.getElementById("_6Hu0wqI6lC"))</script></body></html>
```

- `<a ... href="https://新域名/" target="_self">加载中...</a>` + `window.location.replace` 自动点击脚本
- **用户明确要求**："让ai直接执行href提取获取发布页，不要判断js跳转。速度会快很多"（省 ~3 秒）

## Python 实现（_discover_domain 内）

```python
m = re.search(r'<a[^>]*href="([^"]+)"[^>]*>[^<]*加载中', txt)
if m:
    href = m.group(1)
    if href.startswith('http'):
        r2 = session.get(href, timeout=timeout, allow_redirects=True)
        if r2.status_code in (200, 301, 302):
            parsed = urlparse(r2.url)
            return f'{parsed.scheme}://{parsed.netloc}'   # 一步到发布页
```

**关键点**：
1. 正则锚点 = `加载中` 文字 + `target="_self"` 的 `<a>`，别匹配页面其他链接（如 logo）
2. **不要**用 `is_jump → continue` 跳过（那是旧做法，浪费一轮请求）；直接提取 href 跟随
3. href 可能相对路径 → 只处理 `startswith('http')`，否则 continue

## init 域名自愈（死域名 ext 也适用）

```python
is_jump = ('window.location.replace' in txt) or ('加载中' in txt and 'click' in txt)
if 'enter-content' in r.text and r.url != test_url:
    # 重定向修正域名
elif is_jump or len(txt) < 500 or r.status_code not in (200, 301, 302):
    nd = _discover_domain()   # 重新发现，覆盖 self.H
    if nd:
        self.H = nd
```

## 候选列表维护

- **第一位放当前有效域名**（四色 2026-08-24 实测 `https://www.r4n1h.top`）
- 旧域名（o8q9m/c9q6l/b5y0e/d4f2t/s7w8o）全 404 或返回跳转页——**死域名不要删**（跳转页指向新域名时可自愈），但新域名放最前
- 用户手机搜不到 → 先看用户日志（XBPQ 日志/XBPQ 调试）里请求的域名是否死域名

## 调试日志（用户反馈定位用）

```python
print('[R3]搜索请求: ' + url)
print('[R3]搜索响应[code]: 状态 长度')
print('[R3]搜索[code]成功: N条原始 → M条可用')
```
