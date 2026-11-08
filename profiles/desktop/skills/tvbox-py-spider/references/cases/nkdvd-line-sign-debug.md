# 耐看点播：MacCMS 线路错位与 XOR 双字母表 sign 解密实战

<!-- 演进: 2026-08-28 | 来源: nkdvd.me | 类型: troubleshoot -->

## 现象

1. 线路出现“选择播放源”，名称与剧集错位。
2. 按 URL 中间数字排序后，网页线路顺序被打乱。
3. `playerContent` 返回 `parse:0`，但 URL 仍是 `/player/...html`。
4. API 解密后出现 `yeerx://`、`mttby://` 等乱码协议。

## 真实结构

详情页显示顺序：`QS蓝光 / BF / FF / RY / YZ / LZ`。
首集 URL 的 sid 顺序却是：`6 / 2 / 1 / 4 / 5 / 3`。

播放页字段：

```json
{"from":"qsvip","sid":6,"nid":1,"link":"/player/63734-1-1.html","link_next":"/player/63734-6-2.html"}
```

`playerconfig.js` 映射：

```text
qsvip → QS蓝光
bfzym3u8 → BF
ffm3u8 → FF
rym3u8 → RY
1080zyk → YZ
lzm3u8 → LZ
```

## 根因

- `选择播放源` 是 UI 标题，不是线路。
- `sid` 是内部编号，不等于展示位置；`sid-1` 索引 tab 会错位。
- `player_aaaa.link` 是默认入口字段，不能识别当前线路。
- `encrypt=0` 不代表站点自定义 `url` 是明文。
- 旧解密只做 XOR/Base64，遗漏 `sign → deString` 双字母表替换。
- 字母表方向反了也不会报错，只会产出“像 URL 的乱码”。

## 修复与验证

1. 过滤 UI 标题和重复“立即播放”链接。
2. 用 `sid` 分组，用首次出现列表保持详情页顺序。
3. 请求每组首集读取 `from`，用 `player_list[from].show` 命名。
4. POST `/player/api.php`，完整复刻 `customStrDecode + sign + deString`。
5. 以 `http(s) + .m3u8/.mp4 + 实际响应` 为成功标准。

实测 `vod_play_from = QS蓝光$$$BF$$$FF$$$RY$$$YZ$$$LZ`，QS/BF/FF 均返回真实 HTTPS m3u8，URL 不再包含 `/player/`。

## 可复用结论

播放链应拆成 `sid → from → show → media URL` 四层。完成判定必须落到真实媒体清单，不能停在字段名、API 成功码或 `parse:0`。
