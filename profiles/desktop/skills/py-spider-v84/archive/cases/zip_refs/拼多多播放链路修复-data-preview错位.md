# 拼多多.py 播放链路修复：data-preview 错位 + 分片 CDN 排查（2026-08-24）

`/opt/data/archive/xbpq资料/拼多多.py`（json 转 py，data-preview 直链站）。本文件记录**"列表解析全绿但用户点播放失败"**的根因与修复，以及播放链路逐级排查法。

## ⚠️⚠️ 播放不了根因：详情页第一个 data-preview 是推荐位/别的视频

列表解析出的播放链接完全正确（替换 .com 后 200、子流 200、分片 200），但用户点击播放失败。

**根因**：detailContent 请求详情页 `/?play-{vid}-{pg}-.html` 后 `re.search(r'data-preview=...')` 抠到的是详情页里**推荐位/其他视频**的 data-preview，不是当前视频——列表首条 m3u8 是 `20251119/qLW7tAtU`，详情页抠到的却是 `20251009/sQRi8ZQR`。播放器拿到错误视频链接（或拿不到），表现为"播放不了"。

**正解 = 列表即播放，vod_id 编码 m3u8，detailContent 不再请求详情页**（与 json 版行为完全一致——json"链接"字段=列表项 data-preview，点击直接播，`;;z` 直接播放）：

```python
# _parse_videos 里
vods.append({
    'vod_id': 'm3u8:' + play_url,   # ★ vod_id 直接编码播放链接
    'vod_name': title,
    'vod_pic': pic,
    'vod_play_from': '正片',
    'vod_play_url': '正片$' + play_url,   # 列表即带播放
})

# detailContent：m3u8: 前缀直接返回，绝不二次解析详情页
def detailContent(self, ids):
    vid = ids[0] if isinstance(ids, list) else ids
    if isinstance(vid, str) and vid.startswith('m3u8:'):
        play_url = vid[5:]
        return {'list': [{'vod_id': vid, 'vod_name': '拼多多视频',
                          'vod_play_from': '正片', 'vod_play_url': '正片$' + play_url}]}
    return {'list': []}

# playerContent：parse=0 免嗅直链 + header（兼容 m3u8: 前缀）
def playerContent(self, flag, id, vipFlags=None):
    url = str(id or '')
    if url.startswith('m3u8:'):
        url = url[5:]
    return {'parse': 0, 'playUrl': '', 'url': url, 'header': self.header}
```

**通用规则：json"链接"字段直接是 m3u8（data-preview/data-play-src 类）时，py 必须列表即播放（vod_id 编码 m3u8），不要设计"详情页二次解析"**——详情页首个播放属性几乎都是推荐位。

## ⚠️ 播放链路排查必须测到底（主 m3u8 200 ≠ 能播）

拼多多播放链路：主 `https://ckbhm3u8.com/.../index.m3u8`（200）→ 子流清单（200）→ **分片伪装 `.jpg` 后缀 + AES-128 加密**：

```
#EXT-X-KEY:METHOD=AES-128,URI="https://ckts2.top/.../key.key"
https://ckts2.top/.../gSyrwNJQ.jpg    ← 内容实际是 AES 加密视频流
```

- **分片/key 在另一 CDN 域名（ckts2.top），不在用户替换规则（ckbhm3u8.vip→com）覆盖范围内**——用户替换规则只保主 m3u8 域名，分片域名独立
- 排查"播放不了"逐级测：主清单 → 子流清单 → 分片/密钥域名（手机浏览器能下载 key.key 16 字节 = CDN 通）。**分片域名手机不可达则整源播不了，与 py 代码无关**
- 对照测试定位：json 版能播 + CDN 通 → 问题在 py 播放链路细节（本案例 = data-preview 错位）；json 版也不能播 → 站点 CDN 问题

## 验证（修复后）

- 列表/详情/playerContent 三处 m3u8 完全一致（`20251119/qLW7tAtU/index.m3u8`）
- py_compile 通过；md5 `206ec64f`
- 交付提醒：删旧文件再导入、ext 留空（代码自动发现域名）
