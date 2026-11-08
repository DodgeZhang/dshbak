# getav.me 反爬分析（2026-08-26 调试实录）

## 结论

getav.me 用 Cloudflare 反爬，非浏览器请求一律返回 403 / fallback 页。必须走代理且带 browser-like UA + Referer + cookies。

## 实测

| 访问方式 | 结果 |
|---|---|
| 本机直连 | Network is unreachable（被墙） |
| 走 192.168.31.66:7890 代理 | 首页 403 CF，API 200 JSON ✅ |
| 各种代理端口（7890/1080/24780...） | 全 ERR，本机无可用代理 |

## 关键

- `API 路径`：`/api/movies`、`/api/stars`、`/api/genres`、`/api/producers`、`/api/publishers`、`/api/codes`
- `cookies`：`cf-country=CN`、`age_verified_at=时间戳ms`、`age_verification_policy=1%3ADEFAULT%3A18`
- UA 必须 Android 手机格式
- 页面是 Next.js，首页 HTML 是 SSR，API 是 JSON

## 搜索结果

搜索结果 AJAX 和 HTML 都返回正确的匹配内容，不存在晴天影院那样的"猜你喜欢"问题。