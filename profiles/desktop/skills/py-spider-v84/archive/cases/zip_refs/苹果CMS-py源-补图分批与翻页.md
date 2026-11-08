# 苹果CMS py源：补图分批 / 主分类翻页 / 灌水去重 / 动态分类（2026-08-24 无水印资源+闪电+18j合并 三站实战）

## 1. ac=detail&ids= 单次最多返回 20 条 → 补图必须分批

**症状**：列表图片缺失呈"前几个/后几个没有"规律（不是全部没图）。
**根因**：`ac=detail&ids={逗号拼接}` 一次最多返回 20 条——请求 30 个 id 只回 20 个，
其余 10 个 id 的 vod_pic 补不上。主分类轮询合并（30 条）时表现最明显。

**正确写法**：
```python
def _fill_pics(self, vods):
    if not vods:
        return vods
    try:
        ids = [v["vod_id"] for v in vods if v.get("vod_id")]
        pic_map = {}
        for i in range(0, len(ids), 20):          # ★ 每 20 个一批
            d = self._get({"ac": "detail", "ids": ",".join(ids[i:i+20])})
            for v in d.get("list", []):
                pic_map[str(v.get("vod_id"))] = v.get("vod_pic", "")
        for v in vods:
            v["vod_pic"] = pic_map.get(str(v.get("vod_id")), v.get("vod_pic", ""))
    except Exception:
        pass
    return vods
```
- 首页 homeContent、**推荐页 homeVideoContent**（壳的推荐页走它！漏接则推荐页 0 图）、
  主分类合并、子分类直查——**所有出列表的地方都要接 `_fill_pics`**
- 检查他人代码（朋友版/大佬版 py）时先看 `_fill_pics` 有没有分批——无水印资源、闪电资源
  （shandianzy）两个站踩了同一个坑

## 2. 主分类翻页策略（每页=各子分类第 N 页合并，凑满 30，跳过空页）

苹果 CMS 主分类 id 在 `t=` 参数下返回 0 条（视频全挂子分类），主分类必须轮询 CAT_SUBS。
**翻页正确姿势**：
```python
if cid in CAT_SUBS:
    vods, seen = [], set()
    for sid in CAT_SUBS[cid]:
        if len(vods) >= 30:
            break
        d = self._get({"ac": "list", "t": sid, "pg": str(page)})  # ★ 每子分类取第 page 页
        for v in d.get("list", []):
            key = (v.get("vod_name") or "").strip()
            if key in seen:      # ★ 站点灌水数据按名称去重
                continue
            seen.add(key)
            vods.append(self._fmt_vod(v))
            if len(vods) >= 30:
                break
    if not vods and page > 1:
        return {"list": [], "page": page, "pagecount": page, "limit": 30, "total": 99999}
    return {"list": self._fill_pics(vods[:30]), "page": page, "pagecount": 9999, ...}
```
- **pagecount 给 9999**（壳显示可继续翻）；不要写 `pagecount: 1`（翻几页就停）
- 错误姿势：每页固定 `per = 30//len(subs)` 各取 2 条 → 短子分类（如 Netflix电影仅 7 页）
  翻几页耗尽 → "翻几个就看不到了"

## 3. 站点灌水数据按名称去重（喜爱夜蒲案例）

**症状**：某分类下全是同一部片子的重复条目（"喜爱夜蒲"×20，id 连续 146104→146085）。
**根因**：站点批量采集失误把同一片源重复入库（纯站点数据问题，不是解析 bug）。
**解法**：主分类合并时 `seen = set()` 按 `vod_name` 去重（见上）。子分类直查（t=56）也重复，
但直查数据量小可接受；主分类合并必须去重否则一页全是同一部片。

## 4. 动态分类写法（18j 大佬版 18J.TV.py，站改版不用改代码）

写死 MAIN_CATS 的 py 源在站点改版后会整体失效。**大佬版（714 行）的做法**：
- init 时从 `/label/sort/`（分类页）动态抓主分类 + 子分类（按位置区间切分，主分类名之间的
  链接即其子分类）
- 从 `/show/1/` 抓排序筛选、`/modol/by/hits_day/` 抓演员地区+排行、`/tags/` 抓标签排序、
  `/t/1/` 抓导航（图文/演员/标签 → nav_entries）
- homeContent 里 `filters` 按 cid 动态挂（sub 分类 + by 排序两组）
- **合并建议**：动态分类（大佬版）+ t26/t30→t33 替换（我的版）双优点合一
  → `templates/18j_合并版.py`（30KB，测试全绿）

## 5. 翻页真相总结（suggest 接口）

苹果 CMS `ajax/suggest?mid=1&wd=` 是**搜索框自动补全**（home.js autocomplete minChars:1），
**天生不支持翻页**（page=1/2/3 返回完全相同，任何参数名 pg/p/offset 都无效）；
`limit=50` 生效（能取 50 条）。搜索页（vod/search/wd/）验证码 + API "暂不支持搜索" 时，
suggest 是唯一无验证码通道 → 搜索返回固定 50 条建议，翻页做不到（接口硬限制，所有苹果 CMS 站一样）。
