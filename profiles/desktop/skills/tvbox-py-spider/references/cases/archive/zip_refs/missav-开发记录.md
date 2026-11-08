# MissAV py 源开发记录

> 完整交付：`/opt/data/out/missav.py`（484 行）
> 参考源码：`cache/documents/51短剧图片映射(1).json` + `doc_19e068300732_源码.txt` + `doc_db36f36ef9d3_missavt所需源码与要求.json`

---

## 发布站结构

3 个发布站 HTML 完全一样（683 字节），跳转逻辑在 `publish.js`：
- `https://missavt01.netlify.app/`
- `https://missavt01.github.io`
- `https://missavt01.pages.dev/`

**子域名**：5 字符随机前缀（`abcdefghjkmnpqrstuvwxy0123456789`）+ 3 个主域名随机组合：
- `kibsbvpft.cc`
- `fvtweuyk.cc`
- `gcqsnwaam.com`

永久站：`missavt28.com` / `missavt.com`（代理 DNS 常解析不出来）

---

## 域名解析（最关键）

**代理 DNS 常解析不出 MissAV 域名**——飞牛NAS 代理（192.168.31.66:7890）对 `*.cc` / `*.com` 域名 DNS 返回空。本机测试同样失败。

**`_get_domain()` 并发策略**（484 行版本）：
- 每个后缀 8 个前缀，共 24 个候选域名
- 代理探测：本机 7890/1080/1087 + 飞牛NAS 7890/7891/1080 + 10.0.0.1 + 环境变量 HTTPS_PROXY
- 并发 15 worker，超时 25 秒

**如果解析仍失败**：壳端导入时 ext 传真实域名（如 `https://scu.fvtweuyk.cc`），跳过解析。

---

## 图片解密（瓜系）

AES-128-CBC，固定密钥：
- key: `f5d965df75336270`
- iv: `97b60394abc2fbe1`

图片直链从 `<img data-src="...">` 提取，走 `localProxy(type=pic)` → `proxyPic()` → `aesimg()` 解密。

---

## 播放链路（关键坑）

**M3U8 直链**，无 eval 加密。详情页 data-url 格式：
- 推荐/sort：`https://jw-hls.wgmyvq.cn/m3m/{hash}`（无 `.m3u8` 后缀）
- 其他分类：`https://jw-hls.wgmyvq.cn/cloud_01/upload/video/.../{name}.m3u8?auth_key=***

**`data-url` 正则**必须匹配到 `>`，不能只匹配 `[^"\x27]+`——URL 里含 `&` 会被截断：
```python
# 正确：支持 & 在 URL 里，匹配到 > 或 <
um = re.search(r'data-url=["\x27]([^"\x27]*\.[mM]3[uU]8[^"\x27<>]*)["\x27]', html)
```

---

## **致命坑：ts 段 CDN 反爬导致 m3u8 代理方案完全不可行**

MissAV m3u8 里 ts 段走 `tsnew.cpckgr.cn`，**走代理/直连/各种 Referer 全部 403**。

我试了 50+ 种方式：
- m3u8 代理 → 改写 ts 走 `localProxy(type=ts)` → 代理拉 ts → **403**
- 各种 Referer 组合 → **403**
- 各种 Cookie / X-Forwarded-For / Host 头 → **403**

**结论**：ts 段反爬是 CDN 层面，py 端无法绕过。壳端播放器访问 ts 段时自带的环境头可能不同——推荐视频能放是因为 CDN 缓存命中。

**不要尝试加 m3u8 代理**，直接返回直链。

---

## localProxy 只保留图片代理

```python
def localProxy(self, params):
    t = params.get('type')
    if t == 'pic':
        return self.proxyPic(params)
    return [200, 'text/plain', '']
```

**不能调用已删除的方法**——之前我删了 `proxyM3u8`/`proxyTs` 但 `localProxy` 还引用它们，导致 shell 崩溃→空数据。

---

## 分类/筛选

7 个 class：sort/jp/cn/uncen/amateur/actresses/tags
筛选参数 TVBox 主流走 `ext`（json 字符串），兼容 `filter`（字典）兜底：
```python
f = {}
if isinstance(ext, dict): f = ext
elif isinstance(ext, str): f = json.loads(ext)
if not f:
    if isinstance(filter, dict): f = filter
```

---

## vod_play_url 格式

```
{vod_name}${m3u8_url}
```

不带任何自定义 scheme（`m3u8://` 等 shell 不认识），保持纯 URL。