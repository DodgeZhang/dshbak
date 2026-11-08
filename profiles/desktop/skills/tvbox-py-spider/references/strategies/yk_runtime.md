# 羊壳/海阔 py 运行时兼容模块 v8.4

处理本机测试通过但羊壳/海阔里“没数据、只有推荐页、分类空白、翻页按钮缺失”的运行时差异。

## 适用特征

- 用户反馈“壳里没数据”“只有推荐页”“分类不显示”“推荐页空”。
- XBPQ/JSON 转 py，或从普通 Python 脚本改成 `base.spider.Spider` T4 源。
- 本机直接调用六接口正常，但客户端加载异常。

## 强制规则

- T4 必须 `from base.spider import Spider` 且 `class Spider(Spider)`。
- 必须实现 `homeVideoContent(self)`，返回 `{"list": [...]}`；推荐页常调用它，不存在会显示空。
- `homeContent(self, filter)` 必须返回 `class`；分类必须是 `{"type_id":..., "type_name":...}` 字典列表，不是字符串列表。
- `filters` 必须是 dict；没有筛选就 `{}`，不要返回 list。
- `categoryContent` 返回必须含 `page/pagecount/limit/total/list`；`pg` 入参先转 int。
- `detailContent` 返回 vod 必须含 `vod_play_from` 和 `vod_play_url`，否则壳端无法播放。
- 方法签名用标准参数：`homeContent(self, filter)`、`homeVideoContent(self)`、`categoryContent(self, tid, pg, filter, extend)`、`detailContent(self, ids)`、`searchContent(self, key, quick, pg="1")`、`playerContent(self, flag, id, vipFlags)`。

## 标准片段

```python
def homeVideoContent(self):
    return {"list": self._list(self._get(self.host))}

def categoryContent(self, tid, pg, filter, extend):
    pg = int(pg) if str(pg).isdigit() else 1
    return {"page": pg, "pagecount": pagecount, "limit": limit, "total": total, "list": items}
```

## 排障顺序

1. 先查是否继承基类、类名是否为 `Spider`。
2. 查 `homeVideoContent` 是否存在。
3. 查 `homeContent.class` 和分类字段格式。
4. 查 `filters` 是否 dict。
5. 查分类/搜索是否有 `page/pagecount/limit/total`。
6. 查详情是否输出线路字段。

案例参考：`../cases/archive/zip_refs/羊壳py没数据排障清单.md`、`../cases/archive/zip_refs/py源转换方法论.md`。