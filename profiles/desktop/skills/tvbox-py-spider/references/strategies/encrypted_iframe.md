# 加密与 iframe 策略模块 v8.4

包含 AES、XOR、RSA、iframe 递归解析和多层页面编码经验。缺 key/iv/sign 算法时进入阻塞。

# 加密/特殊架构处理模块

## AES-CBC解密（图片/标题加密站通用）

```python
from functools import partial
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
import base64

def _aes_decrypt(self, data, key, iv=b"0000000000000000"):
    # 关键：unpad 失败时不要返回密文/乱码，返回 None 让上层走 fallback。
    try:
        cipher = AES.new(key.encode() if isinstance(key, str) else key, AES.MODE_CBC, iv.encode() if isinstance(iv, str) else iv)
        dec = cipher.decrypt(base64.b64decode(data))
        # 先判断 magic bytes，能出真图就直接返回，避免 unpad 因尾噪失败
        if dec[:3] == b"\xff\xd8\xff" or dec[:8] == b"\x89PNG\r\n\x1a\n":
            if dec[:3] == b"\xff\xd8\xff":
                end = dec.find(b"\xff\xd9")
                if end != -1: return dec[:end + 2]
            return dec
        return unpad(dec, AES.block_size).decode("utf-8")
    except Exception:
        return None
```

## HTML 实体与播放器配置

播放器配置位于 HTML 属性或脚本字符串中时，必须先进行实体解码，再解析 JSON 或提取媒体字段。

处理顺序：

1. HTML 的 quot 实体编码还原为双引号字符。
2. `&amp;` 还原为 `&`。
3. `&#39;` 还原为 `'`。
4. JSON 路径中的 `\\/` 还原为 `/`。
5. 最后执行 `json.loads()` 或媒体正则提取。

```python
import html as html_lib
raw = html_lib.unescape(raw)
raw = raw.replace('\\\\/', '/')
config = json.loads(raw)
```

禁止在实体未解码时直接调用 `json.loads()`；否则 `data-config` 中的 quot 实体编码会导致播放数组为空。

## 加密媒体文件与图片代理（v8.4）

**特征**：图片 URL 有 `.jpg/.jpeg/.png` 扩展名，但响应 `Content-Type` 为 `binary/octet-stream`、`text/html` 或 body 为 0 字节；文件头不是 JPEG/PNG/WebP/GIF。前端 JS/运行配置可能出现 `media_key`、`media_iv`、`NUXT_PUBLIC_MEDIA_CRYPT_KEY`、`NUXT_PUBLIC_MEDIA_CRYPT_IV`。

**处理原则**：
- 字段非空不等于资源可用；必须抽样请求并检查 magic bytes。
- 加密图片用 `localProxy` 解密后返回真实 MIME；不要把代理用于 m3u8/mp4 播放地址。
- 0 字节头像/封面不能靠解密修复；可按用户要求选择保留空图、使用站内 fallback、或二级封面兜底。默认不逐条请求详情页兜底，避免列表变慢。
- 若响应 body 长度为 0，直接返回 404 或空，避免客户端拿到 `200 image/jpeg` 但无内容。

**图片代理骨架**：
```python
def localProxy(self, param):
    if param.get("type") != "img": return [404,"text/plain","",""]
    try:
        url=self.d64(param.get("url",""))
        if not url: return [404,"text/plain","",""]
        r=self.session.get(url, headers=self.headers, timeout=15, verify=False)
        content=r.content or b""
        if not content: return [404,"text/plain","",""]
        try: content=unpad(AES.new(self.media_key,AES.MODE_CBC,self.media_iv).decrypt(content), AES.block_size)
        except Exception: pass
        ctype="image/jpeg"
        if content.startswith(b"\x89PNG"): ctype="image/png"
        elif content[:4]==b"RIFF" and content[8:12]==b"WEBP": ctype="image/webp"
        elif content.startswith(b"GIF"): ctype="image/gif"
        elif not content.startswith(b"\xff\xd8"): return [404,"text/plain","",""]
        return [200,ctype,content,{}]
    except Exception as e:
        print(f"[{self.getName()}] 图片代理失败: {e}"); return [404,"text/plain","",""]
```


## MissAV 系 AES 图片代理实战规则 v8.4

适用 MissAV、MissAVt、91hub 等使用 `localProxy/proxyPic` + AES-CBC 图片加密的站点。

关键规则：

- 标准 key/iv 是明文 ASCII bytes：`b'f5d965df75336270'`、`b'97b60394abc2fbe1'`，禁止 `bytes.fromhex()`，否则会变成 8 字节导致 AES key length 错。
- 图片 CDN 响应 `binary/octet-stream` 不代表坏图，需 AES-CBC 解密后检查 JPEG/PNG/WebP magic bytes。
- AES-CBC 解密后如果是 JPEG，必须截断到 `\xff\xd9` EOI；否则尾部 padding/噪声可能导致壳端解码失败。
- `localProxy/proxyPic` 必须走 `self.session.proxies or None`，不要裸用 `requests.get()`。
- 同一站点混用 `image.cpckgr.cn` 与 `pic.yrfmba.cn` 时，若路径一致且前者壳端不显示、后者正常，可在列表解析时把不稳定 CDN 替换为稳定 CDN；此规则只在实测同路径兼容后使用。

```python
IMG_KEY = b'f5d965df75336270'
IMG_IV = b'97b60394abc2fbe1'

def _aes_img(self, data):
    try:
        dec = AES.new(self.IMG_KEY, AES.MODE_CBC, self.IMG_IV).decrypt(data)
        if dec[:3] == b'\xff\xd8\xff':
            end = dec.find(b'\xff\xd9')
            return dec[:end + 2] if end != -1 else dec
        if dec[:8] == b'\x89PNG\r\n\x1a\n': return dec
        try: return unpad(dec, AES.block_size)
        except Exception: return None
    except Exception: return None
```

案例参考：`../cases/missav-image-debug.md`。

---

## XOR解密（128字节密钥）

```python
def _xor_decrypt(self, data, key):
    k = key.encode() if isinstance(key, str) else key
    return bytes(b ^ k[i % len(k)] for i, b in enumerate(data.encode() if isinstance(data, str) else data)).decode("utf-8", errors="ignore")
```

## RSA签名链（API签名站）

```python
import rsa as rsa_lib

def _rsa_sign(self, data, private_key_pem):
    priv = rsa_lib.PrivateKey.load_pkcs1(private_key_pem.encode())
    return rsa_lib.sign(data.encode(), priv, "SHA-256").hex()
```

## iframe二次解析（加密播放器通用）

```python
def _parse_iframe(self, html):
    m = re.search(r'<iframe[^>]+src=["\']([^"\']+)', html)
    if m:
        iframe_url = self._fix(m.group(1))
        # 必须复用 self.session 并带 proxies，不能裸用 requests.get 直连（被墙时拿不到）
        iframe_html = self._get(iframe_url)
        if iframe_html:
            return re.search(r'(https?://[^\s"\']+\.m3u8[^\s"\']*)', iframe_html)
    return None
```

要求：`_get` 内部必须 `self.session.get(url, proxies=self.session.proxies or None, ...)`，与 `proxy_network.md` 一致。
## 播放地址多级提取顺序
1. 扫描页面明文 m3u8/mp4。
2. 提取 `u`、`encodeURIComponent` 和常见播放器变量。
3. 对 Packer/eval 内容做字符串解包后重新扫描。
4. 请求站点播放 API，解码返回的 JSON、Packer 或压缩数据。
5. 递归处理 iframe，最后才进入经过验证的 sniff 分支。
- 每一级失败都应返回空值并继续下一层，单条线路异常不能中断整体解析。
- 最终地址必须是 HTTP/HTTPS 媒体 URL；伪协议和 HTML 页面视为失败。
---

---
## 场景1：多层嵌套页面编码

**特征**：页面源码不是直接HTML，而是通过JS `document.write` 动态输出。编码方案多层嵌套，且不同页面类型编码方式不同。

**典型案例**：
- 首页/分类页：`atob("hex_b64")` → base64解码得hex字符串 → hex转bytes → UTF-8解码 → URI解码 → 真实HTML
- 详情页：`atob(atob("b64"))` → 双重base64解码 → URI解码 → 真实HTML
- 搜索页：可能是第三种变体

**识别方法**：
1. 页面源码以 `<!DOCTYPE html><script>document.write(` 开头
2. 响应体很小（27KB~70KB），但解码后内容很大（170KB~220KB）
3. 响应中没有 `videolist`、`<div` 等HTML关键词，需要解码后才出现

**处理方案**：写通用 `decode_page` 方法，按优先级尝试多种解码路径：
```python
def _looks_html(self, s):
    # 容忍 BOM、空白和一个或多个 HTML 注释前缀，但不能把任意以 < 开头的乱码当 HTML
    t = (s or '').lstrip('\ufeff \t\r\n')
    t = re.sub(r'^(?:<!--.*?-->\s*)+', '', t, flags=re.S)
    return bool(re.match(r'(?is)^(?:<!doctype\s+html\b|<html\b|<head\b|<body\b|<div\b|<script\b|<main\b|<section\b)', t))

def decode_page(self, html):
    try:
        # 路径1: 双重 atob
        m = re.search(r'atob\(atob\("([^"]+)"\)\)', html)
        if m:
            s1 = base64.b64decode(m.group(1)).decode('utf-8', errors='replace')
            s2 = base64.b64decode(s1).decode('utf-8', errors='replace')
            final = urllib.parse.unquote(s2)
            # 如果不是 HTML，再尝试解一层
            if not self._looks_html(final):
                try:
                    final = base64.b64decode(final).decode('utf-8', errors='replace')
                    final = urllib.parse.unquote(final)
                except Exception: pass
            return final
        # 路径2: 单次 atob + hex
        m2 = re.search(r'atob\("([^"]+)"\)', html)
        if m2:
            s1 = base64.b64decode(m2.group(1)).decode('utf-8', errors='replace')
            if all(c in '0123456789abcdefABCDEF' for c in s1[:20]):
                raw = bytes.fromhex(s1)
                s2 = raw.decode('utf-8', errors='replace')
                final = urllib.parse.unquote(s2)
            else:
                final = urllib.parse.unquote(s1)
            if not self._looks_html(final):
                try:
                    final = base64.b64decode(final).decode('utf-8', errors='replace')
                    final = urllib.parse.unquote(final)
                except Exception: pass
            return final
    except Exception as e:
        print(f'[{self.name}] decode_page error: {e}')
    return html
```

**关键教训**：
- 分析阶段必须对首页、分类页、详情页、搜索页**分别**解码验证，不能假设全站统一编码
- 判断解码是否成功：检查结果是否以 `<!DOCTYPE` 或 `<html` 开头
<!-- 演进: 2026-08-28 | 来源: 耐看点播 /player/api.php | 类型: pattern -->
## MacCMS 自定义播放器 XOR+双字母表 sign 解密（v8.4）

适用特征：`player_aaaa.url` 为长 Base64；iframe 为 `/player/?vid=`；POST `/player/api.php`；JS 含 `customStrDecode/sign/deString/md5('test')`。

链路：`data.url → Base64 → md5(test)循环XOR → Base64 → A/B字母表/payload → deString → m3u8`。

```python
def decode_sign(value):
    key=hashlib.md5(b"test").hexdigest(); raw=base64.b64decode(value)
    code="".join(chr(b ^ ord(key[i % len(key)])) for i,b in enumerate(raw))
    parts=base64.b64decode(code+"===").decode().split("/")
    a=json.loads(base64.b64decode(parts[0])); b=json.loads(base64.b64decode(parts[1]))
    payload=base64.b64decode("/".join(parts[2:])+"===").decode(); out=""
    for ch in payload: out += a[b.index(ch)] if ch.isascii() and ch.isalpha() and ch in a and ch in b else ch
    return out
```

- 字母表方向必须按当前 JS 实测；反向也可能不报错，但会产生 `yeerx://...l3a8`、`mttby://...f3a8` 等伪协议。
- 成功标准是 `http/https + .m3u8/.mp4 + 实际响应`，不是函数无异常。
- API 请求带移动 UA、iframe Referer、Origin、`X-Requested-With: XMLHttpRequest`，必要时复用 Session/Cookie。
- `player_aaaa` 含嵌套 `vod_data` 时，简单非贪婪 JSON 正则可能提前截断；优先可靠脚本边界或花括号配平。