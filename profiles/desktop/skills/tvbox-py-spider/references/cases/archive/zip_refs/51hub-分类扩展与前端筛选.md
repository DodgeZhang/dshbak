# 51hub 分类扩展与前端筛选（2026-08-25 用户实测）

> 51hub.py 全链路打通后的增量：用户反馈"分类有点少"→ 分类从 2 个扩到 5 个；用户要求"加个筛选"→ 发现标签筛选是纯前端。基础结构见 `51hub-CDN域名-devalue实战.md`。

## 分类扩展：导航只有 2 个，但每页都是独立内容池

网站导航只有 2 个分类路由（AISD=AI短剧 / OSD=原创短剧），**每个页面都是独立内容池**，可扩成更多分类（用户实测通过）：

| type_id | type_name | URL | 内容 |
|---------|-----------|-----|------|
| home | 首页推荐 | `/` | 首页卡片（drama-detail href） |
| AISD | AI短剧 | `/drama/AISD/` | ~30 卡片（drama-play href） |
| OSD | 原创短剧 | `/drama/OSD/` | ~11 卡片 |
| explore | 最新剧集 | `/explore-drama` | 20 卡片（**无斜杠结尾！**） |
| rank | 热门榜单 | `/rank-drama` | 20 卡片（热门排序） |

⚠️ explore/rank 路径**不带尾部斜杠**，`/explore-drama/` 会 404。categoryContent 里路由判断要精确，不能统一拼 `/drama/{tid}/`：
```python
if tid == "home": url = self.host + "/"
elif tid == "AISD": url = "%s/drama/AISD/" % self.host
elif tid == "OSD": url = "%s/drama/OSD/" % self.host
elif tid == "explore": url = "%s/explore-drama" % self.host
elif tid == "rank": url = "%s/rank-drama" % self.host
```

## ⚠️ 标签筛选是纯前端 — filters 只能做显示，服务端不认参数

页面 span 里挖出 35 个标签词（成人/AI漫剧/51原创/致富/修仙/厨神/读心/今古联通/女性成长/鉴宝/亲情/末世/武侠/萌宠/萌宝/真假千金/青春/现言/奇幻/战神/宫斗/古言/玄幻/脑洞/权谋/年代爱情/种田/悬疑/民国爱情/轻松喜剧/志怪/超能/强制），但**服务端不接受任何 URL 参数过滤**：

- `/drama/AISD/?tag=AI漫剧` → 200，30 张卡片（与不带参数完全相同）
- `?category=...` / `?keyword=...` → 同样 30 张（404 才不同）
- 结论：标签筛选是前端 JS 内存过滤，py/xbpq 源做不到真筛选

**做法**：filters 面板照常加（`sort` all/latest/hot + `tag` 35 词，`filter_dict = {c["type_id"]: groups for c in class_list}` 全分类共用），categoryContent 解析后**忽略筛选值**照样返回全量列表——用户体验上是"有筛选面板"，实际不过滤。

**判断法（写任何源时复用）**：给分类页 URL 试加 `?tag=`/`?category=`/`?keyword=` 等参数，返回卡片数不变 = 前端筛选，别浪费时间做服务端筛选逻辑；只有卡片数变化才是真后端筛选。
