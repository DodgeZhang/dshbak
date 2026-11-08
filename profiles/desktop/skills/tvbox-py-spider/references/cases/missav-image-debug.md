# MissAV 系 py 源图片代理完整排查（2026-08-27 实录）

适用：MissAV / MissAVt / 51吃瓜 等使用 `localProxy` + AES 图片解密的 py 源。

## 1. 多 CDN 混用现象

同一站点、同一页 HTML 里可能混用**两个图片 CDN 域名**：

| CDN | 出现位置 | 返回内容 | 壳端表现 |
|---|---|---|---|
| `image.cpckgr.cn` | 首页/前 9 张、部分标签页顶部 | `content-type: binary/octet-stream`，AES 加密 | ❌ 壳端图片解码器拒收 |
| `pic.yrfmba.cn` | 素人/标签页下部、详情页 | 同上 | ✅ 壳端正常解码 |

**根因**：代码逻辑（代理、AES 解密、`ext` 判断、`base64` 返回）完全正确，但**壳端解码器对不同 CDN 同源数据的表现不一致**（CDN 侧可能改了 header/MIME/压缩级别）。

**修法**：`parse_videos` 里把 `image.cpckgr.cn` 统一替换为 `pic.yrfmba.cn`：

```python
html = html.replace("image.cpckgr.cn", "pic.yrfmba.cn")
```

路径完全一致（都是 `/upload_01/upload/...`），替换后壳端解码稳定。

## 2. AES-CBC 解密后必须截断到 JPEG 结尾

CBC 解密输出块大小是 16 字节的整数倍（含 PKCS7 padding）。真实 JPEG 结尾是 `\xff\xd9`（JPEG EOI 标记）。如果解密后不截断，直接返回整块（含 padding 和尾噪），部分壳端解码器会拒收——头字节 `ffd8ff` 是对的但尾部不对。

```python
def _aes_decrypt(self, encrypted):
    try:
        dec = AES.new(self.IMG_KEY, AES.MODE_CBC, self.IMG_IV).decrypt(encrypted)
        if dec[:3] == b'\xff\xd8\xff' or dec[:8] == b'\x89PNG\r\n\x1a\n':
            end = dec.find(b'\xff\xd9')
            if end != -1:
                return dec[:end + 2]
            return dec
        try:
            return unpad(dec, AES.block_size)
        except Exception:
            return dec
    except Exception:
        return encrypted
```

## 3. 诊断：代码全 OK 但壳端不显示

如果 `debug /sdcard/*.txt` 显示：
- `status_code=200`
- `content-type: binary/octet-stream`
- `AES 解密后 \xff\xd8\xff` 签名 ✓
- `ext=jpg`
- size 正常（16KB~50KB）

但仍然不显示图 → **问题不在代码层，在 CDN 层或壳端解码层**。优先检查 CDN 域名是否是 `image.cpckgr.cn`，是就换成 `pic.yrfmba.cn`。

## 4. `localProxy` 完整标准写法

```python
def proxyPic(self, params):
    url = base64.b64decode(params['url']).decode('utf-8')
    try:
        proxies = self.session.proxies or None
        r = self.session.get(url, headers={"User-Agent": "Mozilla/5.0",
                                           "Referer": self.xurl + "/"},
                             timeout=10, verify=False, proxies=proxies)
        if r.status_code == 200 and r.content:
            data = self._aes_decrypt(r.content)
            ext = self._detect_ext(data)
            mime = {'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
                    'png': 'image/png', 'webp': 'image/webp'}.get(ext, 'application/octet-stream')
            return [200, mime, data]
        return [404, 'text/plain', 'not found']
    except Exception:
        return [500, 'text/plain', 'error']
```

关键要点：
- **必须走代理**（`proxies=self.session.proxies or None`）
- **返回 `[200, mime, data]` 三元组**（不是 base64 字符串）
- AES 解密后**截断到 `\xff\xd9`**