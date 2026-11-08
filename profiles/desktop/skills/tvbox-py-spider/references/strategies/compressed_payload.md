# 压缩播放数据策略 v8.4
处理页面内嵌 Base64 + raw deflate/zlib 压缩的 JSON 播放数据。
## 适用特征
- 页面出现 `play_data`、`player_data` 或类似长 Base64 字符串。
- 前端引用 pako，或调用 `inflateRaw`、`DecompressionStream`。
- 解码前页面没有明确 m3u8/mp4，解码后 JSON 包含 `video`、`url`、`file` 等字段。
## 标准流程
```text
Base64
→ raw deflate 解压
→ UTF-8
→ JSON
→ video/url/file/play_url/video_url
→ 媒体地址门禁
```
## Python实现
```python
import base64
import json
import zlib

def decode_compressed_json(value):
    try:
        raw = base64.b64decode(value + '=' * (-len(value) % 4))
        data = zlib.decompressobj(-15).decompress(raw)
        return json.loads(data.decode('utf-8'))
    except Exception:
        return {}
```
## 字段提取
- 播放字段按 `video`、`url`、`file`、`play_url`、`video_url` 顺序检查。
- `info` 数组可作为标题、封面、时长回退，但不能覆盖页面已确认字段。
- JSON 解析成功不等于播放成功，最终值必须是 HTTP/HTTPS 媒体 URL。
- m3u8 需继续验证 HTTP 状态和 `#EXTM3U`；mp4 需验证响应头或媒体内容。
## 失败处理
- 解压、JSON 或字段提取失败返回空值，交给 iframe、API 或 sniff 降级链。