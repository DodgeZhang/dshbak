---
name: py写源技能
description: 单文件跨 Agent 全类型 Spider 自动开发技能 v8.3。统一需求、分析、策略、生成、验证和修复流程，内置羊壳运行时、Nuxt/devalue/API、HLS localProxy、苹果CMS API、动态域名、folder、加密API、Shell端代理等 py 源实战经验。
---

# 全类型 Spider 自动开发技能 v8.3 单文件版

## 1. 任务定义

你负责把用户提供的站点或 API 变成可用的 T4 或客户端 Spider。目标不是输出模板，而是完成：需求归一化、站点分析、站点画像、策略选择、代码生成、静态检查、六接口测试（含 homeVideoContent）、内容类型端到端验证、自动修复和交付报告。

本文件是独立 Skill，不依赖其他文件。后文保留并重排了 v5.0 中的高价值知识：接口契约、页面层级、CMS 决策、MacCMS/API 模板、加密和 iframe、非影视模板、SPA 经验、音乐队列和故障排查。

## 2. 唯一权威执行流程

需求归一化 → 分析分类第一页 → 分析详情样本 → 分析搜索/播放/API → 建立站点画像 → 验证选择器或 JSON 路径 → 选择内容模板和特殊策略 → 生成 Spider → 静态检查 → 六接口测试（含 homeVideoContent） → 播放/阅读/图片/队列端到端测试 → 失败自动修复最多 3 轮 → 评估并交付。

禁止跳过网站分析直接套模板。每个关键判断必须有 URL、HTML、JSON、脚本或接口测试证据。

## 3. Agent 工具适配

使用逻辑能力，不依赖工具名称：FETCH_PAGE、RUN_CODE、READ_FILE、WRITE_FILE、LIST_FILES、ANALYZE_SITE、DEBUG_SELECTOR、TEST_INTERFACE、EVALUATE_SOURCE、DEBUG_PLAY_LINK。有专用 MCP 时优先；否则使用浏览器、HTTP、代码执行降级。

能力等级：A=分析调试工具+HTTP+代码执行+文件读写；B=浏览器/HTTP+代码执行+文件读写；C=浏览器/HTTP+文件读写；D=只有上下文。无论等级，都必须报告通过、失败、未验证和阻塞。

## 4. 统一决策优先级

用户明确指定 > 当前站点实测 > API/HTML字段 > URL特征 > 本文默认模板。用户未指定模式时默认 T4；未指定类型时根据行为判断；MacCMS 路由优先归 video；动漫根据播放列表或章节图片判断。

## 5. 统一冲突修正规则

后部历史示例只提供知识，不覆盖本节规则。最终代码禁止：精确 class XPath、99/999 伪分页、示例域名、__main__ 测试块、空壳接口、重复请求、未经解析的播放页假冒直链。历史选择器、token、密钥和播放地址必须重新验证。

## 6. 六接口完成门禁

静态检查必须通过：语法、import、Spider 类、模式继承、方法签名、字段、线路分隔符、选择器、URL补全、异常隔离、稳定去重。接口必须测试 homeContent、homeVideoContent、categoryContent、detailContent、searchContent、playerContent。端到端验证按类型执行：影视播放、小说正文、漫画/图片序列、音乐队列、直播 stream、短视频点击项首位。

### v8.1 追加门禁：Nuxt/SSR、folder分页、加密图片

- 页面含 `__NUXT_DATA__`、Nuxt chunk、payload 且普通选择器为空时，必须还原 Nuxt 索引数组或 payload JSON，再递归扫描字段；禁止硬套 XPath/MacCMS。
- 动态域名链路可能是入口发布页先跳中转页，再由中转页 `Base64.decode/atob` 解出 `words.random()+后缀` 并生成随机前缀域名；必须分开验证发布页跳转、中转页解码、随机 host 探活和 Nuxt/API 数据解析。
- 列表项含 `episode_id` 时必须保留进 `vod_id` 或播放 ID，例如 `drama-play?id={video_id}&episode_id={episode_id}`；播放页有页面但无 `video_url` 时，优先检查 episode_id 是否丢失。
- 裸 ID 播放入口坏不代表资源不可播；必须对比裸入口与列表带 episode_id 入口。若后者能返回 `video_url`，源应以列表 episode 入口为准。
- `vod_tag:"folder"` 的项目必须在 `categoryContent(folder_id, pg, ...)` 中实现二级目录和翻页，`detailContent()` 只做兼容；folder 第1页和第2页都必须验证真实 `pagecount/total/limit`。
- 图片 URL 非空不代表可用；需抽样检查 0 字节、Content-Type、magic bytes 和加密二进制。加密图片用 `localProxy` 解密并返回真实 MIME，不能把图片代理用于 m3u8/mp4。
- 默认禁止列表页逐条请求详情页补封面/备注；除非用户明确要求完整优先，否则优先加载速度。
- `vod_remarks` 只提供角标文本，位置由客户端 UI 决定；源不能强制左上或左下。
- 若原站同入口本身无源或无数据，记录为站点数据问题，不写污染全局逻辑的特殊硬编码。

## v8.3 单文件实战增量（直接内置）

以下规则来自实战案例，portable 单文件版必须直接执行，不依赖外部模块路径。

### 1. 羊壳/海阔运行时兼容

触发：壳里没数据、只有推荐页、分类空白、推荐页空、XBPQ/JSON 转 py、本机六接口正常但客户端空。

强制规则：
- T4 必须 `from base.spider import Spider` 且 `class Spider(Spider)`。
- 必须实现 `homeVideoContent(self)`，返回 `{"list": [...]}`；推荐页常调用它，不存在会显示空。
- `homeContent(self, filter)` 必须返回 `class`；分类必须是 `{"type_id":..., "type_name":...}` 字典列表。
- `filters` 必须是 dict；没有筛选就 `{}`，不要返回 list。
- `categoryContent` 返回必须含 `page/pagecount/limit/total/list`；`pg` 开头转 int。
- `detailContent` 的 vod 必须含 `vod_play_from` 和 `vod_play_url`。
- 标准签名：`homeContent(self, filter)`、`homeVideoContent(self)`、`categoryContent(self, tid, pg, filter, extend)`、`detailContent(self, ids)`、`searchContent(self, key, quick, pg="1")`、`playerContent(self, flag, id, vipFlags)`。

### 2. Shell 端代理与图片代理

触发：手机浏览器能开但 py 没数据、被墙、`Network is unreachable`、系统 VPN 不生效、图片 CDN 超时、`localProxy/proxyPic` 不显示。

规则：
- Python `requests` 不自动继承 Android 系统 VPN；被墙站点必须显式代理。
- 代理优先级：`extend.proxy` → 本机端口 `7890/7891/1080/1087/10809/24780/2333/6153/16666/20170/9090/7070` → 环境变量 `HTTPS_PROXY/HTTP_PROXY/ALL_PROXY/PROXY`。
- 不写死私人 LAN IP、NAS、账号、密码。
- `_get/_post/playerContent/localProxy/proxyPic` 复用同一个 `requests.Session()` 和 `self.session.proxies`。
- `localProxy/proxyPic` 不裸用 `requests.get()`；请求 CDN 图片必须带 `proxies=self.session.proxies or None`。
- 图片代理只处理图片，不误用于 m3u8/mp4。body 为空返回 404，不返回 200 空图。

### 3. Nuxt/Next/Vite/devalue/API

触发：`__NUXT_DATA__`、`__NEXT_DATA__`、`/_next/`、`/assets/index-*.js`、`config.js`、页面空壳、普通 XPath 为空、短剧 API、cursor/offset 翻页。

规则：
- Nuxt SSR 数据优先解析 `__NUXT_DATA__`，不要硬套 DOM。
- devalue 常是顶层数组，字段值可能是索引；必须递归还原或 `_walk` 扫描真实字段。
- 视频对象用 `video_id/episodes/cover` 判别，演员对象用 `actor_id/works/videos` 判别，不能只靠 `id/name`。
- 列表项带 `episode_id` 时必须保留到 `vod_id` 或播放 ID；裸 id 入口无 `video_url` 不代表不可播。
- API base 可能在 `VITE_BASE_URL`、`VITE_API_BASE`、`baseURL`、openapi client 或 chunk 里，可能不同于站点域名。
- cursor/offset/page 逐端点实测；若不同分类返回首批 id 完全相同，优先怀疑参数被服务端忽略，换端点或换字段。
- HTML 被 Cloudflare/WAF 拦截但 API 返回 JSON 时，优先走 API，HTML 只作 fallback。

### 4. HLS/localProxy 播放链路

触发：HLS AES-128、`#EXT-X-KEY`、主 m3u8 能开但不能播、ts/key 在另一 CDN、签名过期、`data-preview/data-play-src` 直链。

规则：
- 播放链路必须测到底：主清单 → 子流清单 → key → ts 分片；主 m3u8 200 不等于能播。
- m3u8 明确给出 IV 时，所有分片按固定 IV 解密，不自行推导序号 IV。
- `localProxy type=hls` 重写 m3u8：`#EXT` 行不动，KEY 的 `URI="..."` 包 key 代理，ts 行补全绝对 URL 后包 ts 代理。
- `data-preview/data-play-src/video.url` 若列表里已是 m3u8 直链，应把直链编码进 play id，详情页不要再抓第一个播放属性；详情页首个属性常是推荐位/错片。
- 签名 60-100 秒过期的 m3u8 不在详情页缓存直链；详情页放 pid，`playerContent` 点击实时解析。
- 播放 id 可能是数字、hex、字母数字，正则不要只写 `\d+`。

### 5. 苹果CMS/API 实战

触发：`/api.php/provide/vod/`、`ac=list/detail`、`t=`、`ids=`、`wd=`、主分类空、列表无图、搜索验证码。

规则：
- API 详情给出 `vod_play_from/vod_play_url` 后仍须逐集判断：确认是 http/https m3u8/mp4 才能 `parse=0`；解析器、iframe、播放页必须递归解析。
- `t=主分类id` 返回 0 条时，主分类可能只是容器；只有建立了站点实测 CAT_SUBS 映射后才轮询子分类，禁止盲目合并所有分类。
- 第 N 页取各子分类第 N 页，跳过空页并合并去重；不要固定每个子分类取少量导致越翻越稀。
- `ac=detail&ids=` 常见单次最多返回 20 条；只有列表缺图时才分批补图并按 `vod_id` 映射回填，列表已有图片时禁止额外详情请求。
- 搜索 API 禁用或 HTML 验证码时，先试 `/index.php/ajax/suggest?mid=1&wd={key}&limit=50`；`mid=1` 必带。
- suggest 通常不支持真实分页，`page/pg/p/offset/start/pageNum` 可能全部无效；不要伪造分页。

按需辅助写法：

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

### 6. 发布页/动态域名解密

触发：发布页、最新地址、永久地址、加载中跳转页、`window.appConfig`、`key+data`、`zz_line`、`zz_backup_line`、`Base64.decode/atob`、`words.random()`、raw deflate。

规则：
- 解出域名后必须验证目标站结构，例如特征 class、文章结构、标题、`dateModified`、`loadBannerDirect`、API 字段；不能只看 200。
- 发布页域名可能被别的站占用，模板/key 相同但目标不同，结构校验失败必须丢弃。
- `key+data` 常见两种方案：A=sha256 hex 前 16 位作 iv；B=密文字节前 16 字节作 iv；按实测选择。
- `Base64.decode/atob + words.random()` 要提取域名后缀并生成随机前缀，不写死一次性完整域名。
- 有 `<a target="_self" href="https://...">加载中</a>` 时优先直接提取 href 跟随，比解析 JS 跳转快。
- raw deflate 用 `zlib.decompressobj(-15)`；普通 `zlib.decompress()` 可能报 incorrect header check。

### 7. Folder 二级/三级路由

触发：二级/三级页面、演员/标签/专题、列表项不是视频详情而是目录、虚拟分类、folder + filters。

规则：
- folder 项必须带 `vod_tag: "folder"`；没有它客户端会当视频播放。
- folder 点击由 `categoryContent` 分发处理，不要塞进 `detailContent` 返回多 vod。
- folder 的 `vod_id` 必须稳定、可逆；可用路径本身，也可用 `folder$typ$cid`，但解析分支要明确。
- 复杂分类优先遵循用户给的 JSON/原规则结构，不自作主张平铺站内所有标签。
- folder 页也要返回 `page/pagecount/limit/total/list`，并测试第 1/2 页。
- folder 页顶部筛选注册到 `filters[folder_id]`，不要把筛选项伪装成 folder 卡片。

### 8. 加密 API 与游客身份

触发：`VITE_BASE_URL`、`VITE_APP_API_BASE_URL`、`parameterKey/parameterIv`、`hash:true`、`data=<密文>`、401、guest/anonymous token、成人确认、`X-Zone`。

规则：
- API 域名候选从 JS 数组提取并逐个探活，第一个可用即用。
- GET 参数若加密成 base64，必须 URL 编码；`+/=` 不编码会参数错误。
- key/iv 必须按 JS 实测；有的站 key 与 iv 相同且固定 16 字节。
- 请求头字段大小写按实测，例如 `X-Zone` 不能随意改成 `Zone`。
- 后端校验错误可反推字段名和嵌套结构，但未解字段不能硬猜完成。
- 敏感/成人确认优先找 guest/anonymous 注册和 confirmAge/adult-confirmation 流程；拿 token 后再请求免费集。
- `episode.locked=True` 或明确付费集无 playback_url 时跳过，不伪造播放地址。

### 9. MissAV 系图片 AES

触发：MissAV/MissAVt/91hub、图片 CDN 返回 `binary/octet-stream`、localProxy 图片解密、壳端图不显示。

规则：
- 标准 key/iv 用明文 ASCII bytes：`b'f5d965df75336270'`、`b'97b60394abc2fbe1'`，禁止 `bytes.fromhex()`。
- AES-CBC 解密后检查 JPEG/PNG/WebP/GIF magic bytes。
- JPEG 解密后必须截断到 `\xff\xd9` EOI；尾部 padding/噪声可能导致壳端解码失败。
- 同站混用 `image.cpckgr.cn` 与 `pic.yrfmba.cn` 时，若路径一致且前者壳端不显示、后者正常，可在解析时把不稳定 CDN 替换成稳定 CDN；只在实测后使用。

### 10. v8.3 完成前门禁

- 羊壳：测 `homeVideoContent()`、`homeContent(False)`、一个分类入口，确认 class/list/filters 类型。
- Nuxt/API：验证 API base、字段路径、分类参数差异、分页 cursor/offset/page。
- HLS：测主 m3u8、子 m3u8、key、ts；签名过期链接必须实时解析。
- 苹果CMS：主分类为空时测子分类合并；补图按 20 条分批；suggest 搜索不伪造分页。
- 动态域名：解出域名必须验证目标站结构，不只看 200；跳转链限制深度。
- Folder：每类 folder 至少测第 1/2 页，确认 `vod_tag` 和 `categoryContent` 分发。
- 加密 API：GET/POST 加密、响应解密、guest/confirm/playback 至少各测一次；locked 付费集跳过并报告。
- 代理图片：`_get/_post/playerContent/localProxy/proxyPic` 必须复用 session/proxy；抽测 body 长度与 magic bytes。

## 6.1 单文件版站点画像与 Spider IR

单文件版不依赖外部 Schema，但分析和编码必须在上下文中维护以下等价结构，不得用默认值冒充实测：

```json
{
  "site_profile": {"site":{},"mode":{},"routes":{},"selectors":{},"api":{},"player":{},"pagination":{},"samples":{}},
  "spider_ir": {"request":{},"list":{},"detail":{},"search":{},"player":{},"pagination":{},"special":{}}
}
```

简单任务可只在当前上下文维护；跨轮次、跨 Agent、加密或多模块任务必须在交接报告中完整列出。先形成 site_profile，再形成 spider_ir，最后编码。

## 6.2 六接口验证与最终交付门禁

```python
import sys; sys.path.insert(0, '/sdcard/Download')
import 脚本名; s = 脚本名.Spider()
if hasattr(s, 'getName'): print("T4模式:", s.getName())
s.init("")
required = ['homeContent','homeVideoContent','categoryContent','detailContent','searchContent','playerContent']
missing = [m for m in required if not hasattr(s, m)]
if missing: raise RuntimeError("六接口不完整: " + ','.join(missing))
print("首页:", s.homeContent(False)); print("推荐:", s.homeVideoContent())
r = s.searchContent("测试", "0"); print("搜索:", len(r.get('list', [])))
```

最终交付检查必须区分模板与成品：模板中的示例域名只作占位提醒；成品仍含 `example.com`、精确 class XPath、99/999 伪分页、`getName return self.name`、假 Response、AES 失败返回密文、未解析播放页 `parse=0`、`__main__` 时必须判定失败。

## 7. 统一输出

交付源文件或完整代码，并报告模式、类型、CMS/API、工具等级、六接口状态、端到端状态、修复轮数和剩余风险。缺少执行工具或网络证据时必须写未验证，不能宣称完成。

# 高价值知识库

以下章节按开发顺序重排，内容来自 v5.0；重复的独立自动化脚本、版本历史和泛化运维说明已移除。

---

## 实际案例与使用场景

### 案例1：MacCMS v8影视站开发
**场景**：常见影视站，使用MacCMS v8系统
**步骤**：
1. 分析：`py_mcp:analyze_website("https://example.com")` → 识别为MacCMS v8
2. 选择：使用MacCMS v8骨架代码
3. 填充：修改host为实际域名，更新分类列表
4. 验证：测试六接口（含 homeVideoContent），并确保播放链接正常

### 案例2：小说站开发
**场景**：笔趣阁类型小说站
**步骤**：
1. 分析：`py_mcp:analyze_website("https://novel.example.com")` → 识别为小说站
2. 选择：使用小说类模板
3. 填充：修改章节列表和正文提取的XPath
4. 验证：测试章节列表和正文内容

### 案例3：加密站处理
**场景**：使用AES加密的图片站
**步骤**：
1. 分析：`py_mcp:analyze_website("https://image.example.com")` → 识别为加密站
2. 选择：使用图片类模板 + AES解密模块
3. 填充：提取加密key和iv，集成解密函数
4. 验证：测试图片解密和显示

## 配置选项与参数说明

### 全局配置
- `host`：站点基础URL，必须以http(s)://开头
- `headers`：HTTP请求头，建议包含User-Agent和Referer
- `categories`：分类列表，格式为`[{"type_id": "1", "type_name": "电影"}]`

### 接口参数
- `init(extend)`：extend参数可用于传递额外配置
- `homeContent(filter)`：filter为分类筛选参数
- `categoryContent(tid, pg, filter, extend)`：tid分类ID，pg页码
- `detailContent(ids)`：ids为内容ID列表
- `searchContent(key, quick, pg)`：key搜索关键词，quick快速搜索标志
- `playerContent(flag, id, vipFlags)`：flag播放源标志，id播放ID，vipFlags会员标志

## 内容类型自动判定

| URL/关键词特征 | type | playerContent输出 |
|---|---|---|
| MacCMS路径、影视/电影/电视剧/动漫/综艺 | video | `{"parse":0,"url":"m3u8","header":{}}` |
| 小说/书/文学/笔趣阁 | novel | `{"parse":0,"url":"novel://{\"title\":\"章节\",\"content\":\"正文\"}"}`，详情含`vod_player:novel` |
| 图片/写真/图/壁纸 | image | `{"parse":0,"url":"pics://u1&&u2"}` |
| 漫画/动漫(图片类)/manga | manga | `{"parse":0,"url":"pics://u1&&u2"}`，详情含`vod_player:pics` |
| 音乐/歌/MP3/音频 | music | `{"parse":0,"url":"mp3url","header":{}}` |
| 直播/live/直播源 | live | `{"parse":0,"url":"m3u8","header":{}}` |
| 短剧/微短剧/竖屏 | short | `{"parse":0,"url":"m3u8","header":{}}` |
| 游戏/游戏下载/游戏资源 | game | `{"parse":0,"url":"download_url","header":{}}` |
| 软件/软件下载/应用 | software | `{"parse":0,"url":"download_url","header":{}}` |
| 新闻/资讯/文章 | news | `{"parse":0,"url":"text://内容"}` |
| 论坛/社区/帖子 | forum | `{"parse":0,"url":"text://内容"}` |

优先级：用户显式指定 > URL路径特征 > 页面内容特征

## 运行模式

| | T4服务端（影视TV/影视仓） | 客户端（TVBox） |
|---|---|---|
| 类定义 | `class Spider(Spider):` 继承base | `class Spider:` 独立类 |
| 导入 | `from base.spider import Spider` | 无需导入 |
| getName | 必须返回站点名 | 可选 |
| subs/header | 支持 | 不支持 |
| 判断 | "T4/影视TV/影视仓/服务端" | "TVBox/猫影视/jar/客户端" |
| 默认 | 未明确→T4模式 | |

## 代码精简原则（强制）

1. 零注释零docstring
2. 禁止`__main__`测试块
3. 禁止空壳方法（isVideoFormat/manualVideoCheck/proxy不声明）
4. 核心字段：vod_name/vod_pic/vod_play_from/vod_play_url，其他能一行搞定才加
5. filters按需，无筛选就`filters: {}`
6. 单行优先：三元、推导、链式
7. import最小化

## 标准接口

| 方法 | 功能 | 返回 |
|------|------|------|
| `init(self, extend="")` | 初始化 | 无 |
| `homeContent(self, filter)` | 首页+分类+筛选 | `{"class":[],"list":[],"filters":{}}` |
| `homeVideoContent(self)` | 羊壳/海阔推荐页 | `{"list":[]}` |
| `categoryContent(self, tid, pg, filter, extend)` | 分类浏览 | `{"page":n,"pagecount":n,"limit":n,"total":n,"list":[]}` |
| `detailContent(self, ids)` | 详情+线路/章节 | `{"list":[vod]}` |
| `searchContent(self, key, quick, pg="1")` | 搜索 | `{"list":[]}` |
| `playerContent(self, flag, id, vipFlags)` | 播放/阅读/查看 | `{"parse":0,"url":""}` |

T4额外必须：`getName(self)` 返回string

字段名必须`vod_`前缀。线路：vod_play_from用`$$$`，vod_play_url用`$$$`对应，线路内`#`分隔，格式`集名$播放ID`


---

# 页面层级术语与路由规范（强制语义）

用户说出以下术语时，必须按对应结构理解；“二级/三级”指从顶栏主分类开始计算的分类浏览层级，不包含最终详情页。

## 二级页面

含义：`主分类 → 资源列表`，点击顶栏分类后立即显示真实内容，不再显示文件夹卡片。

```text
主分类(type_id=movie)
  └─ categoryContent("movie") → 资源列表
```

实现规则：

- `homeContent.class` 返回主分类。
- `categoryContent(tid)` 在 `tid` 为主分类 ID 时直接请求资源 API。
- 返回项必须是可进入 `detailContent` 的真实资源，不能返回 `vod_tag: folder`。
- 筛选不是必需；用户只说“二级页面”时默认无额外文件夹层。

## 三级页面

含义：`主分类 → 文件夹/子分类 → 资源列表`。第二屏显示文件夹卡片，点击文件夹后第三屏才显示真实内容。

```text
主分类(type_id=movie)
  └─ categoryContent("movie") → folder$movie$3 等文件夹卡片
       └─ categoryContent("folder$movie$3") → 资源列表
```

复杂站点允许内部使用 `node$类型$分类ID$模块ID$排序`，但用户所说“三级页面”的核心是只经过一层可见文件夹后进入资源。若需要再显示模块卡片，则属于四级交互，除非用户明确要求，不应混入三级页面。

实现规则：

- 文件夹卡片使用唯一可逆 ID，如 `folder$typ$cid`。
- 文件夹项使用 `vod_tag: "folder"`，点击后仍调用 `categoryContent`，不能进入 `detailContent`。
- 文件夹页返回真实资源后，资源 `vod_id` 使用正常详情 ID。
- 分类 ID 编解码必须稳定，不能依赖显示名称。

## 二级页面加筛选

含义：顶栏主分类页显示文件夹卡片；点击某个文件夹后直接显示资源，同时在该资源页顶部显示筛选项。筛选属于当前文件夹页，不额外生成“全部/最新/最热/模块”卡片，因此可见浏览仍是三级路径，但实现术语固定称“二级页面加筛选”。

```text
主分类(type_id=movie)
  └─ categoryContent("movie") → folder$movie$3（黑料）
       └─ categoryContent("folder$movie$3", extend={module,sort}) → 资源列表
          顶部 filters：模块 / 排序 / 地区 / 年份等
```

实现规则：

- 在 `homeContent.filters` 预注册每个可点击文件夹 ID：`filters["folder$typ$cid"] = [...]`。
- `categoryContent` 收到 `folder$...` 后直接读取 `extend` 并请求资源，禁止再返回筛选卡片。
- 典型筛选结构：

```python
filters[f"folder${typ}${cid}"] = [
    {"key":"module","name":name,"value":[{"n":"全部","v":""},{"n":"模块A","v":"101"}]},
    {"key":"sort","name":"排序","value":[{"n":"默认","v":""},{"n":"最新","v":"createTime"},{"n":"最热","v":"recommendRate"}]}
]
```

- 筛选值来自 `extend.get("module", "")`、`extend.get("sort", "")` 等，空值表示全部/默认。
- 模块顺序遵循原站顺序，筛选名称使用原站名称。
- 不得把筛选选项伪装成 `vod_tag: folder` 卡片。

## 术语选择优先级

1. 用户明确说“二级页面” → 主分类直接资源。
2. 用户明确说“三级页面” → 主分类、文件夹、资源。
3. 用户明确说“二级页面加筛选” → 文件夹页直接资源并显示顶部筛选，禁止筛选卡片层。
4. 用户要求从一种结构改成另一种时，只调整 `homeContent/categoryContent/filters` 路由；详情、播放、搜索等无关逻辑保持不变。
5. 用户未指定层级时，分析原站交互并保持原站层级。

# 小说与漫画客户端调用协议（强制）

## 小说模式

软件小说阅读模式不能使用普通 `text://正文` 代替。详情和播放必须同时满足：

```python
vod.update({
    "vod_play_from":"小说阅读",
    "vod_play_url":"#".join(f"{title}${play_id}" for title,play_id in chapters),
    "vod_player":"novel"
})
```

`playerContent` 返回：

```python
return {"parse":0,"url":"novel://"+json.dumps({"title":chapter_title,"content":content},ensure_ascii=False),"header":""}
```

规则：

- `novel://` 后必须是合法 JSON 对象，至少包含 `title` 和 `content`。
- 章节播放 ID 必须能还原章节标题；可将标题 URL 编码后附加到 ID。
- 正文保留自然段换行，清理脚本、导航、上一章/下一章等噪声。
- 详情必须设置 `vod_player: "novel"`，否则客户端可能按视频播放器打开。

## 漫画模式

详情必须声明漫画查看器：

```python
vod.update({
    "vod_play_from":"漫画浏览",
    "vod_play_url":"#".join(f"{title}${play_id}" for title,play_id in chapters),
    "vod_player":"pics"
})
```

`playerContent` 返回：

```python
return {"parse":0,"url":"pics://"+"&&".join(image_urls),"header":""}
```

规则：

- `pics://` 后的图片使用 `&&` 分隔并保持章节页序。
- 图片需要 Referer、签名、解密或特殊 MIME 时，必须先转换为本地代理 URL。
- 详情必须设置 `vod_player: "pics"`。
- 不依赖 `playUrl: "type=manga"` 触发漫画模式；可兼容保留，但 `vod_player + pics://` 是标准调用。
- 封面与正文图都要识别真实魔数：JPEG、PNG、GIF、WebP；扩展名和响应 Content-Type 不可信。

---

# CMS识别决策树（核心！）

## 第一步：从URL特征判断

| URL特征 | CMS类型 | 下一步 |
|---------|---------|--------|
| `/frim/index` 或 `/search.php?searchtype=5` | MacCMS v8 | 用v8骨架 |
| `/index.php/vod/show` 或 `/index.php/vod/detail` | MacCMS v10 | 用v10骨架 |
| `/api.php/provide/vod` | 采集API | 用API骨架 |
| 页面含`<meta name="generator" content="苹果CMS">` | MacCMS | 检查版本 |
| 页面含`wp-content` | WordPress | 自定义爬取 |
| 页面含`/templets/` | 织梦CMS | 自定义爬取 |
| 页面含`/forum.php` 或 `discuz` | Discuz! | 论坛爬取 |
| 页面含`/admin/typecho` | Typecho | 博客爬取 |
| 页面含`/node_modules/hexo` | Hexo | 静态博客爬取 |
| 页面含`/components/com_content` | Joomla | 内容管理系统爬取 |
| 页面含`/core/modules/node` | Drupal | 内容管理框架爬取 |
| 无明显CMS特征 | 自定义站 | 深度HTML分析 |

## 第二步：从HTML结构判断

```
检查顺序：
1. 分类导航 → 提取type_id和type_name
2. 视频列表区域 → 确定列表选择器（3级兜底）
3. 详情页结构 → 确定信息+播放源选择器
4. 播放页JS → 确定m3u8提取正则
5. 筛选区域 → 提取地区/年份/排序选项
```

## 第三步：加密/特殊架构识别

| 特征 | 类型 | 处理方式 |
|------|------|----------|
| JS中含`CryptoJS.AES.decrypt` | AES加密 | 提取key/iv，Python复现解密 |
| JS中含`XOR`或位运算解密 | XOR加密 | 提取key，Python复现 |
| JS中含`RSA.encrypt`或`JSEncrypt` | RSA签名 | Python rsa库复现签名链 |
| 页面使用iframe加载播放器 | iframe嵌套 | 二次请求iframe src |
| API需要sign签名参数 | API签名 | 抓包分析签名算法 |
| 图片src为加密data属性 | 图片加密 | 翻页请求原图URL |
| 异步加载(aiohttp/asyncio) | 异步站 | 可选同步改写 |
| 本地SQLite存储 | 离线缓存 | 非爬虫必要，跳过 |

---


---


## 关键特征

```
分类URL: /search.php?searchtype=5&tid={分类ID}&page={页码}&area={地区}&year={年份}&order={排序}
详情URL: /movie/index{ID}.html
播放URL: /play/{ID}-{播放源序号}-{集数序号}.html
搜索: POST /search.php searchword={关键词}
播放JS: var now="m3u8_url"
排序: time(最新) / hit(最热) / score(评分)
```

## 完整T4代码骨架

```python
#!/usr/bin/python
import json
import re
from urllib.parse import urljoin, urlparse
import requests
from lxml import etree
from base.spider import Spider

class Spider(Spider):
    def getName(self): return "站点名"
    def init(self, extend=""):
        self.name = "站点名"
        self.host = "https://example.com"
        self.headers = {"User-Agent": "Mozilla/5.0", "Referer": self.host + "/"}
        self.categories = []
        self.session = requests.Session(); self.session.headers.update(self.headers)
    def _get(self, url):
        try:
            r = self.session.get(url, headers=self.headers, timeout=15, verify=False, proxies=self.session.proxies or None); r.encoding = r.apparent_encoding or "utf-8"; return r.text
        except Exception: return ""
    def _fix(self, url): return urljoin(self.host + "/", url or "")
    def _is_media(self, url): return bool(re.search(r"\.(?:m3u8|mp4)(?:$|[?#])", urlparse(url).path, re.I))
    def _resolve_media(self, url, depth=0):
        url = self._fix(url)
        if self._is_media(url) or depth > 3: return url
        body = self._get(url)
        m = re.search(r'player_data\s*=\s*(\{.*?\})', body, re.S)
        if m:
            try:
                value = json.loads(m.group(1)).get("url", "")
                if value: return self._resolve_media(urljoin(url, value), depth + 1)
            except Exception: pass
        m = re.search(r'(?:var\s+now|var\s+playurl)\s*=\s*["\']([^"\']+)', body)
        if m: return self._resolve_media(urljoin(url, m.group(1).replace("&amp;", "&")), depth + 1)
        frame = re.search(r'<iframe[^>]+src=["\']([^"\']+)', body, re.I)
        if frame: return self._resolve_media(urljoin(url, frame.group(1)), depth + 1)
        scopes = re.findall(r'<(?:script|video|source)[^>]*>.*?</(?:script|video|source)>|<(?:video|source)[^>]*>', body, re.I | re.S)
        haystack = "\n".join(scopes) if scopes else body
        candidates = re.findall(r'https?://[^"\'<>\s]+\.(?:m3u8|mp4)[^"\'<>\s]*', haystack, re.I)
        bad = re.compile(r'(?:^|[/_.-])(ad|ads|advert|preview|trailer|recommend|demo|sample)(?:[/_.-]|$)', re.I)
        candidates = list(dict.fromkeys(x.replace("&amp;", "&") for x in candidates if not bad.search(urlparse(x).path)))
        tokens = re.findall(r'[A-Za-z0-9]{4,}', urlparse(url).path + "?" + urlparse(url).query)
        current_ids = [x for x in tokens if any(c.isdigit() for c in x) and x.lower() not in ("html", "m3u8", "index")]
        candidates.sort(key=lambda x: (not any(i in x for i in current_ids), len(x)))
        return self._resolve_media(candidates[0], depth + 1) if candidates else url
    def _text(self, node): return " ".join("".join(node.xpath(".//text()")).split()) if node is not None else ""
    def _pagecount(self, html, pg):
        tree = etree.HTML(html or ""); nums = []
        nodes = tree.xpath('//*[contains(@class,"page") or contains(@class,"pagination") or contains(@class,"pager")]//a')
        for a in nodes:
            href = a.get("href", ""); text = "".join(a.xpath(".//text()")).strip()
            m = re.search(r"(?:[?&]page=|/page/)(\d+)", href, re.I)
            if m: nums.append(int(m.group(1)))
            elif text.isdigit(): nums.append(int(text))
        nxt = tree.xpath('//a[@rel="next" or contains(@class,"next") or contains(normalize-space(.),"下一页")]')
        return max(nums + [pg + 1 if nxt else pg])
    def _list(self, html):
        tree = etree.HTML(html or ""); out = []; seen = set()
        items = tree.xpath('//a[contains(@class,"videopic")]') or tree.xpath('//div[contains(@class,"item")]//a[.//img]') or tree.xpath('//a[contains(@href,"/movie/") and .//img]')
        for a in items:
            try:
                href = self._fix(a.get("href")); m = re.search(r"(?:index|detail)?(\d+)\.html", href)
                if not m or m.group(1) in seen: continue
                seen.add(m.group(1)); img = a.xpath('.//img')[0] if a.xpath('.//img') else None
                pic = self._fix((img.get("data-original") or img.get("data-src") or img.get("src")) if img is not None else "")
                name = a.get("title") or (img.get("alt") if img is not None else "") or self._text(a)
                out.append({"vod_id": m.group(1), "vod_name": name, "vod_pic": pic})
            except Exception: continue
        return out
    def homeContent(self, filter): return {"class": self.categories, "list": self._list(self._get(self.host)), "filters": {}}
    def homeVideoContent(self): return {"list": self._list(self._get(self.host))}
    def categoryContent(self, tid, pg, filter, extend):
        pg = int(pg) if str(pg).isdigit() else 1; html = self._get(f"{self.host}/search.php?searchtype=5&tid={tid}&page={pg}"); items = self._list(html); limit = len(items) or 20; pagecount = self._pagecount(html, pg)
        return {"page": pg, "pagecount": pagecount, "limit": limit, "total": 0, "list": items}
    def detailContent(self, ids):
        out = []
        for vid in ids:
            try:
                tree = etree.HTML(self._get(f"{self.host}/movie/index{vid}.html")); name = self._text(tree.xpath("//h1 | //h2")[0]) if tree.xpath("//h1 | //h2") else str(vid)
                pic = self._fix((tree.xpath('//div[contains(@class,"pic")]//img/@src') or tree.xpath('//img/@data-original') or [""])[0])
                fs = []; us = []
                for panel in tree.xpath('//div[contains(@class,"panel")]') or tree.xpath('//div[contains(@class,"playlist")]'):
                    opt = panel.xpath('.//a[contains(@class,"option")]'); source = (opt[0].get("title") or self._text(opt[0])) if opt else f"线路{len(fs)+1}"
                    eps = panel.xpath('.//ul[contains(@class,"playlistlink")]//a') or panel.xpath('.//ul//a[contains(@href,"/play/")]')
                    links = [self._text(a) + "$" + self._fix(a.get("href")) for a in eps if a.get("href")]
                    if links: fs.append(source); us.append("#".join(links))
                out.append({"vod_id": str(vid), "vod_name": name, "vod_pic": pic, "vod_play_from": "$$$".join(fs), "vod_play_url": "$$$".join(us)})
            except Exception: continue
        return {"list": out}
    def searchContent(self, key, quick, pg="1"):
        try: r = self.session.post(self.host + "/search.php", data={"searchword": key}, headers=self.headers, timeout=15, verify=False, proxies=self.session.proxies or None); r.encoding = r.apparent_encoding or "utf-8"; return {"list": self._list(r.text), "page": int(pg)}
        except Exception: return {"list": [], "page": int(pg)}
    def playerContent(self, flag, id, vipFlags):
        url = self._resolve_media(id)
        return {"parse": 0 if self._is_media(url) else 1, "url": url, "header": json.dumps(self.headers)}
```

## 客户端模式骨架

```python
#!/usr/bin/python
# -*- coding: utf-8 -*-
import re, json
from urllib.parse import quote
try: import requests; from lxml import etree
except: pass
BASE = "https://example.com"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Referer": BASE + "/"}
def _get(url):
    try: r = requests.get(url, headers=UA, timeout=15); r.encoding = r.apparent_encoding or "utf-8"; return r.text
    except: return None
def _fix(u): return "https:" + u if u and u.startswith("//") else BASE + u if u and u.startswith("/") else u or ""

class Spider:
    def init(self, extend=""): self.site_url = BASE
    def homeContent(self, filter): return {"class": [], "list": [], "filters": {}}
    def homeVideoContent(self): return {"list": []}
    def categoryContent(self, tid, pg, filter, extend):
        pg = int(pg) if str(pg).isdigit() else 1
        return {"page": pg, "pagecount": pg, "limit": 36, "total": 0, "list": []}
    def detailContent(self, ids): return {"list": []}
    def searchContent(self, key, quick, pg="1"): return {"page": int(pg) if str(pg).isdigit() else 1, "list": []}
    def playerContent(self, flag, id, vipFlags): return {"parse": 1, "url": _fix(id)}
```

---

# MacCMS v10 骨架（占影视站30%+）

## 关键差异

```
分类URL: /index.php/vod/show/id/{分类ID}/page/{页码}/area/{地区}/year/{年份}/by/{排序}
详情URL: /index.php/vod/detail/id/{ID}.html
播放URL: /index.php/vod/play/id/{ID}/sid/{播放源序号}/nid/{集数序号}.html
搜索: GET /index.php/vod/search.html?wd={关键词}
播放JS: player_data={"url":"m3u8_url"} 或 url:"m3u8_url"
排序: time(最新) / hits(最热) / score(评分)
```

## MacCMS v10 完整代码骨架

```python
#!/usr/bin/python
import json
import re
from urllib.parse import urljoin, urlparse
import requests
from lxml import etree
from base.spider import Spider

class Spider(Spider):
    def getName(self): return "站点名"
    def init(self, extend=""):
        self.name = "站点名"
        self.host = "https://example.com"
        self.headers = {"User-Agent": "Mozilla/5.0", "Referer": self.host + "/"}
        self.categories = []
        self.session = requests.Session(); self.session.headers.update(self.headers)
    def _get(self, url):
        try:
            r = self.session.get(url, headers=self.headers, timeout=15, verify=False, proxies=self.session.proxies or None); r.encoding = r.apparent_encoding or "utf-8"; return r.text
        except Exception: return ""
    def _fix(self, url): return urljoin(self.host + "/", url or "")
    def _is_media(self, url): return bool(re.search(r"\.(?:m3u8|mp4)(?:$|[?#])", urlparse(url).path, re.I))
    def _resolve_media(self, url, depth=0):
        url = self._fix(url)
        if self._is_media(url) or depth > 3: return url
        body = self._get(url)
        m = re.search(r'player_data\s*=\s*(\{.*?\})', body, re.S)
        if m:
            try:
                value = json.loads(m.group(1)).get("url", "")
                if value: return self._resolve_media(urljoin(url, value), depth + 1)
            except Exception: pass
        m = re.search(r'(?:var\s+now|var\s+playurl)\s*=\s*["\']([^"\']+)', body)
        if m: return self._resolve_media(urljoin(url, m.group(1).replace("&amp;", "&")), depth + 1)
        frame = re.search(r'<iframe[^>]+src=["\']([^"\']+)', body, re.I)
        if frame: return self._resolve_media(urljoin(url, frame.group(1)), depth + 1)
        scopes = re.findall(r'<(?:script|video|source)[^>]*>.*?</(?:script|video|source)>|<(?:video|source)[^>]*>', body, re.I | re.S)
        haystack = "\n".join(scopes) if scopes else body
        candidates = re.findall(r'https?://[^"\'<>\s]+\.(?:m3u8|mp4)[^"\'<>\s]*', haystack, re.I)
        bad = re.compile(r'(?:^|[/_.-])(ad|ads|advert|preview|trailer|recommend|demo|sample)(?:[/_.-]|$)', re.I)
        candidates = list(dict.fromkeys(x.replace("&amp;", "&") for x in candidates if not bad.search(urlparse(x).path)))
        tokens = re.findall(r'[A-Za-z0-9]{4,}', urlparse(url).path + "?" + urlparse(url).query)
        current_ids = [x for x in tokens if any(c.isdigit() for c in x) and x.lower() not in ("html", "m3u8", "index")]
        candidates.sort(key=lambda x: (not any(i in x for i in current_ids), len(x)))
        return self._resolve_media(candidates[0], depth + 1) if candidates else url
    def _text(self, node): return " ".join("".join(node.xpath(".//text()")).split()) if node is not None else ""
    def _pagecount(self, html, pg):
        tree = etree.HTML(html or ""); nums = []
        nodes = tree.xpath('//*[contains(@class,"page") or contains(@class,"pagination") or contains(@class,"pager")]//a')
        for a in nodes:
            href = a.get("href", ""); text = "".join(a.xpath(".//text()")).strip()
            m = re.search(r"(?:[?&]page=|/page/)(\d+)", href, re.I)
            if m: nums.append(int(m.group(1)))
            elif text.isdigit(): nums.append(int(text))
        nxt = tree.xpath('//a[@rel="next" or contains(@class,"next") or contains(normalize-space(.),"下一页")]')
        return max(nums + [pg + 1 if nxt else pg])
    def _list(self, html):
        tree = etree.HTML(html or ""); out = []; seen = set()
        items = tree.xpath('//a[contains(@class,"videopic")]') or tree.xpath('//div[contains(@class,"item")]//a[.//img]') or tree.xpath('//a[contains(@href,"/movie/") and .//img]')
        for a in items:
            try:
                href = self._fix(a.get("href")); m = re.search(r"(?:index|detail)?(\d+)\.html", href)
                if not m or m.group(1) in seen: continue
                seen.add(m.group(1)); img = a.xpath('.//img')[0] if a.xpath('.//img') else None
                pic = self._fix((img.get("data-original") or img.get("data-src") or img.get("src")) if img is not None else "")
                name = a.get("title") or (img.get("alt") if img is not None else "") or self._text(a)
                out.append({"vod_id": m.group(1), "vod_name": name, "vod_pic": pic})
            except Exception: continue
        return out
    def homeContent(self, filter): return {"class": self.categories, "list": self._list(self._get(self.host)), "filters": {}}
    def homeVideoContent(self): return {"list": self._list(self._get(self.host))}
    def categoryContent(self, tid, pg, filter, extend):
        pg = int(pg) if str(pg).isdigit() else 1; html = self._get(f"{self.host}/index.php/vod/show/id/{tid}/page/{pg}"); items = self._list(html); limit = len(items) or 20; pagecount = self._pagecount(html, pg)
        return {"page": pg, "pagecount": pagecount, "limit": limit, "total": 0, "list": items}
    def detailContent(self, ids):
        out = []
        for vid in ids:
            try:
                tree = etree.HTML(self._get(f"{self.host}/index.php/vod/detail/id/{vid}.html")); name = self._text(tree.xpath("//h1 | //h2")[0]) if tree.xpath("//h1 | //h2") else str(vid)
                pic = self._fix((tree.xpath('//div[contains(@class,"pic")]//img/@src') or tree.xpath('//img/@data-original') or [""])[0])
                fs = []; us = []
                for panel in tree.xpath('//div[contains(@class,"panel")]') or tree.xpath('//div[contains(@class,"playlist")]'):
                    opt = panel.xpath('.//a[contains(@class,"option")]'); source = (opt[0].get("title") or self._text(opt[0])) if opt else f"线路{len(fs)+1}"
                    eps = panel.xpath('.//ul[contains(@class,"playlistlink")]//a') or panel.xpath('.//ul//a[contains(@href,"/index.php/vod/play/")]')
                    links = [self._text(a) + "$" + self._fix(a.get("href")) for a in eps if a.get("href")]
                    if links: fs.append(source); us.append("#".join(links))
                out.append({"vod_id": str(vid), "vod_name": name, "vod_pic": pic, "vod_play_from": "$$$".join(fs), "vod_play_url": "$$$".join(us)})
            except Exception: continue
        return {"list": out}
    def searchContent(self, key, quick, pg="1"):
        try: r = self.session.get(self.host + "/index.php/vod/search.html", params={"wd": key, "page": pg}, headers=self.headers, timeout=15, verify=False, proxies=self.session.proxies or None); r.encoding = r.apparent_encoding or "utf-8"; return {"list": self._list(r.text), "page": int(pg)}
        except Exception: return {"list": [], "page": int(pg)}
    def playerContent(self, flag, id, vipFlags):
        url = self._resolve_media(id)
        return {"parse": 0 if self._is_media(url) else 1, "url": url, "header": json.dumps(self.headers)}
```

---

# 采集API骨架（JSON接口站）

## 关键特征

```
API: /api.php/provide/vod/?ac=list&tid={分类ID}&pg={页码}
详情: /api.php/provide/vod/?ac=detail&ids={ID}
搜索: /api.php/provide/vod/?ac=detail&wd={关键词}
返回: JSON格式，直接解析无需HTML选择器
```

```python
#!/usr/bin/python
import json
import re
from urllib.parse import urljoin, urlparse
import requests
from base.spider import Spider

class Spider(Spider):
    def getName(self): return "API站点"
    def init(self, extend=""):
        self.name = "API站点"; self.host = "https://example.com"; self.api = self.host + "/api.php/provide/vod/"
        self.headers = {"User-Agent": "Mozilla/5.0", "Referer": self.host + "/"}
        self.session = requests.Session(); self.session.headers.update(self.headers)
    def _json(self, url, params=None):
        try: return self.session.get(url, params=params or {}, headers=self.headers, timeout=15, verify=False, proxies=self.session.proxies or None).json()
        except Exception: return {}
    def _html(self, url):
        try:
            r = self.session.get(url, headers=self.headers, timeout=15, verify=False, proxies=self.session.proxies or None); r.encoding = r.apparent_encoding or "utf-8"; return r.text
        except Exception: return ""
    def _fix(self, url): return urljoin(self.host + "/", url or "")
    def _is_media(self, url): return bool(re.search(r"\.(?:m3u8|mp4)(?:$|[?#])", urlparse(url).path, re.I))
    def _resolve_media(self, url, depth=0):
        url = self._fix(url)
        if self._is_media(url) or depth > 3: return url
        body = self._html(url)
        m = re.search(r'player_data\s*=\s*(\{.*?\})', body, re.S)
        if m:
            try:
                value = json.loads(m.group(1)).get("url", "")
                if value: return self._resolve_media(urljoin(url, value), depth + 1)
            except Exception: pass
        m = re.search(r'(?:var\s+now|var\s+playurl)\s*=\s*["\']([^"\']+)', body)
        if m: return self._resolve_media(urljoin(url, m.group(1).replace("&amp;", "&")), depth + 1)
        frame = re.search(r'<iframe[^>]+src=["\']([^"\']+)', body, re.I)
        if frame: return self._resolve_media(urljoin(url, frame.group(1)), depth + 1)
        scopes = re.findall(r'<(?:script|video|source)[^>]*>.*?</(?:script|video|source)>|<(?:video|source)[^>]*>', body, re.I | re.S)
        haystack = "\n".join(scopes) if scopes else body
        candidates = re.findall(r'https?://[^"\'<>\s]+\.(?:m3u8|mp4)[^"\'<>\s]*', haystack, re.I)
        bad = re.compile(r'(?:^|[/_.-])(ad|ads|advert|preview|trailer|recommend|demo|sample)(?:[/_.-]|$)', re.I)
        candidates = list(dict.fromkeys(x.replace("&amp;", "&") for x in candidates if not bad.search(urlparse(x).path)))
        tokens = re.findall(r'[A-Za-z0-9]{4,}', urlparse(url).path + "?" + urlparse(url).query)
        current_ids = [x for x in tokens if any(c.isdigit() for c in x) and x.lower() not in ("html", "m3u8", "index")]
        candidates.sort(key=lambda x: (not any(i in x for i in current_ids), len(x)))
        return self._resolve_media(candidates[0], depth + 1) if candidates else url
    def _item(self, v): return {"vod_id": str(v.get("vod_id", "")), "vod_name": v.get("vod_name", ""), "vod_pic": self._fix(v.get("vod_pic", ""))}
    def homeContent(self, filter):
        d = self._json(self.api, {"ac": "list"}); return {"class": d.get("class", []), "list": [], "filters": {}}
    def homeVideoContent(self):
        d = self._json(self.api, {"ac": "detail", "pg": 1}); items = d.get("list", [])
        return {"list": [self._item(v) for v in items]}
    def categoryContent(self, tid, pg, filter, extend):
        pg = int(pg) if str(pg).isdigit() else 1; d = self._json(self.api, {"ac": "list", "tid": tid, "pg": pg})
        return {"page": pg, "pagecount": int(d.get("pagecount", 1) or 1), "limit": int(d.get("limit", 20) or 20), "total": int(d.get("total", 0) or 0), "list": [self._item(v) for v in d.get("list", [])]}
    def detailContent(self, ids):
        d = self._json(self.api, {"ac": "detail", "ids": ids[0] if isinstance(ids, list) else ids}); out = []
        for v in d.get("list", []): out.append({**self._item(v), "vod_play_from": v.get("vod_play_from", ""), "vod_play_url": v.get("vod_play_url", "")})
        return {"list": out}
    def searchContent(self, key, quick, pg="1"):
        pg = int(pg) if str(pg).isdigit() else 1; d = self._json(self.api, {"ac": "detail", "wd": key, "pg": pg}); items = d.get("list", [])
        if not items: items = self._json(self.api, {"ac": "list", "wd": key, "pg": pg}).get("list", [])
        return {"page": pg, "list": [self._item(v) for v in items]}
    def playerContent(self, flag, id, vipFlags):
        url = self._resolve_media(id)
        return {"parse": 0 if self._is_media(url) else 1, "url": url, "header": json.dumps(self.headers)}
```

---

# 加密/特殊架构处理模块

## AES-CBC解密（图片/标题加密站通用）

```python
from functools import partial
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
import base64

def _aes_decrypt(self, data, key, iv=b"0000000000000000"):
    # 关键：unpad 失败时不要返回密文/乱码，返回 None 让上层走 fallback。
    try:
        cipher = AES.new(key.encode() if isinstance(key, str) else key, AES.MODE_CBC, iv.encode() if isinstance(iv, str) else iv)
        dec = cipher.decrypt(base64.b64decode(data))
        # 先判断 magic bytes，能出真图就直接返回，避免 unpad 因尾噪失败
        if dec[:3] == b"\xff\xd8\xff" or dec[:8] == b"\x89PNG\r\n\x1a\n":
            if dec[:3] == b"\xff\xd8\xff":
                end = dec.find(b"\xff\xd9")
                if end != -1: return dec[:end + 2]
            return dec
        return unpad(dec, AES.block_size).decode("utf-8")
    except Exception:
        return None
```

## XOR解密（128字节密钥）

```python
def _xor_decrypt(self, data, key):
    k = key.encode() if isinstance(key, str) else key
    return bytes(b ^ k[i % len(k)] for i, b in enumerate(data.encode() if isinstance(data, str) else data)).decode("utf-8", errors="ignore")
```

## RSA签名链（API签名站）

```python
import rsa as rsa_lib

def _rsa_sign(self, data, private_key_pem):
    priv = rsa_lib.PrivateKey.load_pkcs1(private_key_pem.encode())
    return rsa_lib.sign(data.encode(), priv, "SHA-256").hex()
```

## iframe二次解析（加密播放器通用）

```python
def _parse_iframe(self, html):
    m = re.search(r'<iframe[^>]+src=["\']([^"\']+)', html)
    if m:
        iframe_url = self._fix(m.group(1))
        # 必须复用 self.session 并带 proxies，不能裸用 requests.get 直连（被墙时拿不到）
        iframe_html = self._get(iframe_url)
        if iframe_html:
            return re.search(r'(https?://[^\s"\']+\.m3u8[^\s"\']*)', iframe_html)
    return None
```

---


---


以下内容来自真实站点开发中遇到的非标准架构问题，按场景分类，供后续遇到相似网站时参考。

## 场景1：多层嵌套页面编码

**特征**：页面源码不是直接HTML，而是通过JS `document.write` 动态输出。编码方案多层嵌套，且不同页面类型编码方式不同。

**典型案例**：
- 首页/分类页：`atob("hex_b64")` → base64解码得hex字符串 → hex转bytes → UTF-8解码 → URI解码 → 真实HTML
- 详情页：`atob(atob("b64"))` → 双重base64解码 → URI解码 → 真实HTML
- 搜索页：可能是第三种变体

**识别方法**：
1. 页面源码以 `<!DOCTYPE html><script>document.write(` 开头
2. 响应体很小（27KB~70KB），但解码后内容很大（170KB~220KB）
3. 响应中没有 `videolist`、`<div` 等HTML关键词，需要解码后才出现

**处理方案**：写通用 `decode_page` 方法，按优先级尝试多种解码路径：
```python
def _looks_html(self, s):
    # 容忍 BOM、空白和一个或多个 HTML 注释前缀，但不能把任意以 < 开头的乱码当 HTML
    t = (s or '').lstrip('\ufeff \t\r\n')
    t = re.sub(r'^(?:<!--.*?-->\s*)+', '', t, flags=re.S)
    return bool(re.match(r'(?is)^(?:<!doctype\s+html\b|<html\b|<head\b|<body\b|<div\b|<script\b|<main\b|<section\b)', t))

def decode_page(self, html):
    try:
        # 路径1: 双重 atob
        m = re.search(r'atob\(atob\("([^"]+)"\)\)', html)
        if m:
            s1 = base64.b64decode(m.group(1)).decode('utf-8', errors='replace')
            s2 = base64.b64decode(s1).decode('utf-8', errors='replace')
            final = urllib.parse.unquote(s2)
            # 如果不是 HTML，再尝试解一层
            if not self._looks_html(final):
                try:
                    final = base64.b64decode(final).decode('utf-8', errors='replace')
                    final = urllib.parse.unquote(final)
                except: pass
            return final
        # 路径2: 单次 atob + hex
        m2 = re.search(r'atob\("([^"]+)"\)', html)
        if m2:
            s1 = base64.b64decode(m2.group(1)).decode('utf-8', errors='replace')
            if all(c in '0123456789abcdefABCDEF' for c in s1[:20]):
                raw = bytes.fromhex(s1)
                s2 = raw.decode('utf-8', errors='replace')
                final = urllib.parse.unquote(s2)
            else:
                final = urllib.parse.unquote(s1)
            if not self._looks_html(final):
                try:
                    final = base64.b64decode(final).decode('utf-8', errors='replace')
                    final = urllib.parse.unquote(final)
                except: pass
            return final
    except Exception as e:
        print(f'[{self.name}] decode_page error: {e}')
    return html
```

**关键教训**：
- 分析阶段必须对首页、分类页、详情页、搜索页**分别**解码验证，不能假设全站统一编码
- 判断解码是否成功：去除 BOM、空白和注释前缀后，检查是否以 `<!doctype html`、`<html`、`<head`、`<body`、`<div`、`<script`、`<main` 或 `<section` 开头；禁止把任意以 `<` 开头的内容直接视为 HTML。

## 场景2：图片扩展名伪装

**特征**：封面图URL以 `.js` 结尾，但实际返回的是图片二进制数据（WebP/JPEG/PNG）。

**识别方法**：下载一个封面文件，检查 magic bytes：
- `RIFF....WEBP` → WebP格式
- `\xff\xd8\xff` → JPEG格式
- `\x89PNG` → PNG格式

**处理方案**：不要想当然改成 `.jpg`，要改成正确格式：
```python
def fix_pic(self, url):
    if not url: return ''
    if url.startswith('//'): return 'https:' + url
    if url.startswith('/'): return self.host + url
    if url.endswith('.js'): url = url[:-3] + '.webp'  # 根据实际magic bytes确定
    return url
```

**关键教训**：遇到非标准扩展名时，检查实际文件头，不要猜格式。

## 场景3：域名热更换 + 跳转页嵌套

**特征**：站点域名频繁更换，旧域名返回"即将关闭"跳转页，跳转页中包含新域名列表。跳转页本身也是编码的。

**识别方法**：
1. 正常分类页响应 ~700KB，跳转页响应 ~27KB
2. 跳转页解码后包含 `goWithHealthCheck('新域名')` 函数调用
3. 连续请求多个域名都返回小体积跳转页

**处理方案**：在 `_fetch` 方法中实现自动域名发现：
```python
def _fetch(self, url, headers=None, **kw):
    import requests, re
    hdr = headers or self.headers
    sess = getattr(self, "session", requests)
    proxies = getattr(sess, "proxies", None) or None
    last_err = None
    for host in self.hosts:
        try:
            target = url.replace(self.hosts[0], host) if host != self.hosts[0] else url
            r = sess.get(target, headers=hdr, timeout=15, verify=False, proxies=proxies)
            text = r.text
            # 检测跳转页：体积小 + 无真实内容
            if len(text) < 30000 and 'videolist' not in text:
                decoded = self.decode_page(text)
                if 'goWithHealthCheck' in decoded:
                    # 提取新域名
                    new_domains = re.findall("goWithHealthCheck\\(['\"]([^'\"]+)['\"]\\)", decoded)
                    for nd in new_domains:
                        new_url = 'https://' + nd
                        if new_url not in self.hosts:
                            self.hosts.insert(0, new_url)
                            print(f'[{self.name}] 发现新域名: {nd}')
                    continue  # 跳过此域名，尝试下一个
                if 'videolist' in decoded or '/view/' in decoded:
                    # 解码后是真实内容：不要构造只有 text/status_code 的假响应对象。
                    # 保留真实 Response 的 headers/content/url 等属性，只替换正文。
                    r._content = decoded.encode("utf-8", errors="ignore")
                    r.encoding = "utf-8"
                    return r
            return r
        except Exception as e:
            last_err = e
            continue
    raise last_err
```

**关键教训**：
- 跳转页体积小（<30KB）且不含 `videolist`，可用此特征快速区分
- 新域名从跳转页的 `goWithHealthCheck('域名')` 调用中提取
- 提取到的新域名插入到域名列表头部，下次请求优先使用

## 场景4：二级分类藏在页面内容区

**特征**：导航栏显示的分类是平级的，真正的子分类在分类页面的 `child-category` 区域内。且不是所有一级分类都有子分类。

**识别方法**：抓取分类页，搜索 `child-category` 或 `旗下分类` 关键词：
```html
<div class="child-category">
    <span class="child-text"><a href="/category/23">中文字幕</a></span>
    <span class="child-text"><a href="/category/25">国产剧情</a></span>
</div>
```

**处理方案**：硬编码子分类映射，不用动态抓取（动态抓取会触发限流）：
```python
sub_cats = {
    '7': [('23','中文字幕'), ('25','国产剧情'), ('26','推特网红'), ...],
    # 只列出有子分类的一级分类ID
}
```

在 `homeContent` 中为有子分类的 `tid` 配置 `filters`：
```python
filters = {}
for c in result['class']:
    tid = c['type_id']
    subs = self.sub_cats.get(tid, [])
    if subs:
        options = [{'n': '全部', 'v': tid}] + [{'n': n, 'v': cid} for cid, n in subs]
        filters[tid] = [{'key': 'cid', 'name': '二级分类', 'value': options}]
```

`categoryContent` 通过 `extend.get('cid')` 切换子分类。

**关键教训**：对每个一级分类逐个抓取验证是否有子分类，不能假设全站统一。

## 场景5：时长通过JS函数动态生成

**特征**：视频时长不是直接写在HTML文本里，而是通过 `<script>document.write(secondsToHMS(2692))</script>` 动态生成。

**处理方案**：正则匹配秒数，Python自己转换：
```python
m_dur = re.search(r'secondsToHMS\((\d+)\)', block)
if m_dur:
    secs = int(m_dur.group(1))
    h = secs // 3600
    m_ = (secs % 3600) // 60
    s = secs % 60
    duration = f'{h:02d}:{m_:02d}:{s:02d}' if h else f'{m_:02d}:{s:02d}'
```

## 场景6：服务器严格限流

**特征**：短时间连续请求~5次后，所有域名同时返回 `Connection reset by peer`。

**处理方案**：
- 多域名轮换（至少3-7个备用域名）
- `_fetch` 方法异常不中断，自动切换下一个域名
- 开发测试时加 `time.sleep(3)` 间隔
- 正式运行中用户请求分散，不会触发限流

## 场景7：T4框架适配坑

**坑1**：`playerContent` 第三参数名
- 框架调用：`sp.playerContent(flag, pid, [])`
- 错误签名：`def playerContent(self, flag, id, vip)`
- 正确签名：`def playerContent(self, flag, id, vipFlags)`

**坑2**：不要覆盖父类 `fetch`
- 父类 `base.spider.Spider` 自带 `fetch` 方法
- 自定义请求逻辑用 `_fetch` 等不同名称，避免覆盖

**坑3**：`headers` 初始化时机
- 不要在类定义体直接赋值 `header = {...}`（引用未定义的 `host`）
- 在 `init()` 方法中设置 `self.headers = {...}`，与4KAV.py等参考源一致

**坑4**：`start.py` 的 `normalize` 函数要求
- `categoryContent` 返回必须包含 `page`、`pagecount`、`limit`、`total` 字段
- `detailContent` 返回的 `list` 中的 `vod` 必须包含 `vod_play_from` 和 `vod_play_url`

---


---
# 小说类模板
**关键差异**：detailContent返回章节列表，playerContent返回正文

```python
    def detailContent(self, ids):
        result = {"list": []}
        for vid in ids:
            try:
                html = self._get(f"{self.host}/book/{vid}.html")
                if not html: continue
                tree = etree.HTML(html)
                name = "".join(tree.xpath('//h1/text()')).strip()
                chapters = [(a.text.strip(), self._fix(a.get("href",""))) for a in tree.xpath('//div[contains(@class,"chapter")]//a')]
                result["list"].append({"vod_id": vid, "vod_name": name, "vod_pic": "", "vod_play_from": "小说阅读", "vod_play_url": "#".join(f"{t}${u}" for t, u in chapters), "vod_player": "novel"})
            except: continue
        return result
    def playerContent(self, flag, id, vipFlags):
        html = self._get(id)
        if not html: return {"parse": 1, "url": "", "header": ""}
        tree = etree.HTML(html)
        title = "".join(tree.xpath('//h1/text() | //title/text()')).strip() or "正文"
        content = "\n\n".join(x.strip() for x in tree.xpath('//div[contains(@class,"content")]//text()') if x.strip())
        return {"parse": 0, "url": "novel://" + json.dumps({"title": title, "content": content}, ensure_ascii=False), "header": ""}
```

---

# 图片类模板

**关键差异**：playerContent返回pics://协议

```python
    def detailContent(self, ids):
        result = {"list": []}
        for vid in ids:
            try:
                html = self._get(f"{self.host}/album/{vid}.html")
                if not html: continue
                tree = etree.HTML(html)
                name = "".join(tree.xpath('//h1/text()')).strip()
                pics = [self._fix(a.get("href","")) for a in tree.xpath('//div[contains(@class,"gallery")]//a') if a.get("href")]
                result["list"].append({"vod_id": vid, "vod_name": name, "vod_pic": pics[0] if pics else "", "vod_play_from": "图集", "vod_play_url": "#".join(f"图{i+1}${u}" for i, u in enumerate(pics))})
            except: continue
        return result
    def playerContent(self, flag, id, vipFlags):
        html = self._get(id)
        if not html: return {"parse": 1, "url": "", "header": json.dumps(self.headers)}
        tree = etree.HTML(html)
        imgs = [self._fix(i.get("data-src") or i.get("data-original") or i.get("src","")) for i in tree.xpath('//div[contains(@class,"content")]//img')]
        imgs = [u for u in imgs if u]
        return {"parse": 0, "url": f'pics://{"&&".join(imgs)}', "header": json.dumps(self.headers)}
```

---

# 漫画类模板
详情用`vod_player: pics`声明漫画查看器，playerContent按章节返回`pics://`图片序列

```python
    def detailContent(self, ids):
        result = {"list": []}
        for vid in ids:
            try:
                html = self._get(f"{self.host}/comic/{vid}.html")
                if not html: continue
                tree = etree.HTML(html)
                name = "".join(tree.xpath('//h1/text()')).strip()
                chapters = [(a.text.strip(), self._fix(a.get("href",""))) for a in tree.xpath('//div[contains(@class,"chapter")]//a')]
                result["list"].append({"vod_id": vid, "vod_name": name, "vod_pic": "", "vod_play_from": "漫画浏览", "vod_play_url": "#".join(f"{t}${u}" for t, u in chapters), "vod_player": "pics"})
            except: continue
        return result
    def playerContent(self, flag, id, vipFlags):
        html = self._get(id)
        if not html: return {"parse": 1, "url": "", "header": json.dumps(self.headers)}
        tree = etree.HTML(html)
        imgs = [self._fix(i.get("data-src") or i.get("data-original") or i.get("src","")) for i in tree.xpath('//div[contains(@class,"comic")]//img')]
        imgs = [u for u in imgs if u]
        return {"parse": 0, "url": f'pics://{"&&".join(imgs)}', "header": ""}
```

---

# 音乐类模板

```python
    def detailContent(self, ids):
        result = {"list": []}
        for vid in ids:
            try:
                html = self._get(f"{self.host}/song/{vid}.html")
                if not html: continue
                tree = etree.HTML(html)
                name = "".join(tree.xpath('//h1/text()')).strip()
                audio = tree.xpath('//audio/source') or tree.xpath('//audio')
                url = self._fix(audio[0].get("src","")) if audio else ""
                if not url:
                    m = re.search(r'(https?://[^\s"\']+\.mp3[^\s"\']*)', html)
                    url = m.group(1) if m else ""
                result["list"].append({"vod_id": vid, "vod_name": name, "vod_pic": "", "vod_play_from": "播放", "vod_play_url": f"播放${url}"})
            except: continue
        return result
    def playerContent(self, flag, id, vipFlags): return {"parse": 0, "url": self._fix(id), "header": json.dumps(self.headers)}
```

---

# 直播类模板

```python
    def homeContent(self, filter):
        html = self._get(self.host)
        if not html: return {"class": [], "list": [], "filters": {}}
        tree = etree.HTML(html)
        cats = [{"type_id": self._fix(a.get("href","")), "type_name": a.text.strip()} for a in tree.xpath('//div[contains(@class,"nav")]//a') if a.get("href")]
        return {"class": cats, "list": [], "filters": {}}
    def categoryContent(self, tid, pg, filter, extend):
        pg = int(pg) if str(pg).isdigit() else 1
        html = self._get(self._fix(tid))
        if not html: return {"page": pg, "pagecount": pg, "limit": 0, "total": 0, "list": []}
        tree = etree.HTML(html)
        items = []
        for a in tree.xpath('//a[contains(@href,".m3u8")]'):
            name = a.text.strip()
            if not name: continue
            items.append({"vod_id": self._fix(a.get("href","")), "vod_name": name, "vod_pic": ""})
        return {"page": pg, "pagecount": pg, "limit": len(items), "total": len(items), "list": items}
    def detailContent(self, ids): return {"list": [{"vod_id": ids[0], "vod_name": "直播", "vod_play_from": "直播", "vod_play_url": f"直播${ids[0]}"}]}
    def playerContent(self, flag, id, vipFlags): return {"parse": 0, "url": self._fix(id), "header": json.dumps(self.headers)}
```

---

# 短剧类模板

与影视模板完全一致，仅分类/URL路径不同，无需额外模板

---

# 通用工具方法

```python
def _fix(self, u): 
    """修复URL，处理相对路径和协议"""
    if not u: return ""
    if u.startswith("//"): return "https:" + u
    if u.startswith("/"): return self.host + u
    return u

def _get(self, url):
    """发送GET请求，带错误处理和超时控制"""
    try:
        r = requests.get(url, headers=self.headers, timeout=15)
        r.encoding = r.apparent_encoding or "utf-8"
        return r.text
    except requests.exceptions.Timeout:
        print(f"[ERROR] 请求超时: {url}")
        return None
    except requests.exceptions.ConnectionError:
        print(f"[ERROR] 连接错误: {url}")
        return None
    except Exception as e:
        print(f"[ERROR] 请求失败: {url}, 错误: {str(e)}")
        return None

def _post(self, url, data):
    """发送POST请求，带错误处理"""
    try:
        r = requests.post(url, data=data, headers=self.headers, timeout=15)
        r.encoding = r.apparent_encoding or "utf-8"
        return r.text
    except Exception as e:
        print(f"[ERROR] POST请求失败: {url}, 错误: {str(e)}")
        return None

def _extract_m3u8(self, html):
    """从HTML中提取m3u8播放链接"""
    if not html: return None
    patterns = [
        r'var\s+now\s*=\s*["\']([^"\']+\.m3u8[^"\']*)["\']',
        r'var\s+player_data\s*=\s*(\{.*?\})',
        r'url:\s*["\']([^"\']+\.m3u8[^"\']*)["\']',
        r'var\s+playurl\s*=\s*["\']([^"\']+)["\']',
        r'(https?://[^\s"\']+\.m3u8[^\s"\']*)'
    ]
    for p in patterns:
        m = re.search(p, html)
        if m:
            val = m.group(1)
            if ".m3u8" not in val and "{" in val:
                m2 = re.search(r'"(https?://[^"]+\.m3u8[^"]*)"', val)
                return m2.group(1) if m2 else None
            return val
    return None

def _extract_json(self, html, pattern):
    """从HTML中提取JSON数据"""
    if not html: return {}
    m = re.search(pattern, html)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception as e:
            print(f"[ERROR] JSON解析失败: {str(e)}")
    return {}

def _get_pagination(self, html, xpath):
    """提取分页信息"""
    if not html: return 1
    tree = etree.HTML(html)
    pages = tree.xpath(xpath)
    if pages:
        try:
            return int(pages[-1])
        except:
            pass
    return 1
```

---


---

## 场景8：SPA/API型多模块站点开发（R星精选复盘）

**核心经验**：遇到复杂 SPA + JSON API 站点时，先找稳定锚点，再做最小差异修改；越复杂的网站，越不能凭经验猜。若同目录已有可用源，必须优先读取并复用其鉴权、解密、代理、播放协议和字段映射，不要另起炉灶重写。

**典型特征**：
- 首页 HTML 只有 `app` 容器和大量 JS/CSS，内容由前端接口加载。
- API 需要游客 token、请求头 token、响应 `enc:true` 加密。
- 内容类型混合：漫画、小说、有声漫、动漫、视频、短视频/抖涩、直播。
- 分类返回并非统一资源列表，部分“推荐”分类返回专题/榜单聚合。
- 字段可能嵌套，例如视频列表是 `{movie, movieUser}`，真实封面在 `movie.imgurl`，播放在 `movie.movieurl`。

**强制流程**：
1. 先 `analyze_website` 判断是否为 SPA/API 型，若 HTML 选择器为空，不要按 XPath 模板硬写。
2. 检查同目录、同站名、同系列源，例如 `R星测试.py`、`xxx测试.py`、旧版可用源。
3. 如果发现已有可用源，以它为底座做最小修改，优先复用 token 获取、响应解密、图片代理、分类 ID 编码、播放/阅读协议、抖涩/直播特殊接口。
4. 对每个模块至少实测一条完整链路：`分类 → 列表 → 详情 → playerContent`。
5. 不只验证“列表有数据”，还要验证：封面非空、ID 带模块前缀、详情有线路、播放器 URL 可用。

**鉴权与解密经验**：
- 若直接请求接口返回 `302/登录过期`，先反查前端 `http.js` 或可用源里的 token 逻辑。
- 常见游客 token 接口：`/user/autoUser/null/null/null`、`/user/autoUser/null/td/null`。
- R星类站点响应解密流程：
```python
def decode_api_data(data_str):
    step1 = base64.b64decode(pad_b64(data_str)).decode('latin1')
    step2 = step1[::-1]
    step3 = base64.b64decode(pad_b64(step2))
    return json.loads(step3.decode('utf-8'))
```
- 解密后常见结构：`{token, dataUser, tableSuffix}`，后续请求必须在 header 中带 `token`。

**分类层级经验**：
- 用户说“推荐按二级页面做”，不能理解为普通筛选项直接出资源。
- 正确结构是：`一级分类 → 推荐 → 专题/榜单文件夹 → 资源列表`。
- 文件夹卡片必须用 `vod_tag: folder`，ID 可编码为：
```python
folder$manhua$410
folder$anime$27495
folder$movie$27459
```
- 点击 `folder$...` 后，`categoryContent` 再根据模块走真实专题列表接口。

**R星类接口映射**：
- 漫画分类：`manhua/fenglei`
- 漫画普通列表：`manhua/onetab/{tid}/{pg}/{size}/time/hjm.ojbk`
- 漫画推荐专题：`manhua/fengleidata/{tid}/hjm.ojbk`
- 漫画专题资源：`manhua/moredata/{zhutiId}/{pg}/{size}/time/hjm.ojbk`
- 漫画详情/章节：`manhua/data/{id}` 或 `manhua/datav2/1/{id}/hjm.ojbk`
- 漫画图片：`manhua/data/zjv2/{chapterId}/hjm.ojbk`，`imgurl` 逗号分隔。
- 小说分类：`book/fenglei/1`
- 小说列表：`book/md/xsmoredata/{tid}/{pg}/{size}/zx/hjm.ojbk` 或 `book/everyday/{pg}/{size}/time`
- 小说专题资源：`book/moredata/{zhutiId}/{pg}/{size}/time/hjm.ojbk`
- 有声漫：`manhua/ysm/hjm.ojbk`
- 动漫分类：`movie/fenglei_dm/hjm.ojbk`
- 视频分类：`movie/fenglei`
- 动漫/视频普通列表：`movie/fengleidataShow/{tid}/{pg}/{size}/zx[/hjm.ojbk]`
- 动漫/视频推荐专题：`movie/fengleidata/{tid}[/hjm.ojbk]`
- 动漫/视频专题资源：`movie/moredata/{zhutiId}/{pg}/{size}/zx/hjm.ojbk`
- 抖涩/抖音：`tik/zuixin/{pg}/{size}/time/hjm.ojbk`，入口可取 30 条；详情短视频流建议首条固定 + 后续全库随机抽样。
- 直播：`local_live/fldata/{liveId}/{pg}/20`，真实播放字段常为 `stream`。

**字段映射经验**：
- 列表封面不要只取顶层 `imgurl`，要检查嵌套：
```python
movie = item.get('movie', item)
pic = movie.get('imgurl') or movie.get('cover') or movie.get('image') or ''
```
- 视频列表常见结构：`item = {movie:{...}, movieUser:{...}}`。
- 视频直链可直接从 `movie.movieurl` 取，试看片段为 `movie.movieurlSk`。
- 直播列表常见字段：`username/snapshot/stream/viewersCount/isOnline`。
- 小说章节接口可能只返回 `txturl`，需要二次 GET 文本文件；文件内容可能仍是 base64，需要尝试解码。


**短视频随机流经验**：
- 用户说“像刷抖音一样上下滑随机”，不能只把当前页 80 条洗牌；那只是页内随机，不是全库随机。
- 正确语义是：点击哪个视频，第一条必须固定为该视频；后续视频从整个抖涩库随机抽样。
- 建议入口列表取 30 条，详情播放流也返回 30 条：`1 条点击项 + 29 条全库随机项`。
- 每次进入详情都重新生成随机池；退出后再点击其他视频，应生成新 30 条，不沿用上一组。
- 可用 `last_tiktok_pool` 记录上一组 ID，下次随机时尽量避开，减少重复感。
- 如果接口有分页总数，例如 `pages=351`，可随机抽多个页码：
```python
res = api_req(f"tik/zuixin/{pg}/30/time/hjm.ojbk")
pages = int(res.get('pages', 1))
for rp in random.sample(range(1, pages + 1), min(10, pages)):
    rr = api_req(f"tik/zuixin/{rp}/30/time/hjm.ojbk")
```
- 随机池要去重，且第一条点击项不能被随机逻辑挤掉：
```python
clicked_item = records[clicked_idx]
seen = {str(clicked_id)}
pool = []
# 随机页取样后 append 到 pool
random.shuffle(pool)
ordered_records = [clicked_item] + pool[:29]
```
- 播放标题必须清理 `#` 和 `$`，否则会破坏 `vod_play_url` 的分集结构：
```python
title = str(title).replace('#', ' ').replace('$', ' ')
```

**短视频缓存/续播避坑**：
- 客户端可能记住同一 `vod_id`、同一 `vod_play_from`、同一播放列表的上次集数。
- 为避免再次点击 1 号视频却恢复到上次滑到的视频，必须让详情和播放项带点击上下文。
- 列表 ID 建议带页码、视频 ID、列表位置：
```python
tiktok${pg}${id}${idx}
```
- `vod_play_from` 不要固定为“抖音模式”，应包含点击 ID：
```python
vod_play_from = '抖涩_' + str(clicked_id)
```
- 播放项 ID 应包含点击 ID 和序号，最后一段才是真实 URL：
```python
video_short_play${clicked_id}${idx}${m3u8_url}
```
- `playerContent` 解析时取最后一段，避免把上下文字段拼进播放地址：
```python
url = id.split('$')[-1]
```
- 验证标准：连续点击不同视频时，第一条 ID 必须等于点击 ID；后续 29 条应来自随机页；再次点击同一视频，第一条仍固定，但后续随机组应变化。

**视频播放与解密经验补充**：
- API 型站点的播放失败往往不是播放器问题，而是 token 或响应解密没处理。
- `enc:true` 解密后再取字段；不要直接从加密壳的 `data` 里找 `movieurl`。
- 视频列表常有嵌套：`item.movie.movieurl`、`item.movie.movieurlSk`、`item.movie.imgurl`。
- 有直链时可直接把 m3u8 base64 编进详情 ID，减少详情二次请求：
```python
video_detail_direct${movie_id}${base64_m3u8}
```
- 对直播类内容，优先找 `stream`，其次才是 `playurl/playUrl/flv/m3u8/hls`。

**ID编码经验**：
必须给不同模块加稳定前缀，避免详情和播放混路由：
```python
comic${id}
book${id}
ysm${id}
anime_direct${id}${base64_m3u8}
video_detail_direct${id}${base64_m3u8}
tiktok${pg}${id}
video_live${stream}
folder$movie${zhutiId}
```

**验证清单**：
- `homeContent`：一级分类完整，筛选含“推荐”。
- `categoryContent('manhua', 推荐ID)`：返回 `folder$manhua$...`，不是直接资源。
- `categoryContent('anime', 推荐ID)`：返回 `folder$anime$...`。
- `categoryContent('movie', 推荐ID)`：返回 `folder$movie$...`。
- `categoryContent('folder$...')`：返回真实资源。
- 非推荐分类返回真实资源且 `vod_pic` 非空。
- 有声漫一级分类有资源。
- 抖涩按可用源接口返回资源。
- 直播 `playerContent` 返回 `stream`。

**关键教训**：
- 有可用基准源时，先读基准源；不要重新发明鉴权/解密。
- API型站点不要套 HTML/XPath 评分标准；真实可用性以端到端接口验证为准。
- 用户的“二级页面”是交互层级要求，不是简单筛选字段。
- 一切字段以真实 JSON 返回为准，不凭名称猜。


---


---

# 故障排查

| 问题 | 方案 |
|------|------|
| `module 'xxx' has no attribute 'Spider'` | 创建Spider类 |
| 影视仓无法加载T4源 | type:4 + api地址正确 |
| 字幕不显示 | playerContent返回subs |
| 播放403 | playerContent返回header |
| 壳端浏览器可访问但 py 没数据 | Python requests 不自动继承系统 VPN；检查 extend.proxy、本机代理端口、环境变量与 session.proxies |
| 羊壳推荐页空/只有推荐页 | 检查 homeVideoContent、homeContent.class、filters dict、六接口和 init 顺序 |
| localProxy/proxyPic 图片不显示 | 图片请求必须复用 session/proxies；检查 body 长度、magic bytes、真实 MIME 和 JPEG EOI |
| 播放页/解析器被当直链 | parse:0 只允许真 http/https m3u8/mp4；未解析页面必须 parse:1 |
| data-preview/data-play-src 播放错片 | 列表直链写入 play ID，禁止详情页抓第一个推荐位；候选需过滤 preview/trailer/recommend/ad |
| HLS 主 m3u8 200 但不能播 | 逐级验证主清单、子清单、key、ts 与 #EXTM3U |
| 苹果CMS主分类空/补图缺前几条 | 用实测 CAT_SUBS 合并；仅缺图时按 20 条分批补图并按 vod_id 回填 |
| Nuxt/Next/Vite 数据为空 | 先还原 __NUXT_DATA__/devalue 或挖 config.js/chunk API，再验证分类参数是否生效 |
| folder 点击直接播放/不能翻页 | 必须 vod_tag:folder，由 categoryContent 分发并实测第1/2页 |
| 发布页解出域名但列表空 | 验证目标站结构，防止域名被其他站占用或 200 假成功 |
| 分类页空数据 | 用py_mcp:analyze_website重新分析选择器 |
| 播放链接获取失败 | 用py_mcp:debug_play_link递归调试 |
| 选择器匹配0个 | 用py_mcp:debug_selector验证，检查contains |
| 小说正文为空 | 检查内容区XPath，多级兜底 |
| 图片不全 | 检查分页/data-src/data-original懒加载 |
| 加密内容无法解密 | 用py_mcp:analyze_website检测加密类型 |
| JSON API站 | 使用采集API骨架，跳过HTML解析 |
| 搜索编码问题 | 关键词必须quote() |
| iframe播放器空白 | 二次请求iframe src提取m3u8 |
| 签名过期 | 检查API签名算法，添加时间戳参数 |

---

# 211实战源经验速查表

| 场景 | 占比 | 快速方案 |
|------|------|----------|
| MacCMS v8标准站 | 40% | v8骨架，改host+分类 |
| MacCMS v10标准站 | 30% | v10骨架，改host+分类 |
| 采集API站 | 10% | API骨架，改api路径 |
| 非标准影视站 | 10% | 深度分析HTML结构，自定义XPath |
| 加密站（AES/XOR/RSA） | 5% | 加密模块+对应骨架 |
| 异步站（aiohttp） | 3% | 同步改写，requests替代 |
| 双源聚合站 | 2% | 两套API合并，$$$分隔 |

---

---
## 场景9：动态域名/自动域名解析与容灾

**来源经验**：`小男娘.py` 和 `每日大赛1.py` 均属于发布页动态域名模式。共同点是先从发布页解析域名后缀，再拼随机前缀生成 host；区别是小男娘使用 AES-CBC 解密 `key/data` 后取 `zz_line/zz_backup_line`，每日大赛使用 `Base64.decode/atob` 后取 `words.random()+后缀` 或正则匹配后缀。

**适用特征**：发布页、永久地址、最新地址、`zz_line`、`zz_backup_line`、`Base64.decode`、`atob`、`words.random()`、随机子域名前缀、加载中跳转页、源码加密 `data`、域名频繁更换。

**判断是否适配**：如果发布页能解出域名后缀，且目标站请求路径在不同随机 host 下保持一致，适合“动态后缀 + 随机前缀 + 域名池”方案；如果域名与 cookie、签名、登录态或接口 token 绑定，仅随机 host 不够，必须叠加 API 鉴权/签名策略。

**半自动与全自动区别**：只在 `init()` 解析一次 `self.host`，并设置 `self.domains=[self.host]`，但 `_req()` 不使用域名池，只能算半自动。全自动必须：保存多个 suffix、生成多个 host、探活、失败切换、整池失败后重新解析发布页、跳转深度限制。

**标准实现要求**：
- 多个发布页入口按顺序尝试，单个失败不中断。
- AES 模式同时提取 `zz_line` 与 `zz_backup_line`，去重形成 suffix 池。
- Base64/atob 模式提取 `words.random()+suffix` 或正则后缀。
- 每个 suffix 生成多个随机前缀 host，形成 `self.domains`。
- 初始化后轻量探活，可用 host 插到队首。
- `_req()` 必须实际使用 `self.domains`；失败、空页、异常状态、加载中跳转时切换域名。
- 一轮域名池失败后重新解析发布页刷新域名池。
- 跳转页递归最多 3 层，防止无限递归。
- fallback 域名必须探活，不可盲信。
- `_fix_url()`/`_replace_host()` 统一使用当前 `self.host`，避免旧域名残留。
- 日志要区分发布页失败、解密失败、host 探活失败、请求失败、切换域名。

**推荐骨架**：
```python
def _build_domains(self, suffixes, count=3):
    ds=[]
    for s in suffixes:
        s=s.lstrip('.')
        for _ in range(count):
            pre=''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=5))
            ds.append('https://' + pre + '.' + s + '/')
    self.domains=list(dict.fromkeys(ds))
    self.host=self.domains[0] if self.domains else self.host

def _switch_domain(self):
    if not self.domains: return
    self.domains.append(self.domains.pop(0))
    self.host=self.domains[0]

def _req(self, url, depth=0):
    if depth > 3: return ''
    if not self.domains: self._resolve_domain()
    for _ in range(max(len(self.domains), 1)):
        try:
            target=self._replace_host(url)
            r=self.session.get(target, headers=self.headers, timeout=15, verify=False)
            if r.status_code == 200 and r.text:
                j=re.search(r'<a[^>]+href=["\'](https?://[^"\']+)["\'][^>]*>加载中', r.text, re.I)
                if j: return self._req(j.group(1), depth+1)
                return r.text
        except Exception: pass
        self._switch_domain()
    self._resolve_domain()
    return ''
```


---


---

## 音乐源上下文播放队列规范（djDVD复盘，强制）

**白话需求映射**：用户说“点哪首歌就播放哪首歌，同时播放列表还是这个歌手/歌单/榜单的所有歌曲，顺序不能乱”，专业理解为：**播放上下文透传 + 队列重建 + 当前项定位**。

**标准术语**：
- 上下文播放队列（Context Playback Queue）
- 播放上下文透传（把当前歌曲所属歌手/歌单/榜单URL或ID写进每首歌的 `vod_id`）
- 队列重建（详情页根据上下文重新抓完整歌曲列表）
- 当前项定位（用当前歌曲URL/ID/hash在完整队列中定位被点击项）
- 队列顺序保持（按页面DOM顺序与分页顺序合并，禁止并发乱序）
- 列表态与播放态解耦（category只展示歌曲卡片，detail负责构建播放队列）

**实现规则**：
1. 歌手、歌单、榜单等聚合页不要在点击文件夹时直接播放，应先进入歌曲列表页。
2. 歌曲列表中的每首歌 `vod_id` 必须携带：当前歌曲唯一标识 + 所属上下文标识 + 可选标题/封面。推荐格式：
```python
def _ctx_song_id(self, item, context_url):
    return 'ctxsong$' + self.e64('||||'.join([item.get('url',''), context_url, item.get('name',''), item.get('pic','')]))
```
3. `detailContent` 收到 `ctxsong$...` 时，必须解码出 `selected_url` 与 `context_url`，重新解析 `context_url` 的完整歌曲列表。
4. 当前播放项必须用稳定唯一值匹配，优先 URL/ID/hash，禁止只用歌名匹配。歌名重复、Live、Remix 很常见。
5. 播放返回建议使用双线路：
```python
vod_play_from = '当前播放$$$播放列表'
vod_play_url = 当前歌曲episode + '$$$' + '#'.join(完整队列episodes)
vod_play_index = 当前索引 + 1
play_index = 当前索引
```
6. 完整播放队列必须保持原页面顺序：
   - 单页：按DOM遍历顺序追加。
   - 多页：页码先排序，再按页内DOM顺序追加。
   - 如果并发抓分页，结果必须携带页码并排序后合并，禁止直接 `as_completed()` 顺序 append。
7. 去重必须稳定：用 `seen` 保留首次出现的歌曲URL/ID，不要排序去重导致顺序变化。
8. 点第 N 首时，详情页必须定位到第 N 首，当前播放线路只放第 N 首，播放列表线路仍包含该上下文下全部歌曲。
9. `vod_tag: folder` 只给可继续进入的歌手/歌单/榜单/筛选分类卡片使用；真实歌曲项必须进入 `detailContent`，不要继续当 folder。
10. 搜索出来的单曲没有上下文时，可只构建单曲播放；有搜索结果页上下文时也可按搜索页队列处理。

**参考详情骨架**：
```python
def detailContent(self, ids):
    vid = ids[0] if isinstance(ids, list) else ids
    if str(vid).startswith('ctxsong$'):
        selected_url, context_url, selected_name, selected_pic = self._ctx_song_decode(str(vid))
        tracks = self._get_all_song_items(context_url, selected_pic)
        idx = 0
        for i, t in enumerate(tracks):
            if t.get('url') == selected_url:
                idx = i
                break
        eps = [self._episode_from_item(t) for t in tracks]
        return {'list': [{
            'vod_id': vid,
            'vod_name': tracks[idx].get('name') if tracks else selected_name,
            'vod_pic': tracks[idx].get('pic') if tracks else selected_pic,
            'vod_play_from': '当前播放$$$播放列表',
            'vod_play_url': eps[idx] + '$$$' + '#'.join(eps),
            'vod_play_index': idx + 1,
            'play_index': idx
        }]}
```

**封面策略**：
- 有封面的卡片直接取本页封面。
- 无封面的歌手/歌单/榜单/分类卡片，进入下级页面取第一个可用封面。
- 歌曲封面优先取单曲详情页真实封面；取不到再回退到上级歌手/歌单/榜单封面。
- 大歌手页或超大歌单不要逐首同步抓详情封面导致卡死；可前若干首并发补真实封面，其余用fallback，点击播放详情时再强制刷新当前歌曲真实封面。

**层级经验**：
- 用户说“歌手改二级页面”：通常是 `歌手列表 → 该歌手所有歌曲`，点击歌手不是播放，而是进入该歌手歌曲列表。
- 用户说“歌单改三级页面”：通常是 `歌单 → 筛选分类 → 歌单卡片 → 歌单全部歌曲`。
- 用户说“榜单筛选作为二级页面”：通常是 `TOP/新歌 → 榜单选项卡片 → 该榜单歌曲列表`，原筛选项不要放在 home filters。
- “所有歌曲”指需要处理分页，不能只取第一页。

**布局经验**：
- 用户说“不要列表排列/常规排列”，不要给普通歌曲/歌单/榜单卡片写 `style: {'type':'list'}` 或强制 `rect`。
- 歌手头像可以保留 `style: {'type':'oval','ratio':1}` 以显示圆形头像。
- 普通卡片让客户端默认布局；除非用户明确要求每排数量或卡片比例。

**djDVD实战踩坑**：
- 歌手页上千首歌，逐首详情抓封面会非常慢；必须做限量并发、缓存和fallback。
- 单曲列表页没有图片时，真实封面通常在单曲详情页 `.djpic/.djpg/.cover` 等区域，不能用推荐歌单图冒充。
- 榜单卡片本身无封面时，可用榜单第一首歌真实封面做卡片封面。
- 歌单分类卡片无封面时，可进入该分类页取第一个歌单封面。
- 播放列表跨分页时，一定按页码排序后合并；并发只用于辅助抓封面或接口，不能破坏主列表顺序。

---

## v8.3 补充：Nuxt/SSR 短剧站、加密媒体与完成前验证

本节补齐模块版中新增而单文件版缺失的经验。后续遇到 Nuxt/SSR、payload、短剧 SPA、folder 二级分页、`episode_id`、加密图片、图片代理误用等问题时，优先执行本节规则。

### Nuxt/SSR 短剧站开发

**适用特征**：页面含 `__NUXT_DATA__`、`window.__NUXT__`、`_payload.js`、Nuxt 路由 chunk、SSR JSON 索引数组；普通 HTML 选择器为空，但源码能搜到 `video_id`、`title`、`cover`、`episode_id`、`actor_id` 等字段。

**强制流程**：

1. 不要直接套 MacCMS/XPath 模板；先抓分类第一页、详情页、播放页、演员页，确认是否为 Nuxt/SSR。
2. 实现 Nuxt 索引数组还原函数，把 `['ShallowReactive',1]` 这类索引引用还原成真实对象。
3. 用递归 `_walk` 扫描字段，先确认数据结构，再写列表、详情和播放映射。
4. 列表项如果有 `episode_id`，必须保留到 `vod_id` 或播放 ID，例如 `drama-play?id={video_id}&episode_id={episode_id}`。只传裸 `id` 可能导致播放页没有 `video_url`。
5. 裸播放入口坏不代表资源不可播；必须对比 `drama-play?id=xxx` 与 `drama-play?id=xxx&episode_id=yyy`。若后者返回 `video_url`，以列表 episode 入口为准。
6. 返回 `vod_tag:'folder'` 的项目不是详情页；必须在 `categoryContent(folder_id, pg, ...)` 里处理二级目录和翻页，`detailContent()` 只能做兼容兜底。
7. folder 二级分页 URL 必须实测，可能是 `/page/2/`、`?page=2`、`/p/2` 或接口参数；禁止固定 `pagecount=1`。
8. 列表页默认禁止逐条请求详情页补封面/备注；除非用户明确要求“完整优先”，否则列表只用当前页数据，二级/详情请求只在点击后发生。
9. `vod_remarks` 只提供角标文本，角标位置由客户端 UI 决定，Spider 不能保证左上/左下。

**Nuxt 还原骨架**：
```python
def _payload(self, html):
    m = re.search(r'<script[^>]+id=["\']__NUXT_DATA__["\'][^>]*>(.*?)</script>', html, re.S | re.I)
    if not m:
        return None
    try:
        arr = json.loads(html_parser.unescape(m.group(1)))
        def val(x):
            if isinstance(x, int) and 0 <= x < len(arr):
                return val(arr[x])
            if isinstance(x, list):
                return [val(i) for i in x]
            if isinstance(x, dict):
                return {k: val(v) for k, v in x.items()}
            return x
        return val(arr)
    except Exception as e:
        print(f'Nuxt解析失败: {e}')
        return None

def _walk(self, obj, keys=None):
    if isinstance(obj, dict):
        if not keys or any(k in obj for k in keys):
            yield obj
        for v in obj.values():
            yield from self._walk(v, keys)
    elif isinstance(obj, list):
        for v in obj:
            yield from self._walk(v, keys)
```

**字段映射经验**：

- 列表 ID：优先 `video_id/id`；若有 `episode_id`，组合保存。
- 封面：`cover/poster/image/thumb/avatar`，但必须抽样验证可显示。
- 备注：播放量、集数、追剧数可放 `vod_remarks`，但不能控制位置。
- 播放：详情页递归找 `episode_title + video_url`；为空时先检查列表 `episode_id` 是否丢失。
- 演员/专题/合集：通常应做 `vod_tag:'folder'`，点击后 `categoryContent` 返回资源，不进 `detailContent`。

### 加密媒体文件与图片代理

**特征**：图片 URL 有 `.jpg/.jpeg/.png` 扩展名，但响应 `Content-Type` 为 `binary/octet-stream`、`text/html`，body 为 0 字节，或文件头不是 JPEG/PNG/WebP/GIF；前端脚本中可能有 `media_key`、`media_iv`、`NUXT_PUBLIC_MEDIA_CRYPT_KEY`、`NUXT_PUBLIC_MEDIA_CRYPT_IV`。

**处理规则**：

- 图片 URL 非空不代表可显示；必须抽样检查状态码、长度、Content-Type 和 magic bytes。
- 加密图片用 `localProxy` 解密后返回真实 MIME；图片代理只处理图片，不能误用于 m3u8/mp4 播放 URL。
- 0 字节头像/封面不能靠解密修复；可保留空图、使用站内 fallback，或在二级/详情页兜底。
- 默认不逐条请求详情页补封面，避免列表变慢。
- 如果用户要求“完整优先”，可限量并发补封面，但必须保持列表顺序。

### 入口页 + 中转页 + Base64 后缀 + Nuxt 数据

有些站点不是“发布页直接给最终域名”，而是：入口页给中转域 → 中转页 `Base64.decode/atob` 解出 `words.random()+后缀` → 生成随机 host → 目标页含 Nuxt payload/API 数据。

必须分四步验证：

1. 发布页跳转是否有效。
2. 中转页是否能解码出后缀。
3. 随机 host 是否能访问目标页面。
4. 目标页面是否含 `__NUXT_DATA__` 或真实 API 数据。

不要把中转域当最终 host，不要把某个随机前缀写死。

### 完成前验证矩阵

- 首页：分类齐全，folder 和真实资源分清。
- 分类：分页实测，至少测试第 1 页和第 2 页；folder 二级不固定 `pagecount=1`。
- 详情：标题、封面、简介、线路和播放 ID 完整。
- 播放：带 `episode_id` 的站点必须确认 `vod_id` 或播放 ID 保留 episode_id；抽测裸 ID 和带 episode_id 入口。
- 图片：抽测封面/头像/详情图 magic bytes；加密图走图片代理，不影响视频播放。
- 性能：列表页不逐条请求详情；慢路径只放到详情或用户点击后。
- 角标：`vod_remarks` 只验证文本是否返回，不承诺 UI 位置。

### 故障定位补充

| 问题 | 处理 |
|---|---|
| Nuxt 数据为空 | 检查 `__NUXT_DATA__`/payload 是否为索引数组，先还原再 `_walk` 字段 |
| 播放页有页面但无 `video_url` | 检查 `episode_id` 是否丢失，对比裸 ID 和带 episode_id 入口 |
| folder 二级不能翻页 | `vod_tag:'folder'` 必须在 `categoryContent` 处理 `pg`，实测分页格式 |
| 演员/专题列表加载慢 | 检查是否逐条请求详情页补封面，默认取消逐条请求 |
| 图片 URL 有值但不显示 | 检查 0 字节、Content-Type、magic bytes，必要时 localProxy 解密 |
| 图片代理误用于视频 | m3u8/mp4 禁止走图片代理，playerContent 直接返回播放 URL |
| 角标位置不对 | `vod_remarks` 只控制文本，位置由客户端 UI 决定 |