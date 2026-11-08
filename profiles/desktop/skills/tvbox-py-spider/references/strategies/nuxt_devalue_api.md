# Nuxt/Devalue/API 解析模块 v8.4

处理 Nuxt SSR、Next.js/Vite SPA、`__NUXT_DATA__`/`__NEXT_DATA__`、devalue 索引数组、chunk/config.js 挖 API 和短剧类 API 站。

## 适用特征

- HTML 中主体为空或只有 app 容器，但含 `__NUXT_DATA__`、`__NEXT_DATA__`、`/_next/`、`/assets/index-*.js`、`config.js`。
- 普通 XPath/DOM 选择器为空，但源码 hydration 数据里有视频、剧集、演员、封面。
- API base 与站点域名不同，端点藏在 chunk/config.js。
- 分类参数返回内容完全一样，疑似服务端忽略参数。

## 解析规则

- Nuxt SSR 数据优先解析 `__NUXT_DATA__`，不要硬套 DOM。
- devalue 常是顶层数组，字段值可能是索引，不是直接对象；必须递归还原或写 `_walk` 扫描真实字段。
- 对象判别必须看特征字段组合：视频对象看 `video_id/episodes/cover`，演员对象看 `actor_id/works/videos`，不能只靠 `id/name`。
- 列表项带 `episode_id` 时必须保留到 `vod_id` 或播放 ID；裸 `id` 入口无 `video_url` 不代表不可播。
- API base 可能在 JS 中以 `VITE_API_BASE`、`VITE_BASE_URL`、`production.*`、openapi client base 形式出现；必须抽取并探活。
- Cursor/offset/page 逐端点实测，不可按名称猜分页。
- 如果不同分类参数返回首批 id 完全相同，第一嫌疑是参数被服务端忽略，要换端点或换字段，不要改解析器。

## Next/Vite API 发现流程

1. 请求首页，若内容为空壳，提取所有 script src。
2. 请求 `config.js` 和主 chunk，搜索 `api/`、`VITE_`、`baseURL`、`fetch` 封装函数。
3. 组合 API base + path，带 Referer/UA 测试 JSON。
4. 对不同分类/关键词/分页参数做 id 对比，确认参数有效。
5. 再生成 `home/category/detail/search/player`，HTML 仅作 fallback。

## 门禁

- 至少验证一个列表对象、一个详情对象、一个 episode/playback 对象的字段路径。
- 至少对比两个分类参数返回的 id 是否不同。
- 播放地址有时效时，`playerContent` 点击实时获取，不在 `detailContent` 缓存直链。

案例参考：`../cases/archive/zip_refs/nuxt-ssr-devalue-py源.md`、`../cases/archive/zip_refs/短剧站API-绮梦短剧.md`、`../cases/archive/zip_refs/短剧站feed-items分类修正.md`。