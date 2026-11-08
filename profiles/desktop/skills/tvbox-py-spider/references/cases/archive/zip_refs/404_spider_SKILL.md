# 404_spider_SKILL（用户 Kimi 总结版，权威技能文档）

> 来源：用户在 Kimi 中生成的 404_spider_SKILL.md（2026-08-13），配合 `404xav_用户标准版.py` 使用
> 用户标准 py 源模板：templates/404xav_用户标准版.py

技能包含 6 个核心模块：

1. **域名获取** - 发布页提取 + 随机前缀 + 轮询验证
2. **请求头** - 移动端 UA + 动态 Origin/Referer
3. **一级逻辑** - folder_cates 分类解析 web_api_types 返回 folder
4. **二级逻辑** - dir_ 前缀识别、翻页 URL 拼接、解析 web_grid_box 影片
5. **搜索逻辑** - 单仓库搜索 + pg 翻页
6. **嗅探播放** - parse=1、详情页直接嗅探、HTML 实体解码标题

## 对应代码实现（404xav_用户标准版.py）

| 模块 | 关键实现 |
|------|---------|
| 域名获取 | `re.findall("https://([^'"\\s,]+)", urls_block)` 提取全部 → 逐个 GET 测活（200 且 len>100）→ 谁活返回谁；fallback `4042604.one` + 3位随机数字前缀 |
| 请求头 | UA=移动端；headerx = {UA, Origin: xurl, Referer: xurl + "/"}，每次 _req 更新 Referer |
| 一级逻辑 | `self.folder_cates` 列表（42 个分类）；`parse_folders` 用 BeautifulSoup 解析 `web_api_types` 的 `<li>` → folder 项（vod_tag="folder", vod_id=f"dir_{href}"） |
| 二级逻辑 | categoryContent 里 `cid.startswith("dir_")` → 进入影片；翻页 `{href[:-5]}/{page}.html`；`parse_movies` 解析 `web_grid_box` 的 cell_box（v_thumb>a 取链接、v_title 取标题、data-original/src 取图、v_time 取时长） |
| 搜索逻辑 | `{xurl}/search/cangku/{key}/{page}.html`；searchContentPage 标准分页返回 |
| 嗅探播放 | detailContent: `vod_play_url = "正片$" + did`（页面链接直接当播放地址）；playerContent: `parse=1` + playUrl="" + url=id + header（UA/Origin/Referer）→ 播放器嗅探页面 m3u8 |

## 细节要点
- 广告过滤：`href.startswith('http') and not href.startswith(self.xurl)` → 跳过
- 标题 HTML 实体解码：`html.unescape(title)` + 去空白 `[\s\u200b]+`
- 详情页标题提取：`<title>(.*?)</title>` 取 `|` 前部分
- 首页 homeContent：只返回分类列表，list 为空（首页不加载影片）
- homeVideoContent：返回空 list（无首页推荐流）
