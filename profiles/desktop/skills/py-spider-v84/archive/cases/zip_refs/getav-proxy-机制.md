# getav.py 代理机制 & 晴天影院搜索限制

## 背景

两个典型场景需要"代理 + 反爬"处理：

1. **getav.py**（`getav.me`）：域名被国内墙，无代理完全无数据。用户在手机开了"科学上网"，但 shell 里的 Python 有独立网络栈，不一定走代理 → 必须写进代码里自动找代理。
2. **晴天影院**（`sheqi.cc`）：Cloudflare 反爬，搜索页弹验证码弹窗（图片验证码），用户浏览器里过了 cookie 生效能搜；shell/Python 过不了。

## getav.py 代理方案（2026-08-26 定稿）

**核心原则**：代码里不写死任何私人代理地址（用户要发给别人），透明探测本机代理环境。

**实现**（三处改动）：

### 1. `init` 接收 ext，解析 proxy 参数

```python
def init(self, extend=""):
    # ... 其他初始化
    self.proxy = None
    ext_dict = {}
    try:
        if isinstance(extend, str):
            ext_dict = json.loads(extend)
        elif isinstance(extend, dict):
            ext_dict = extend
    except:
        pass
    if ext_dict.get("proxy"):
        p = ext_dict["proxy"]
        if not p.startswith("http"):
            p = "http://" + p
        self.proxy = {"http": p, "https": p}
        return
    self._probe_proxy()
```

用户在 shell 端 ext 填 `{"proxy":"127.0.0.1:7890"}` 或任何代理地址。

### 2. `_probe_proxy()` 探测本机代理（3 层兜底）

```python
def _probe_proxy(self):
    # 层 1: 环境变量 HTTPS_PROXY / https_proxy（系统级代理配置）
    env_proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    if env_proxy:
        if not env_proxy.startswith("http"):
            env_proxy = "http://" + env_proxy
        self.proxy = {"http": env_proxy, "https": env_proxy}
        return
    # 层 2: 常见本地代理端口（mihomo/clash 常见 7890/1080/1087）
    for host in ["127.0.0.1"]:
        for port in ["7890", "1080", "1087"]:
            try:
                r = self.session.get("http://"+host+":"+port, timeout=1, verify=False)
                if r.status_code in [200, 300, 404]:
                    p = "http://"+host+":"+port
                    self.proxy = {"http": p, "https": p}
                    return
            except:
                pass
    # 层 3: 无代理（走直连，站点被墙则数据为空，向用户说明）
```

**⚠️ 不探测 192.168.31.66 / 飞牛 NAS 代理**——用户原话"不要这样搞，这我要发给别人的，不要用我飞牛的代理"。代码中不出现任何私人网络地址。

### 3. `_req()` 请求时带 `proxies` 参数

```python
def _req(self, url, params=None):
    try:
        r = self.session.get(url, headers=self.headers, cookies=cookies,
                             params=params, timeout=10,
                             proxies=self.proxy if hasattr(self, 'proxy') else None)
        if r.status_code == 200:
            return r.json()
        print(f"[GetAV] HTTP {r.status_code}")
    except Exception as e:
        print(f"[GetAV] req error: {e}")
    return {}
```

## 晴天影院搜索（Cloudflare/验证码弹窗站点）

**用户实测结论**：晴天影院搜索页弹 Cloudflare 图片验证码弹窗，浏览器过了之后 cookie 生效，shell/Python 端过不了验证码 → 搜索无解。

**处理步骤**：

1. 先判断 HTML 搜索页返回内容——`/vodsearch/{wd}----------{pg}/` 返回的是"猜您喜欢"推荐页（和关键词无关），不是搜索结果
2. 再判断 ajax 搜索——`/index.php/ajax/suggest?mid=1&wd={wd}&limit=15` 返回正确匹配的名字+数字 id，但 `vod_id` 必须用 `/fvc/id/{数字id}.html`
3. **关键判断**：如果 `/fvc/id/{数字id}.html` 在本机无有效 cookie 访问返回的是 fallback 404 页（无 `hej-detail__title`），说明 Cloudflare 拦截
4. **最终裁决**：这类站 py 和 xbpq 都过不了搜索验证码（shell 无交互输入验证码的地方），搜索只能 `return {'list': []}`，向用户说明靠分类浏览代替

**⚠️ 用户纠正**：
- "ajax"——告诉过用户处理搜索验证弹窗的办法就是走 ajax（不走 HTML 搜索页）
- 但如果 ajax 返回的 id 路径也要过 cookie 反爬，那就没解了 → 保持搜索留空

## 通用模板：被墙站点 py 源的代理兜底（可复用）

被墙站点 py 源的标准代理兜底结构：

```python
import os

def init(self, extend=""):
    # ...
    self.proxy = None
    ext_dict = {}
    try:
        if isinstance(extend, str):
            ext_dict = json.loads(extend)
        elif isinstance(extend, dict):
            ext_dict = extend
    except:
        pass
    if ext_dict.get("proxy"):
        p = ext_dict["proxy"]
        if not p.startswith("http"):
            p = "http://" + p
        self.proxy = {"http": p, "https": p}
        return
    self._probe_proxy()

def _probe_proxy(self):
    env_proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    if env_proxy:
        if not env_proxy.startswith("http"):
            env_proxy = "http://" + env_proxy
        self.proxy = {"http": env_proxy, "https": env_proxy}
        return
    for port in ["7890", "1080", "1087"]:
        try:
            r = self.session.get("http://127.0.0.1:"+port, timeout=1, verify=False)
            if r.status_code in [200, 300, 404]:
                p = "http://127.0.0.1:"+port
                self.proxy = {"http": p, "https": p}
                return
        except:
            pass

def _req(self, url, ...):
    # proxies=self.proxy if hasattr(self, 'proxy') else None
```

**用户要发给别人用** → 绝不写死自己的代理地址，用这套"探测 + ext 传参 + 环境变量"三层兜底即可。