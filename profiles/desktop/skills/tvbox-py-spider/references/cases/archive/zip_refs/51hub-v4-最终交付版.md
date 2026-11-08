# 51短剧 v4 最终交付版（自动缓存 + DOM 演员列表）

文件：`/opt/data/out/51hub.py`（360 行，全链路验证通过）

## 分类组织

用 **1 个 `actor` 分类 + 筛选面板** 替代拆多个独立分类：
- `actor` 分类筛选项 `sort` 取值：`1`=女演员 / `2`=男演员 / `recommend`=推荐榜 / `hot`=热度榜 / `new`=新人榜 / 默认=热门
- 剧集分类：`drama`（explore-drama 6 段参数 + filters 面板）、`drama_week`、`drama_month`、`aisd`
- URL 路径：`explore-actor/{1|2}/`、`rank-actor/{recommend|hot|new}/`、`rank-drama/{week|month}/`

## 演员列表页解析：DOM 兜底（关键坑）

**坑**：`_walk(NUXT_DATA, ["actor_id","name"])` 在演员列表页会同时匹配到剧集对象（视频对象也带 id/name 字段），导致把剧名当演员名。

**解决**：直接解析 HTML DOM 里的 `href="/actor-detail/(\d+)/"` 链接拿演员 ID 列表；NUXT_DATA 只用于补充演员元数据（works/fans_count）做副标题。

## 演员二级（`actor_detail_` 前缀）

- `vod_id = "actor_detail_" + aid`，`vod_tag = "folder"`
- `detailContent` 访问 `/actor-detail/{aid}/`，NUXT_DATA 顶层结构 `{"info":{...}, "list": {"total":N,"page":1,"limit":20,"list":[作品]}}`
- 遍历 `list.list` 转剧集 vod，返回数组（每剧独立 vod_id，vod_tag="video"）
- **必须包含** `vod_play_from` 和 `vod_play_url` 字段（v3 漏了，导致壳端无法播放）

## 演员头像：自动预取缓存（去掉手动文件依赖）

- 列表页初始化时批量拉前 15 个缺图演员的详情页
- `_actor_cover(aid)` 访问 `/actor-detail/{aid}/`，从作品列表取第一张封面当头像
- 同时把该演员所有作品的 `cover` 缓存在 `image_id_map[video_id]`（后续进该剧详情直接用，不重复请求）
- **递归调用 `detailContent` 拿头像是死循环**——v3 就是这样慢，直接走 `_req + _payload + _walk` 拿作品列表

## 图片链

- 剧集封面：`pic.xustgq.cn/upload_01/upload/YYYYMMDD/...`，走 shell 端 `localProxy` AES 解密（key `f5d965df75336270` / iv `97b60394abc2fbe1`）
- 演员头像：走作品封面直链（不走 `/files/novelquickVideo/.../avatar.jpg`，服务器返回 0 字节）
- 图片代理参数 `type=img`，URL base64 编码

## 播放

- 剧集播放：vod_id 存 `drama-play?id={vid}&episode_id={eid}` 完整 URL，`playerContent` 直接返回（parse=0，header 带 UA+Referer）
- 演员作品同理，vod_id 就是 drama-play URL

## 域名解析链路

`51dj20.com` → 抓 `a[href]` 拿实时发布页 → 抓 `Base64.decode("...")` b64 解码 → 匹配 `words.random() + 'xxx.sysrycady.com'` 取后缀 → 前缀 5 字符随机（`abcdefghjkmnpqrstuvwxy23456789`） → 拼 `https://{前缀}{后缀}/`

## 验证结果

| 测试项 | 结果 |
|---|---|
| 男演员 20 人 | 全部有头像（作品封面） |
| 女演员 20 人 | 全部有头像 |
| 演员二级 | 显示该演员所有参演剧集，每条都有图 |
| 演员作品播放 | m3u8 直链 |
| AI短剧 30 部 | 有图 + 副标题（播放 2.2W） |
| 周榜 20 部 | 有图 |