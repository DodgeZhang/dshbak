# 看剧AI（kanju*.com / 电影天堂前端）协议参考

2026-09-17 实测有效。同族镜像域名轮换频繁：kanju.ai、kanju19.com、kanju20.com、main.kanju13.com 等，站点名"看剧AI / KANJU.AI"，前端 project_id=`dianyingtiantang`。

## 域名发现
- `GET /v1/runtime/bootstrap`（**免签名**）返回 `canonical_host`，init 时可对 HOSTS 列表逐个探活。
- 首页是 React SPA，特征：`app-bootstrap.js`、`/assets/index-*.js`、`x-ai-movie-*` 请求头。

## 请求签名
- 算法：HMAC-SHA256，KEY（hex 字符串直接作为 key 字节）：
  `557d0e4ae929f438da6bd84412374e6086b8af09b3fed54bf22601d5bf8c54a0`
- 待签名消息（4 行，path 含 query string）：
  ```
  METHOD\npath?query\n<毫秒时间戳>\n<32位hex随机nonce>
  ```
- 请求头：
  - `x-ai-movie-timestamp`、`x-ai-movie-nonce`、`x-ai-movie-signature`（hex digest）
  - `x-ai-movie-client-name: dianyingtiantang-frontend`
  - `x-ai-movie-client-version: 1.0.0`
  - `x-ai-movie-build-version`、`x-ai-movie-protocol-version`（服务端不严格校验，可用旧 bundle 里的值）
  - `Accept: application/json`、`Referer: https://<当前host>/`
- 缺失签名返回：`401 {"code":"invalid_request_signature"}`。
- 签名对 GET query 敏感，改参数必须重新签。

## 内容接口（均需签名，基址 https://<host>）
| 接口 | 说明 |
|---|---|
| `/v1/feed/home` | 首页 sections[].cards[] 推荐 |
| `/v1/browse/catalog?kind=movie\|series\|short_drama\|anime\|variety\|documentary&page=&limit=40` | 分类片库，`genre=URL编码中文` 子类筛选，`q=` 搜索（搜索与列表同接口） |
| `/v1/catalog/{av_id}` | 详情；**episodes 一次全返回**（实测 265 集 limit 自适应，无需翻页） |
| `/v1/playback/resolve/{token}` | 线路解析，token 形如 `YJ-2ecf9f8d...`（详情 episodes[].token） |

卡片字段：`id`(av_ 开头长串 vod_id)、`title`、`poster_url`、`year`、`area`、`genres[]`、`actors[]`、`directors[]`、`remarks`。

## 播放线路（resolve 返回 line_options）
- 约 20+ 条免费直连：`url_kind:"m3u8"`、`resolved:true`、`url` 即真实 m3u8（红牛/极速/豪华/新浪/西瓜等资源站），可直接 parse 0 播放。
- 默认置顶的 `1080P-官方R` 是 `url_kind:"resolve_ticket"`，`url:"resolve://<ticket>"`，需 `POST /v1/playback/resolve-line` body `{"ticket":...}` 兑换；**实测匿名 401 `playback_user_session_required`，需登录，py 源不要依赖它**，跳过即可。
- 旧兜底直链域名 `zy.baipiaozhe.com/v1/playback/yjm3u8/{token}.m3u8`（cloudflare 后有指纹行为，仅作 try 兜底，失败不影响主线路）。
- provider_name 直接作为 vod_play_from 的线路名；各线路剧集 token 相同（用同一个 resolve token 切线路）。

## 已完成源
`haitun/ext/看剧AI19.py`，注册名 key=`看剧AI19`（config.json 与 ht.json 各一处）。
