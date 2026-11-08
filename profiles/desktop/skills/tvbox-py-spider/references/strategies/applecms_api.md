# 苹果 CMS API 实战模块 v8.4

处理 MacCMS/苹果 CMS 采集 API 源、主分类为空、子分类合并翻页、批量补图、suggest 搜索和验证码搜索限制。

## 适用特征

- 存在 `/api.php/provide/vod/`、`ac=list/detail`、`t=`、`ids=`、`wd=`。
- `t=主分类id` 返回 0 条，但子分类有数据。
- 列表接口无图或部分图空，需要详情接口补图。
- HTML 搜索页触发“系统安全验证”或 `mac_verify`。

## 核心规则

- 采集 API 详情给出 `vod_play_from/vod_play_url` 后仍要逐集判断：确认是 http/https m3u8/mp4 才能 `parse=0`；解析器、iframe、播放页必须交给 `playerContent` 递归解析。
- 主分类只是容器时，`categoryContent` 必须轮询 CAT_SUBS 子分类合并；不要把主分类空误判成站坏。CAT_SUBS 是站点实测配置，禁止自动把所有分类盲目合并。
- 子分类页数差异大时，第 N 页应取各子分类第 N 页，跳过空页并合并去重；不要固定每个子分类取少量导致越翻越稀。
- `ac=detail&ids=` 常见单次最多只返回 20 条；只有列表图片缺失时才按需补图，必须分批请求并按 vod_id 映射回填，不能按返回顺序猜；列表已有图片时禁止额外补图请求。

## 按需辅助实现

```python
def _merge_subcats(self, main_id, pg):
    out, seen = [], set()
    for sid in self.cat_subs.get(str(main_id), []):
        data = self._json(self.api, {"ac":"list", "tid":sid, "pg":pg})
        for v in data.get("list", []):
            vid = str(v.get("vod_id", ""))
            if not vid or vid in seen: continue
            seen.add(vid); out.append(self._item(v))
    return out

def _fill_pics(self, items, batch=20):
    missing = [str(v.get("vod_id", "")) for v in items if v.get("vod_id") and not v.get("vod_pic")]
    pics = {}
    for i in range(0, len(missing), batch):
        data = self._json(self.api, {"ac":"detail", "ids":",".join(missing[i:i+batch])})
        for v in data.get("list", []): pics[str(v.get("vod_id", ""))] = self._fix(v.get("vod_pic", ""))
    for v in items:
        if not v.get("vod_pic"): v["vod_pic"] = pics.get(str(v.get("vod_id", "")), "")
    return items
```

启用条件：只有实测 `t=主分类` 为空且已建立 `cat_subs` 映射时使用 `_merge_subcats`；只有列表图片为空时使用 `_fill_pics`。
- 搜索 API 禁用或 HTML 验证码时，先试 `/index.php/ajax/suggest?mid=1&wd={key}&limit=50`；`mid=1` 必带。
- suggest 常不支持真实分页，`page/pg/p/offset/start/pageNum` 可能全部无效；搜索只返回有限建议时要报告限制。

## 门禁

- 主分类与至少一个子分类分别测试。
- 第 1/2/3 页 id 集合对比，确认翻页不是重复页。
- 批量补图按 20 条分批，确认前几条也有图。
- 搜索验证码场景必须测试 suggest；suggest 无分页时不要伪造翻页。

案例参考：`../cases/archive/zip_refs/苹果CMS-API源.md`、`../cases/archive/zip_refs/苹果CMS-API源-翻页与补图.md`、`../cases/archive/zip_refs/apple-cms-suggest-search.md`。