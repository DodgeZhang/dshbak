# 苹果 CMS 标准 API 源（无水印资源.py 实战，2026-08-23）

> 站点：`https://api.wsyzy.net`（无水印资源网，苹果 CMS 系统）。成品 `templates/无水印资源.py`。
> 触发：站点主页含 `<script>var maccms={...}</script>` = 苹果 CMS → 有标准采集 API，py 源走 API 比解析 HTML 简单得多。

## 标准 API 端点

```
{host}/api.php/provide/vod/?ac=list&t={type_id}&pg={page}   # 分类列表
{host}/api.php/provide/vod/?ac=detail&ids={id}              # 详情（含线路）
{host}/api.php/provide/vod/?ac=list                          # 首页最新（不带 t）
```

- 列表返回：`{code:1, page, pagecount, total, list:[{vod_id, vod_name, type_id, type_name, vod_pic, vod_remarks}]}`
- 详情返回：`list[0]` 含 `vod_play_from`（线路名如 wsym3u8）+ `vod_play_url`（`HD$https://...m3u8#第01集$https://...` 集数格式，m3u8/mp4 直链）
- 播放：playerContent 直接 `parse=0 + url`（采集线路已是直链）
- 搜索：`ac=detail&wd={词}` → 响应 `"暂不支持搜索"`（该站禁了）；HTML 搜索页 `/index.php/vod/search/wd/{词}.html` → 返回"系统安全验证"验证码页。**搜索默认做不了是站点限制**，但用户会要求"加个弹窗手动输入验证码"→ 见下方"验证码手动输入方案"（2026-08-23 用户明确要求，无水印资源.py 已实现）

## ⚠️ 坑 4：搜索验证码手动输入方案（2026-08-23 用户要求"搜索时加个弹窗，可以手动输入验证码"实现）

**验证码机制**（苹果 CMS 标准，不是该站独有）：
- 触发：搜索页 `/index.php/vod/search/wd/{词}.html` 返回"安全验证"页（`'安全验证' in html` 或 `'mac_verify' in html` 检测）
- 验证码图片接口：**`/index.php/verify/index.html`**（JS 里 `MAC.Verify.Show()` → `maccms.path +'/index.php/verify/index.html?'`；搜索页 HTML 里没有 img，是 JS 动态加载，要自己请求这个接口拿 PNG）
- 校验接口：**`/index.php/ajax/verify_check?type=search&verify={code}`** POST（返回 `{code:1}` 成功 / `{code:1002}` 验证码错误 / PHPSESSID cookie 绑定 session）
- **校验成功后同 session（PHPSESSID）搜索放行** → 用 `requests.Session()` 跨调用保持 cookie 是关键

**py 源实现（用户认可的交互方式：用搜索框当输入框，不弹窗）**：
```
用户第一次搜"爱情" → 检测到验证码 → 下载验证码图存本地（file:// 路径给 vod_pic）
  → 返回单条 vod：vod_name="⚠️ 搜索需验证码：看图后重新输入'关键词 验证码'"
                    vod_pic=验证码图片本地路径  vod_remarks="例: 爱情 1723"
用户看图 → 重新搜索输入 "爱情 1723"（关键词 空格 验证码）
  → searchContent 里 key.rsplit(' ', 1) 拆出 search_key + code
  → POST verify_check?verify={code}（同 session）→ 再搜 → 返回结果
```
- **验证码图片必须存壳能访问的路径**（如 `/data/data/com.9xiu.box/files/cache/verify.png`），vod_pic 用 `file://` 前缀；写失败则 pic 空串不崩
- 校验+搜索**必须同一 session**（`self.sess`），否则 cookie 不共享、校验无效
- 验证码图片随 session 绑定，每次刷新随机（`MAC.Verify.Refresh` 加 `?r=` 随机数）；提交错误后图片作废需重新下载
- **注意**：`rsplit(' ', 1)` 只认"末尾空格+纯数字"为验证码（`parts[1].isdigit()`），普通关键词搜索不受影响

## ⚠️ 坑 5（最终裁决 2026-08-23）：验证码提示 vod 方案在羊壳里触发 "require login [guest]" → 搜索只能返回空

用户实测反馈：**①"require login [guest]"**（羊壳对 `vod_id: ''` 的空提示卡片报错——壳拿空 id 当需登录处理）；**②"手机搜索就触发验证码了，cookie应该不通用？"**（羊壳每次搜索可能重建 Spider 实例，`requests.Session` 的 PHPSESSID 跨调用不共享；文件持久化 cookie 只在壳可写路径存在时有效，不可靠）。

**结论：苹果 CMS 站搜索被验证码锁死时，py 源层面没有可靠方案——不要返回提示 vod（触发 require login），直接 `return {'list': []}`（壳显示"未找到"，不报错），靠分类浏览代替搜索。** 这符合 SKILL.md 陷阱节"搜索验证要试全...测不通就搜索留空——很多源搜索被限流/需登录，分类浏览才是主体"。

**流程修正**：坑 4 的手动输入方案先实现 → 用户实测打回 → 回退 `return {'list': []}`。写同类站直接跳到最终版，不要先做提示 vod。

## ⚠️ 坑 1：主分类 id 在 API t= 参数下返回 0 条

站点导航分类（`/index.php/vod/type/id/1.html`）：1=电影 / 2=电视剧 / 3=综艺 / 4=动漫，子分类 6=动作片 13=国产剧 15=韩剧...

但 **API `t=1`/`t=2` 返回 0 条**——因为视频都挂**子分类** type_id，主分类 id 不是有效过滤值（`t=6`/`t=13`/`t=15` 正常）。

**解法：主分类 = 轮询其子分类合并**
```python
MAIN_CATS = [('电影', '1'), ('电视剧', '2'), ('综艺', '3'), ('动漫', '4')]  # name在前 id在后！
CAT_SUBS = {'1': ['6','7','8',...], '2': ['13','14',...], ...}
# categoryContent 里 cid in CAT_SUBS → for sid in CAT_SUBS[cid]: 每个子分类取前几条合并到 30 条
# 子分类筛选值（ext.get('sub')）→ 直接 t={sub} 单查
```

## ⚠️ 坑 2：MAIN_CATS 元组顺序（分类全空的隐蔽 bug）

`MAIN_CATS = [('电影', '1'), ...]` 是 **(name, id)** 顺序，homeContent/init 里必须 `for name, cid in MAIN_CATS` 解包：
```python
classes = [{'type_id': 'c:' + cid, 'type_name': name} for name, cid in MAIN_CATS]
```
写反成 `for cid, name` 不会报错，但 type_id 拿到的是"电影"字符串、type_name 拿到的是"1"——**分类列表显示 1/2/3/4，点击全 0 条**。症状：子分类筛选正常但主分类全空。排查先打印 homeContent 的 class 看 type_id 是否数字。

## ⚠️ 坑 3：详情页 vod_pic 可能为空

API 列表返回 `vod_pic` 有时是空串（该站实测）——`_fmt_vod` 里 `vod_pic: v.get('vod_pic','')` 兜底即可，不影响播放。

## 数据量验证（判断分类是否废弃）

GET 分类页 HTML 后 `re.search(r'共(\d+)条', html)` 看总数——`共0条` = 站点该分类废弃（91情报局 914/959 同类教训，见 SKILL.md ⑯）。主页导航抓权威分类映射：`<a href="/vod/type/id/{id}.html">名</a>` 全量收集。

## 通用要点

- filters：`filters['c:'+cid] = [{'key':'sub','name':'分类','value':[{'v':'','n':'全部'}+子项]}]`，categoryContent `for d in [filter, extend]` 合并取 sub
- vod_id 用 API 的数字 id（字符串），detailContent 里 `re.search(r'(\d+)', vid)` 兜底提取
- 请求头带移动 UA；苹果 CMS API 一般无防盗链（Referer 可带主页）
