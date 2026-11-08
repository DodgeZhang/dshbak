# 绮梦短剧分类接口修正：theater/dramas genre 参数失效 → feed/items（2026-08-24）

**触发**：shorttv.py v1 交付后用户反馈"分类都是错误的，每个标签页下面内容完全相同"。

## 根因

`theater/dramas?genre={slug}` 的 **genre 参数被服务端忽略**——`?genre=t-ucs0xp` / `?genre=t-k3onqj` / `?genre=urban` / 不带 genre **全部返回同一份默认推荐列表**（首条都是"淫魔重生之情欲江山"）。对照实验（2026-08-24 实测）：

```
theater/dramas?genre=t-ucs0xp&limit=10  → 淫魔重生之情欲江山/豪门宠妻/夫妻游戏...
theater/dramas?genre=t-k3onqj&limit=10  → 淫魔重生之情欲江山/豪门宠妻/夫妻游戏...（相同！）
theater/dramas?genre=urban&limit=10     → 淫魔重生之情欲江山/豪门宠妻/夫妻游戏...（相同！）
```

**判定法**：先 GET 两个不同 genre + 无 genre，对比首条 id 是否不同；相同 = genre 参数无效，换接口。

## 正确接口：feed/items

```
GET /api/v3/public/feed/items?genre={slug}&limit=20&cursor={cur}
```

不同 genre 返回**完全不同**内容（t-ucs0xp/t-k3onqj/urban 三组 id 两两不重叠）。同站还有 `/api/v3/public/feed/initial`（单条 feed 流，不适合列表源）、`/api/v3/public/webpc/home`（首页 hot/updates）。

## feed/items 关键细节（全踩过）

| 项 | 值 | 踩坑说明 |
|----|----|---------|
| **item 结构** | `{id, drama:{...}, trailer_url}` | 剧信息（title/cover_url/total_episodes）在 **`drama` 字段**，不在顶层！`_card()` 必须先 `if 'drama' in item: item = item['drama']`，否则标题全空 |
| **limit 上限** | **20** | limit=30 → 400（theater/dramas 上限 30、rankings 上限 50，各端点不同） |
| **翻页** | **cursor**（`next_cursor`） | `offset` 参数无效（offset=20 返回 0 条）；`page` 参数也无效（p1/p2 相同） |
| **排序筛选** | **`sort_by=`** | `sort=new` 返回 0 条；`sort_by=hot|new|newest|popular|latest|follow` 全部有效且内容不同（热度/最新/人气/最新发布/追剧榜）。filters 定义 `{'key':'排序','name':'排序','value':[{'v':'hot','n':'热度优先'},...]}`，categoryContent 里 `for d in [filter, extend]: if isinstance(d, dict) and d.get('排序')` 读取 |

## 分类 slug 来源

主页"内容筛选"区 href 的 `?genre={slug}`：国产剧 `t-ucs0xp`、动漫 `t-k3onqj`、萝莉 `t-c2lbi7`、系统 `t-kv5ena`、创作者 `t-mqnyjd`、都市 `urban`、悬疑 `mystery`、犯罪 `crime`、喜剧 `comedy`、家庭 `family`、青春 `youth`、校园 `campus`。

## 通用教训（写 SPA 站 py 源时）

1. **"分类内容全相同" 第一嫌疑 = 筛选参数被服务端忽略**，不是解析 bug——先对照不同参数值返回的 id 列表
2. **同站不同端点参数语义可能完全不一致**：theater/dramas 与 feed/items 都叫 genre，一个失效一个生效；翻页机制也是 cursor/offset 混用，逐端点实测
3. **付费短剧站**：`episode.locked=True` 无 playback_url（付费墙）；`sensitivity=SENSITIVE` 剧游客无播放链接（需登录成人确认）——这些在 detailContent 里 `continue` 跳过即可，不是 bug

完整 API 端点表见 `references/短剧站API-绮梦短剧.md`（该文件是 v1 探测记录，本文件是 v3 分类修正增量；成品 `templates/shorttv.py` 已含 feed/items + sort_by 筛选实现）。
