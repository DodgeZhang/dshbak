# 51短剧 v2（sysrycady 系列 Nuxt SSR）完整结构笔记

> 2026-08-25 定稿，用户 v2 版 `51hub.py`（649 行）+ 用户提供的发布页/图片映射/播放源码三件套文件。
> 之前 v1 版（adjust.cbpjoocbe.com）已废弃。

## 域名自动获取链（关键！）

```
永久发布页: https://51dj20.com/
  → <a id="*" href="https://odyewhhxh.cc/"> 抓实时发布页
  → 实时发布页源码里找 Base64.decode("密文")
  → 密文 b64 解码得到真实页面源码
  → 源码里找 words.random() + ".sysrycady.com"（后缀）
  → 前缀: abcdefghjkmnpqrstuvwxy23456789 随机取 5 字符
  → 最终域名: https://{{前缀}}{{后缀}}/
```

- **前缀字符集固定**: `abcdefghjkmnpqrstuvwxy23456789`（注意没有 i/l/o，防混淆）
- **后缀候选可能多个**（发布页 b64 里可能有两个 `words.random() + "..."`，如 `.sysrycady.com` 和 `.uwfahpmwu.cc`，取第一个）
- **DNS 抖动**：前缀 + 后缀组合偶有解析失败，`_get()` 重试 3 次 + 换前缀再试
- **发布页缓存**：永久发布页 URL 缓存到 `cache_publish`（进程级一次即可）

## 数据结构（Nuxt SSR + __NUXT_DATA__ devalue）

全部数据在 `<script id="__NUXT_DATA__">` 里，devalue 序列化扁平数组 + 整数索引引用。

### devalue 解析要点

- 顶层数组；整数 = 引用到数组前面索引；字符串/数字/对象/数组直接解析
- **⚠️ ShallowReactive/Reactive/Computed 包装**：`["ShallowReactive", idx]` 形式表示包装了一个引用 → **resolve 时要自动解包**（`isinstance(v, list) and v[0] in ("ShallowReactive","Reactive","Computed")` → 返回 resolve(v[1])）
- **⚠️ 演员列表判别**：NUXT_DATA 数组里同时有视频对象（含 `video_id`）和演员对象（含 `actor_id`），不能仅靠 id/name 判别 → **必须检查 `works` 或 `videos` 字段**（演员对象必有，视频对象没有）

### 各页面结构

| 页面 | 结构 |
|------|------|
| 首页 `/` | NUXT_DATA 数组含视频对象列表 |
| 分类 `/drama/AISD/` `/drama/OSD/` | NUXT_DATA 数组含 30 张卡片 |
| 探索 `/explore-drama/9-0-0-0-0-0/` | 筛选参数 6 段 |
| 排行榜 `/rank-drama/week/` `/rank-drama/month/` | 卡片 20 张（**周榜/月榜/总榜/热度榜服务端返回同一份数据**！不要重复） |
| 男演员 `/explore-actor/2/` 女演员 `/explore-actor/1/` | 演员卡片（actor_id/name/avatar + works/videos） |
| 演员榜 `/rank-actor/recommend/hot/new/` | 演员卡片 |
| 演员详情 `/actor-detail/{id}/` | `data:{info:{id/gender/name/avatar/works:{list:[...]}/intro/...}, list:{...}}` |
| 视频详情 `/drama-detail/{vid}/` | `video_id/title/cover/tags/description/actor_list/play_count_text/chase_count/serialize_status_text/episodes/video_url` |
| 播放页 `/drama-play?id={vid}&episode_id={ep_id}` | NUXT_DATA 里 `video_url`（单集 m3u8）+ `episodeAll`（全集列表） |

### 图片

- 直链: `pic.xustgq.cn/upload_01/.../xxx.jpg`
- **AES-CBC 加密**：下载内容才是密文，页面源码是明文 URL
- 密钥: key=`f5d965df75336270` iv=`97b60394abc2fbe1`（与 51吃瓜/91jav/每日大赛 同一套！）
- 走 localProxy: 列表/详情图片用 `_img_proxy` 包装 `getProxyUrl()&type=tbr_img&url=b64`；localProxy 下载→AES-CBC 解密→魔数识别（`\xff\xd8\xff`/`\x89PNG`/`GIF8`/`RIFF+WEBP`）→返回正确 mime
- 演员头像路径: `pic.xustgq.cn/files/novelquickVideo/{id}/avatar_XXX.jpg`（同 AES 密钥）

### 播放

- 播放页 NUXT_DATA 里 `video_url` 字段直接是 m3u8 直链（`https://hls.dscxru.cn/videos5/...?auth_key=...&v=3&time=0&via=51duanju`）
- 每集独立 m3u8；`episodeAll` 数组含 `{id, title, video_url}` 每集对象
- 播放串格式: `标题$剧vid:集id`（playerContent 拆开后请求 `/drama-play?id={vid}&episode_id={ep_id}`）
- **auth_key 有时效**（约 1 分钟），所以播放地址必须实时请求获取，不要缓存

### 副标题/简介

- 副标题: `共{集数}集 | {连载状态} | 热度{play_count_text} | 追剧{chase_count}`
- 简介: NUXT_DATA 里的 `description` 字段（不是 intro，intro 常为空或引用别处）

### 演员二级

- 详情页 NUXT_DATA: `data:{"info":{...}, "list":{"total":N, "page":N, "list":[...]}}`
- 演员 `info` 对象含 `works.list` 或 `videos` 数组，每项含 `video_id/title/cover/tags/episode_id`
- **播放串** = 每个作品 `作品名$视频vid:集ep_id`（集 ep_id 是视频对象里的 `episode_id` 字段）
- 演员 id 是数字（757/532/963 等），**不是"只待千帆尽"这种文本**（文本是视频标题误判）

## 坑

1. **演员列表误判**：NUXT_DATA 数组里视频对象也会误匹配 `name` 字段 → 必须检查 `works` 或 `videos` 键存在才算演员
2. **ShallowReactive 不解包**：resolve 时不把 `["ShallowReactive", idx]` 解引用 → 拿到的是 `[None, None]` 数组，所有字段都是 None → 演员二级详情拿不到 → 返回空
3. **首页和推荐页重复**：`/` 和 `/home` 内容一样 → 只留一个分类
4. **总榜/热度榜和周榜/月榜重复**：服务端同一份数据 → 只留周榜+月榜
5. **演员榜单图片走 NUXT_DATA avatar 字段**（DOM 是占位 gif，解不出真图）
6. **演员二级播放串**：集 ep_id 取视频对象里的 `episode_id` 字段，不要拿 `video_id` 当 ep_id