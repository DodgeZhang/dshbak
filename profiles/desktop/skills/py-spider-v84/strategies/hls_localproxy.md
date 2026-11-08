# HLS 与 localProxy 播放代理模块 v8.4

处理 HLS AES-128、m3u8 子清单、ts/key 代理、签名时效、data-preview/data-play-src 直链站和播放链路逐级排查。

## 适用特征

- m3u8 含 `#EXT-X-KEY:METHOD=AES-128`、KEY URI、IV。
- 主 m3u8 能访问但播放失败。
- ts/key 在另一个 CDN 域名，或客户端无法直连分片/key。
- 列表卡片含 `data-preview`、`data-play-src`、`video.url` 等直链。
- 播放链接签名 60-100 秒过期。

## 核心规则

- 播放链路必须测到底：主清单 → 子流清单 → key → ts 分片；主 m3u8 200 不等于能播。
- m3u8 明确给出 IV 时，所有分片按该固定 IV 解密；不要自己推导序号 IV。
- `localProxy type=hls` 可重写 m3u8：`#EXT` 行不动，KEY 的 `URI="..."` 包 key 代理，ts 行补全绝对 URL 后包 ts 代理。
- data-preview/data-play-src 若列表里已是 m3u8 直链，应把直链编码进 `vod_id` 或 play id，详情页不要再抓第一个 `data-preview`；详情页首个属性常是推荐位/错片。
- 有时效签名链接不能在详情页预解析后缓存；详情页放 pid，`playerContent` 点击时实时解析。
- iframe 或接口双模板时，正则不能只匹配数字 id；播放 id 可能是 16 位 hex 或字母数字。

## 门禁

- 抽测主 m3u8、子 m3u8、key、首个 ts 状态码和字节头。
- 对签名链接记录是否有时效；若有时效，必须实时解析。
- 对 data-preview 站，验证列表链接与 playerContent 输出完全一致，不被详情推荐位覆盖。

案例参考：`archive/cases/zip_refs/51hub-HLS-AES128-解密.md`、`archive/cases/zip_refs/拼多多播放链路修复-data-preview错位.md`、`archive/cases/zip_refs/91情报局播放双模板.md`。