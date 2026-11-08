# 加密 API 与游客身份模块 v8.4

处理 Vite/SPA 加密 API、AES 参数加密、响应解密、API 域名候选、guest token、成人确认和登录/付费墙边界。

## 适用特征

- JS 中出现 `VITE_BASE_URL`、`VITE_APP_API_BASE_URL`、`parameterKey`、`parameterIv`、`hash:true`、`data=<密文>`。
- GET/POST 参数被整体 AES 加密，响应 data 也可能是密文。
- API 返回 401、需要 guest/anonymous token、成人确认后免费内容才给播放链接。
- `episode.locked=True` 或明确付费集无 playback_url。

## 核心规则

- API 域名候选要从 JS 数组中提取并逐个探活，第一个可用即用。
- GET 参数若加密成 base64，必须 URL 编码；base64 中 `+/=` 不编码会导致参数错误。
- key/iv 必须按 JS 实测；有的站 key 与 iv 相同且固定 16 字节。
- 请求头字段大小写按实测，例如 `X-Zone` 不能随意改成 `Zone`。
- Go/后端校验错误可反推字段名和嵌套结构，但未解字段不能硬猜完成。
- 遇到成人确认/敏感内容，优先寻找 guest/anonymous 注册和 confirmAge/adult-confirmation 流程；拿到 token 后再请求免费集。
- 明确 locked/付费集没有 playback_url 时跳过，不用污染全局逻辑或伪造播放地址。

## 门禁

- 分别测试加密 GET、加密 POST、响应解密。
- token 流程测试：guest → confirm → playback。
- locked 集必须识别并跳过；免费集必须可播。
- 未破解字段或签名时写阻塞报告，不宣称完成。

案例参考：`../cases/archive/zip_refs/91红果-API加密破解.md`、`../cases/archive/zip_refs/游客身份解锁登录墙-付费墙API站.md`。