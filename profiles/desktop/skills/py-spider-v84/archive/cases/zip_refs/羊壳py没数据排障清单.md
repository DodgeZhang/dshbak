# 羊壳 py 源"没数据"排障清单（拼多多.py 2026-08-24 实证）

用户发 json 要求转 py 后，交付版在羊壳里**整个源没数据**（本机测试全绿但壳里空）。对照用户已验证的 `templates/91情报局.py` 标准姿势重写后恢复。这是"本机测试通过 ≠ 羊壳能用"的又一例。

## 三大必备件（缺一个就"没数据"）

1. **必须实现 `homeVideoContent`**：壳的"推荐"页调用它，不存在 → 推荐页空 → 用户看到"没数据"。返回 `{'list': [...]}`（通常同 homeContent 的列表源）
2. **`homeContent` 必须返回 `'class'` 字段**：`{'class': [{'type_id': cid, 'type_name': name}, ...], 'list': [...]}`——壳靠 class 显示分类列表；只返回 list = 分类不显示
3. **分类必须是 `{'type_id':..., 'type_name':...}` 字典列表**，不是字符串列表（壳不认）

## init 顺序（防"分类空白"）

```python
def init(self, extend=''):
    self.classes = [{'type_id': '私房俱乐部', 'type_name': '私房俱乐部'}, ...]  # ① 写死主分类，最先设置
    self.host = 'https://已知可用域名'          # ② 先写死首选项（打开立即有内容）
    self.header = {'User-Agent': UA}
    try:                                          # ③ 再 try 测活覆盖，整体永不抛异常
        for d in DOMAINS:
            try:
                r = requests.get(d + '/', headers=self.header, timeout=5, verify=False)
                if r.status_code == 200 and '结构特征锚点' in r.text:
                    self.host = d
                    break
            except Exception:
                continue
    except Exception:
        pass
```

## 方法签名用羊壳标准（不用默认参数偷懒）

- `homeContent(self, filter)` / `homeVideoContent(self)`
- `categoryContent(self, tid, pg, filter, extend)` / `searchContent(self, key, quick, pg=1)` / `searchContentPage(self, key, quick, pg=1)`
- `detailContent(self, ids)`（ids 是 list）/ `playerContent(self, flag, id)` → `{'parse': 0, 'playUrl': '', 'url': id}`
- `init(self, extend='')` → 无 return 或 True 均可

## 分类页标题为空 → href 抠 ID 兜底

同一站首页卡片标题有文字、**分类页标题是空标签**（`<p class="mb-1"><a href="/?play-124247-1-.html"></a></p>`）→ 标题正则匹配不到 → `continue` → 28 卡只剩 1 条（表现为"分类没数据"）。修复：先提取 `vm = re.search(r'href="([^"]*play-(\d+)-\d+-[^"]*)"', block)`，标题 = 链接文字或 `'站名-' + ID`。**json 标题字段的 `||` 备选写法就是 py 的标题兜底链，转 py 时逐条实现**。

## 交付流程铁律

- 交付前用"最小基类环境"测试（stub base.spider，只给 getProxyUrl），不要 mock 工具方法
- 测试必须覆盖：homeContent（含 class）/ homeVideoContent / categoryContent / searchContent / detailContent / playerContent 全链路
- 提醒用户**删掉手机里旧文件再导入**（用户常测旧版导致"还是老行为"）
- py_compile 通过 + 全链路本机实测后再发
