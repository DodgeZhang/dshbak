# Shell 端代理与网络策略模块 v8.4

用于处理 shell 端 Python 不继承系统 VPN、被墙域名、Cloudflare/Next.js API、图片代理链路断开和私有代理不可写死等问题。

## 适用特征

- 手机浏览器能访问，但壳端 Python/requests 没数据、连接失败或 `Network is unreachable`。
- 站点被墙、CDN 图片域名被墙、分类页能开但图片不显示。
- `localProxy`、`proxyPic` 请求图片 CDN 返回空、超时或壳端不显示。
- 页面被 Cloudflare/WAF 拦截，但 JSON API 或移动端接口可访问。
- Next.js/SSR 页面含 API 路径，HTML 不是最佳数据源。

## 核心结论

Python `requests` 不自动继承 Android 系统 VPN。用户手机开了代理或 VPN，只代表浏览器可用，不代表 shell 端 py 源可用。写源时若站点可能被墙，必须让所有网络请求显式支持代理。

代理配置优先级：

1. `extend`/`ext` 用户传入，例如 `{"proxy":"127.0.0.1:7890"}`。
2. 本机常见代理端口探测：`7890/7891/1080/1087/10809/24780/2333/6153/16666/20170/9090/7070`。
3. 环境变量：`HTTPS_PROXY/HTTP_PROXY/ALL_PROXY/PROXY` 及小写形式。
4. 不可写死私人 LAN IP、NAS 地址、账号或密码。

## 标准实现

```python
def _init_session(self, extend=""):
    import json, os, requests
    self.session = requests.Session(); self.proxy = None
    self.session.headers.update(self.headers)
    self.ext = {}
    try:
        self.ext = json.loads(extend) if isinstance(extend, str) and extend.strip().startswith("{") else {}
    except Exception: self.ext = {}
    self._probe_proxy()
    if self.proxy: self.session.proxies.update(self.proxy)

def _probe_proxy(self):
    import os
    p = self.ext.get("proxy") if isinstance(getattr(self, "ext", {}), dict) else ""
    if p:
        if not p.startswith("http"): p = "http://" + p
        self.proxy = {"http": p, "https": p}; return
    for host in ["127.0.0.1", "localhost"]:
        for port in ["7890","7891","1080","1087","10809","24780","2333","6153","16666","20170","9090","7070"]:
            try:
                t = "http://" + host + ":" + port
                self.session.get("http://www.gstatic.com/generate_204", timeout=1, proxies={"http": t, "https": t})
                self.proxy = {"http": t, "https": t}; return
            except Exception: pass
    for k in ["HTTPS_PROXY","https_proxy","HTTP_PROXY","http_proxy","ALL_PROXY","all_proxy","PROXY","proxy"]:
        v = os.environ.get(k)
        if v:
            if not v.startswith("http"): v = "http://" + v
            self.proxy = {"http": v, "https": v}; return

def _get(self, url, headers=None, **kw):
    try:
        r = self.session.get(url, headers=headers or self.headers, timeout=kw.pop("timeout", 15), verify=False, proxies=self.session.proxies or None, **kw)
        r.encoding = r.apparent_encoding or "utf-8"
        return r.text
    except Exception: return ""
```

## localProxy/proxyPic 必须走代理

图片代理链路是 `壳端图片代理 -> py 端 localProxy/proxyPic -> CDN -> 返回二进制`。如果图片代理里新建 `requests.get()` 且不带代理，shell 端会直连 CDN，常见结果是超时、空图或壳端静默失败。

要求：

- `localProxy/proxyPic` 使用 `self.session.get()`，不要裸用 `requests.get()`。
- 请求参数带 `proxies=self.session.proxies or None`。
- 图片返回真实 MIME 和二进制；body 为空时返回 404，不返回 200 空图片。
- 图片代理只处理图片，不处理 m3u8/mp4 播放地址。

```python
def proxyPic(self, params):
    import base64
    try:
        url = base64.b64decode(params.get("url", "")).decode("utf-8")
        r = self.session.get(url, headers={"User-Agent": self.headers.get("User-Agent", "Mozilla/5.0"), "Referer": self.host + "/"}, timeout=15, verify=False, proxies=self.session.proxies or None)
        data = r.content or b""
        if not data: return [404, "text/plain", ""]
        return [200, "image/jpeg", data]
    except Exception: return [500, "text/plain", "error"]
```

## Cloudflare/Next.js API 优先

页面被 Cloudflare 拦截不等于站点不可写。若页面是 Next.js/SSR 或 HTML 体积异常，优先查找并测试 JSON API。

识别信号：

- HTML 返回 403、Cloudflare challenge、fallback 页或验证码页。
- 页面源码含 `/_next/`、`__NEXT_DATA__`、`/api/`、SSR hydration 数据。
- API 路径返回 200 JSON，而 HTML 页被拦截。

处理规则：

- 优先使用 API 字段生成列表、详情、搜索；HTML 仅作 fallback。
- UA 优先 Android 移动端格式，并带 Referer、Accept-Language。
- 必要 cookie 如年龄验证、地区、策略开关可在 headers/cookies 中补充，但必须来自实测，不凭空编造。
- 若 API 可用、HTML 被 CF，完成报告写明“HTML 有 WAF，数据走 API”。

## 调试输出策略

默认交付源不加大量 `print`。壳端通常看不到日志，必要调试写入 `/sdcard/debug_xxx.txt`，完成后按用户要求移除或保留最小化调试。

```python
def _dbg(self, msg):
    if not getattr(self, "debug", False): return
    try:
        open("/sdcard/debug_" + self.name + ".txt", "a", encoding="utf-8").write(str(msg) + "\n")
    except Exception: pass
```

## 完成前检查

- `_get/_post/playerContent/localProxy/proxyPic` 是否都复用同一个 session/proxy。
- 是否没有写死私人代理 IP、NAS、账号、密码。
- 被墙站点是否支持 `extend.proxy`。
- HTML 被 WAF 时是否尝试 API、移动 UA、Referer 和实测 cookie。
- 图片不显示时是否分别检查代理、状态码、body 长度、Content-Type、magic bytes。