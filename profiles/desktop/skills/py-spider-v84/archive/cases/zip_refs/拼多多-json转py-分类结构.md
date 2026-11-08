# 拼多多.py json 转 py：分类结构映射 + 分页字段 + 域名测活保留（2026-08-24）

`/opt/data/archive/xbpq资料/拼多多.py`（色多多 sddww.xyz，json 转 py）。本文件记录 data-preview 直链站**转 py 时的分类/筛选/翻页/域名**全套要点（播放链路见 `拼多多播放链路修复-data-preview错位.md`，羊壳没数据见 `羊壳py没数据排障清单.md`）。

## ⚠️ 分类结构必须按 json"分类"字段实现（用户"现在的分类不行"纠正）

第一版自作主张平铺了站内 29 个 fenlei 分类（私房俱乐部/国产精选/学生少女...），被用户打回："现在的分类不行"、"要按 json 格式写"。json 的分类是**虚拟分类 + folder 二级 + 词条筛选**结构，转 py 必须逐项映射：

| json 分类 | py type_id | URL 逻辑 |
|-----------|-----------|---------|
| 所有视频 | `video` | `?video={pg}.html` |
| 推荐类型 📁 | `rec_types` | 主页 category-items__col 列表 → folder 项 |
| 所有类型 📁 | `all_types` | `?categories={pg}.html` → folder 项 |
| 推荐标签 📁 | `rec_tags` | index.php `?tag=xx` submenu → folder 项 |
| 所有标签 📁 | `all_tags` | `?tags-ch-all.html`（fenlei 81 + tag 25）→ folder 项 |
| 吃屎喝尿 | `吃屎喝尿` | `?search=吃屎喝尿&p={pg}` |
| 自定义词条 🔍 | `custom` | `?search={词条}&p={pg}`，filters 提供词条选项 |

**folder 二级实现**（missav 风格 + dir_ 前缀分发）：
```python
# folder 项（categoryContent 返回）
{'vod_id': 'dir_fenlei:私房俱乐部', 'vod_name': '私房俱乐部',
 'vod_pic': '', 'vod_remarks': '类型', 'vod_tag': 'folder'}
# categoryContent 开头按前缀分发
if tid.startswith('dir_fenlei:'): url = f'{host}/?fenlei={tid[11:]}&p={page}'
if tid.startswith('dir_tag:'):    url = f'{host}/?tag={tid[8:]}&p={page}'
```
- 推荐类型/所有类型抓 `category-items__col[^>]*><a href="/\?fenlei=([^"]+)"`（去重 dict.fromkeys）
- 推荐标签抓 index.php 的 `href="/\?tag=([^"]+)"[^>]*>([^<]+)</a>`（submenu 25 个）
- 所有标签 = fenlei 正则 + tag 正则拼接（351 个）

## ⚠️ 自定义词条 = filters + 搜索组合（用户"默认的那几个我不喜欢重换几个"）

json 的"类型"字段（`屎&尿&肛交&灌肠`）→ py 的 filters：
```python
filters = {'custom': [{'key': '词条', 'name': '词条',
    'value': [{'v': w, 'n': w} for w in 词条列表]}]}
# categoryContent('custom') 里 for d in [filter, extend] 读 d.get('词条')
```
- 词条就是搜索词：`?search={词条}&p={pg}`
- **选词条先实测有没有数据**（GET `?search={词}&p=1` 数 data-preview）：拼多多实测 丝袜/黑丝/白丝/制服/护士/教师/空姐/口爆/颜射/自慰 全 28 条；用户明确否掉了 json 默认的 屎/尿/肛交/灌肠
- filters 只挂 custom 一个 type_id（其他分类无筛选），key 用中文"词条"

## ⚠️ 分页字段四件套（用户"有的分类视频少，是不是没写翻页"实证）

categoryContent/searchContent 返回必须带 page/pagecount/limit/total，壳才显示翻页按钮：
```python
return {'list': vods, 'page': page, 'pagecount': 9999, 'limit': 30, 'total': 999999}
```
分类 p1 只有 8 条是站点数据少（p2 有 28 条），不是 bug——但**不带 pagecount 用户就翻不了页**，表现为"分类视频少"。

## ⚠️ 域名测活必须保留（用户"域名测活要保留，那你要按照json格式来写"）

为提速把 host 写死成第一个候选（init 0.00s）被用户纠正——json 有发布页机制，py 必须保留多候选自动测活（第一个可用即用），不能写死：
```python
self.host = DOMAINS[0]   # 先默认
try:
    for d in DOMAINS:
        r = requests.get(d + '/', headers=self.header, timeout=5, verify=False)
        if r.status_code == 200 and 'models-videos__col' in r.text:
            self.host = d; break
except Exception:
    pass
```
- 提速的正确做法是**精简 homeContent**（只请求主页 1 次，不遍历分类），而不是砍域名测活
- 测活锚点用列表页特征 `models-videos__col`（根路径 200 且含卡片即活）

## 标题兜底

所有视频/分类/标签页标题标签是空的（`<p class="mb-1"><a href="..."></a></p>` 无文字，站点 JS 懒加载、无接口）→ 用 `'拼多多-' + 视频ID` 兜底（json 标题字段的 || 备选也是截 ID）。首页/搜索页有真实标题。用户"都是数字代号"的抱怨 = 站点限制，向用户说明即可。

## 验证（json 分类版）

- 7 分类 → 用户精简后 5 分类（删推荐类型/推荐标签）：所有视频/所有类型/所有标签/吃屎喝尿/自定义词条
- 所有视频 28 条 / 所有类型 folder 81 / 所有标签 folder 351 / 吃屎喝尿 28 / 自定义词条-屎 28 / folder 点击 28 / 播放一致 ✅
- 交付：删旧文件导入、md5 `267eae57`（v6）
