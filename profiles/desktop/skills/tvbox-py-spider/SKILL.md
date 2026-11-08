---
name: tvbox-py-spider
description: TVBox/hipy/影视仓 Python 爬虫源（type 3/T4 Spider）一站式开发技能，覆盖影视、短剧、小说、漫画、图片、音乐、直播全类型，从普通 MacCMS、采集 API、SPA 加密站到 AES/CF/签名高反爬站（遮天法框架）。用户要写 py 源、把网站写成 Spider、新增或排查 py 源接口与播放解析时使用。不用于 JS 源和 jar 源。
---

# TVBox py 源一站式开发

本技能是仓库内所有 py 写源方法论的唯一总入口（已合并 spider-create v3.0、py-spider-v84、zhetian-spider）。产物是可被 hipy/影视仓/各 FongMi 兼容壳加载的一个 `xxx.py`。

**铁律**：禁止不分析直接套模板；禁止把未实测源称为完成；真直链必须内容验证（`#EXTM3U`/媒体魔数），播放页不得冒充直链。

## 1. 落盘约定（硬规则）

- 新写的 py 源统一放 **`webhome/Python/中文名.py`**（独立存档区，不被 haitun/config.json 引用）。该目录无 `base/` 包，try/except 的 requests 兜底基类必须生效，源文件脱离 haitun 也能独立实例化。
- **默认不注册任何配置**。仅当用户明确要挂海豚壳时，再复制到 `haitun/ext/中文名.py` 并注册 `haitun/config.json`、`haitun/ht.json` 两处 sites。
- 参考同类源先在 `haitun/ext/`（约 200 个）、`xiaosa/PY/`、`webhome/Python/` 找同族/同 CMS 仿写。

## 2. 统一契约

- 文件头 `# -*- coding: utf-8 -*-`；`sys.path.append('..')`；优先 `from base.spider import Spider`，try/except 给 requests 兜底基类（范例 `haitun/ext/茶杯狐.py`）。类名必须 `Spider`。
- T4 六接口（全部要实现，非羊壳壳也要提供 homeVideoContent 兼容返回）：

| 方法 | 返回 |
|---|---|
| `init(extend="")` | "" |
| `getName()` | 站点名字符串（不能 return self.name，壳可能先调 getName 再 init） |
| `homeContent(filter)` | `{"class":[{"type_id","type_name","subs":[]}],"filters":{},"list":[]}` |
| `homeVideoContent()` | `{"list":[vod,...]}` |
| `categoryContent(tid,pg,filter,extend)` | `{"list","page","pagecount","limit","total"}`（tid 子分类用 `:` 拼） |
| `detailContent(ids)` | ids 是 list 取 `ids[0]`；`{"list":[{...,"vod_play_from","vod_play_url"}]}` |
| `searchContent(key,quick,pg="1")` | `{"list":[vod,...]}` |
| `playerContent(flag,id,vipFlags=None)` | `{"parse":0/1/2,"playUrl":"","url":...,"header":{}}` |
| `localProxy(param)` | 无代理返回 None |

- vod 最小字段 `vod_id/vod_name/vod_pic/vod_remarks`，可加 `vod_year/vod_area/vod_actor/vod_director/vod_class/vod_content`。无筛选时 filters 显式返回 `{}`。
- **filters 格式（hipy/影视仓扩展格式，必须严格遵守）**：外层 key 是分类 `type_id`，value 是维度数组；每个维度是 `{"key":"维度key","name":"中文显示名","value":[{"n":"选项名","v":"选项值"}]}`。**不要**写成 `{维度key: [选项]}` 的 TVBox 标准格式——壳端按 tid 匹配，key 不对应就不显示筛选栏。`categoryContent` 的 `extend` 参数是 dict，键是维度 key，值是选中的 `v`。
- 线路：`vod_play_from` 与 `vod_play_url` 用 `$$$` 连接且段数一一对应；线路内剧集 `#` 分隔；剧集格式 `名称$播放ID`。
- `parse`：实测直链 m3u8/mp4 → 0；MacCMS 播放页（/vodplay/、/play/、.html）→ **1 优先，不要自己解密**（在线之家/a123tv 教训）；必须 webview 执行 JS → 2。完整决策树与加密处理顺序见 `references/play-decode.md`。
- `vod_remarks` 角标：**不要取接口的 `status`**（它是上架状态"1"，会导致所有卡片显示"1"）。先抓官网卡片 HTML 核对真实渲染（集数/年份/评分/HD/VIP）；列表确无集数时用"年份 · 评分"（"7.00"→"7.0分"），详情页用 links 数给"共N集"、单片给 HD。
- 禁止：精确 class XPath（`@class='...'`）、99/999 伪分页、example 占位域名、`__main__` 测试块、空壳接口、列表页逐条请求详情补字段。

## 3. 标准流程

```
需求归一化（内容类型/目标壳 T4还是客户端）
→ 按第 4 节矩阵命中模块，一次性读入 references（不要边写边补读）
→ 勘察站点、建立画像（schemas/site_profile.json）
→ 选择器/播放策略有疑点才调试
→ 生成 Spider（同 CMS 直接基于 assets/templates 改）
→ scripts/static_check.py 静态检查
→ 六接口实测（含 homeVideoContent）+ 直链内容验证
→ 失败针对性修复重测
→ 落盘 webhome/Python/，输出验证报告（未验证项明确标注）
```

决策优先级：用户指定 > 站点实测 > API/HTML 字段 > URL 特征 > 模板默认值。未指定模式默认 T4；MacCMS 路由默认 video；"动漫"按播放列表还是章节图片判定影视/漫画。

## 4. MCP 工具协议（mcp_PY_MCP_S，可用时优先）

| 阶段 | 工具 |
|---|---|
| 首次分析/结构不明 | `analyze_website`（也可用浏览器/curl 等价完成，工具不可用不许跳过分析） |
| 选择器匹配问题 | `debug_selector` |
| 接口回归 | `test_interface` |
| 规范检查 | `evaluate_source`（小改动先跑 static_check.py） |
| 播放为空/iframe/token | `debug_play_link`（直链已确认就别重复调） |
| 一键出源 | `one_click_spider`（CF 站先带 html+cookie） |

MCP 服务器源码在同级技能目录 `../py-spider-pro-mcp/py-spider-pro/`（WorkBuddy 项目技能，含 lib/dist/tests 与注册方法，见该技能 SKILL.md），电脑端安装见 `references/MCP电脑端使用指南.txt`。工具名以当前会话实际暴露的为准；不要把逻辑别名当真实工具调用。

## 5. 需求识别与模块加载矩阵

所有任务先读 `references/gates.md`（真直链门禁）。按特征取模块并集，命中即读：

| 站点/需求特征 | 必读模块 |
|---|---|
| MacCMS v8（/frim/index、search.php?searchtype=5、POST 搜索、var now） | `references/maccms.md` + `references/play-decode.md` |
| MacCMS v10（/index.php/vod/show、/vodshow/、player_data） | `references/maccms.md`（**先验证 /api.php/provide/vod/ 可用性**） |
| /api.php/provide/vod 采集 API、ac=list/detail、suggest 搜索、主分类 t=0 | `references/api_spa.md` + `references/strategies/applecms_api.md` |
| SPA 空容器、token、enc:true、VITE_BASE_URL、parameterKey/Iv | `references/api_spa.md` + `strategies/encrypted_api.md`、`encrypted_iframe.md` |
| `__NUXT_DATA__`/devalue/payload、Next.js/Vite chunk、episode_id、cursor 翻页 | `strategies/nuxt_devalue_api.md`（+加密追加 encrypted_api） |
| AES/XOR/RSA/atob/player_aaaa/player/api.php/customStrDecode | `references/maccms.md` + `strategies/encrypted_iframe.md`（sid/from/show 四层映射） |
| 整包 AES octet-stream 加密 API（如 fktv.me） | 范例 `webhome/Python/凡客TV.py`；AES 依赖 pycryptodome→cryptography 双保险 |
| HMAC 签名 JSON API、多域名探活、resolve ticket | 范例 `haitun/ext/看剧AI19.py` + `references/kanju-ai-protocol.md` |
| HLS AES-128、主清单能开不能播、#EXT-X-KEY、ts/key CDN、签名过期 | `strategies/hls_localproxy.md` + `strategies/proxy_network.md` |
| 发布页/永久地址/zz_line、Base64+words.random 随机子域、raw deflate | `strategies/domain_release.md` + `strategies/resilience.md` |
| 域名频繁换、限流、被墙、系统 VPN 不继承、shell 端无数据 | `strategies/proxy_network.md`（禁写死私人代理） |
| 图片有 URL 不显示、binary/octet-stream、AES/XOR 加密图、CDN 超时 | `strategies/proxy_network.md` + `encrypted_iframe.md`（图片代理只处理图片） |
| Cloudflare/WAF/验证码、HTML 403 但 /api/ 返回 JSON | `strategies/proxy_network.md` + `references/api_spa.md`（API 优先 HTML 兜底） |
| folder/vod_tag、演员/标签/专题二级、虚拟分类、三级页面 | `strategies/folder_routing.md`（categoryContent 分页，detailContent 仅兜底） |
| play_data/pako/inflateRaw、Base64 压缩 JSON | `strategies/compressed_payload.md` |
| eval(function(p,a,c,k,e,d)) Packer、split('|') 字典 | `strategies/js_unpack.md` |
| 404XAV（web_api_types、/detail/{cid}/{hash}.html） | `strategies/404xav.md` |
| 羊壳/海阔没数据、XBPQ/JSON 转 py、filters 异常、homeVideoContent 缺失 | `strategies/yk_runtime.md` |
| 小说（笔趣阁/章节/正文） | `references/nonvideo.md`（text://） |
| 漫画/章节图片 | `references/nonvideo.md`（playUrl type=manga，pics://） |
| 图片/写真/壁纸/图集 | `references/nonvideo.md`（验图片魔数，pics://） |
| 音乐/歌单/榜单、上下文队列定位 | `references/nonvideo.md` + `strategies/queues.md` |
| 直播 m3u8/flv 频道 | `references/nonvideo.md`（真 stream，详情页不算播放地址） |
| 短剧/竖屏/滑动流、点击项首位 | `references/nonvideo.md` + `strategies/queues.md` |
| 管理型源/运行时反射注入站点、临时加载、App 主动重载、perm↔temp 转换、站点"出现后消失" | `references/cases/smart-load-temp-inject-lifecycle.md`（重建销毁实例/destroy 禁忌/两阶段看门/home 自记/PID 持久化） |
| 文件浏览型源/扫描目录设成任意目录扫不到、空分类目录残留、浏览卡片重复、点进卡片空白 | `references/cases/smart-load-scan-root-browser.md`（子目录含文件才采用否则回退根/物理路径去重/嵌套根取最长匹配） |
| 高反爬综合站（CF 5秒盾+AES/XOR+m3u8 广告分片+防盗链+TLS 指纹+签名/Protobuf） | 转第 8 节遮天法框架 |

模块冲突优先级：站点实测 > 本 SKILL.md > 专项策略 > 类型模板 > 历史归档。`references/cases/archive/zip_refs/` 是只读历史案例库（51hub/missav/拼多多/苹果CMS 等 52 篇，随技能一并购入），溯源可读，不直接当规则执行。

## 6. 站点勘察要点

- **HTML 站**：curl 首页含列表/分页链接即 HTML，BS4 优先 lxml。苹果cms stui 系：列表 `a.stui-vodlist__thumb`（href 当 id、data-original 懒加载图、span.pic-text 集数）；详情 `p.data` 按 主演：/导演：/类型：/年代：/地区：/状态： 切分；线路 `.stui-pannel__head h3` 配 `.stui-content__playlist li a`；播放页优先 `var player_xxx={...}`（去尾逗号再 json.loads）。
- **SPA/API 站**：首页只有 root + /assets/*.js。PowerShell 分析长 JS：`$c=Get-Content -Raw f.js; [regex]::Matches($c,'pattern')`。提 API 路径、签名头、密钥、版本号；先无签名裸请求，401 再逆向；HMAC 消息多为 `METHOD\npath(含query)\n毫秒戳\nnonce`。
- **整包加密 API**：请求 `application/octet-stream`，body = AES(ECB/PKCS7, key=前端写死 16 字节 apiKey)(JSON 信封) 后 base64；信封固定 `{deviceId,token,domain,referer,user_agent,shareCode,channel,ip,data:{...}}`；响应可能直接是密文 base64，先解密再 json.loads；自定义头（version/deviceType/time）缺失会报封装错误，要连 headers 一起抓。
- **Next.js App Router**：加 `RSC: 1`、`Accept: text/x-component` 取 RSC 流正则提 item；但 RSC 只有首屏、不分页，翻页找真接口。
- 搜索接口区分分页列表与智能联想：后者字段名常是复数（keywords）、返回裸 list；字段名猜错会静默返回全量，必须用结果是否含关键词验证。
- 懒加载属性强制优先级：图片 data-original > data-src > data-lazyload > src；播放 data-src > data-url > data-play > href。

## 7. 播放解析策略（按优先级）

1. 接口直给 m3u8/mp4 → parse 0（验内容）。
2. 播放页内嵌 player JSON/url → 正则提取。
3. MacCMS 播放页/加密播放 → parse 1 交客户端嗅探（先简后繁）。
4. `resolve://` ticket → POST 兑换；先测是否要登录，401 就放弃该线路走免费直连，不卡主链路。
5. **每集地址不可预测时懒加载**（凡客TV 模式）：剧集编码 `集名$movie_id|link_id`，playerContent 被调时才按 link_id 请求该集详情取地址；绝不在 detailContent 循环上百集。URL 优先级：线路 m3u8 代理地址 → playback_v2 签名地址 → source 直链。
6. 线路选择：flag 精确匹配 provider_name → resolved=true 直连 → 兜底；异常跳下一条，全失败返回空 url+parse 1。
7. HLS 分片/key、广告分片清洗、localProxy 重写走 `strategies/hls_localproxy.md`；localProxy 返回 `[状态码,MIME,bytes,headers]`。

## 8. 高反爬站 → 遮天法框架

普通 MacCMS/API 站不要动用框架。出现 CF 5 秒盾、AES/XOR 响应加密、m3u8 广告分片、防盗链、TLS 指纹、Protobuf/签名等**框架级破甲**需求时：

1. 读 `references/zhetian/遮天法_技能地图.md` → 主文档 `遮天法v3.0+_AI对话生成指南.md`
2. 基于 `遮天法v3.0+_战斗技能书.py`（v3.1，83KB 可运行）改 DEFAULT_CONFIG 与适配层，不从零写
3. 纯 Python 零依赖破甲能力（自带 S-box 的 AES、PKCS7、AutoDecryptChain、curl_cffi 指纹、m3u8 重写、图片 XOR）见 `遮天破甲模块_技能包.md`
4. 铁律：防御等级以 RealmAutoRouter 实测特征为准；配置驱动禁硬编码；全 try-except 分级兜底禁静默 pass；缺依赖优雅降级；六接口自验。

## 9. 参考文件地图

```
assets/py_source_template.py     通用 hipy 源骨架
assets/templates/                maccms_v8.py / maccms_v10.py / api.py 可运行模板
schemas/site_profile.json        站点画像 Schema（实例另存，勿覆盖 Schema）
schemas/spider_ir.json           Spider 实现中间表示 Schema
scripts/static_check.py          静态检查：python scripts/static_check.py <源文件> [--final]
references/gates.md              真直链响应门禁（所有任务先读）
references/maccms.md             苹果CMS v8/v10 HTML 模板（28KB）
references/api_spa.md            API/SPA/加密接口模板（20KB）
references/nonvideo.md           小说/漫画/图片/音乐/直播/短剧模板
references/play-decode.md        parse 决策、CMS 识别、加密片段、懒加载、CF、排障表
references/kanju-ai-protocol.md  HMAC 签名站协议
references/multi-shell-spider-contract.md  跨 FongMi 壳加载契约 v2.1
references/strategies/*.md       15 个专项策略（见第 5 节矩阵）
references/cases/                getav/missav/nkdvd 实测案例 + smart-load 运行时注入生命周期 + smart-load 扫描根/文件浏览器
references/zhetian/              遮天法高反爬框架（v3.1 代码+破甲模块+v2.0 归档）
references/MCP电脑端使用指南.txt  MCP 服务器安装
```

## 10. 验证清单与完成标准

本机用 `C:\Windows\System32\curl.exe`（PowerShell 的 curl 是别名）+ PowerShell 等价验证；AES/HMAC 用 .NET（`System.Security.Cryptography.Aes`/`HMACSHA256`）。

- [ ] 静态检查通过（static_check.py）。
- [ ] 首页/分类/搜索/详情/播放各类接口各实测一次，200 且字段与代码一致。
- [ ] 100+ 集长剧验证剧集是否一次全返、要不要翻页。
- [ ] 直链 GET 前几字节是 `#EXTM3U` 或媒体魔数；ticket 线验证鉴权。
- [ ] webhome/Python 下用 importlib 动态加载跑 home/search/detail/player，无 ImportError（脚本见 play-decode.md 第 7 节）。
- [ ] 挂海豚壳时 config.json/ht.json 双注册且 `ConvertFrom-Json` 通过。
- [ ] 网络请求全 try/except；空结果返回空 list；多域名探活转移。
- [ ] PowerShell 用 `;` 不用 `&&`；profile 报错是噪音；curl.exe 不支持 --http2 时的 301 结论标"未复现"。

六接口+端到端全过才可写完成；缺工具/遇登录验证码 WAF/签名不明时输出阻塞报告，报告含源文件、类型、CMS、各接口状态、修复轮数、剩余风险。

## 11. tvbox 源仓库实战范例

> 以下路径均相对 **tvbox 源仓库**（`D:\交投资料\相关文档\07-Git文件\Cnb\tvbox\`），是技能提炼时的实战参照；本技能安装在 WebHTV 仓库 `.workbuddy/skills/` 下使用，两类仓库路径不要混用。

- `webhome/Python/凡客TV.py` — AES-ECB 整包加密 API、加密自定义头、双 AES 库保险、列表/智能联想双搜索、按集懒加载播放、角标修复、CDN 补图（2026-09）。
- `haitun/ext/看剧AI19.py` — HMAC-SHA256 签名、多域名探活、多线路 resolve、subs。
- `haitun/ext/星辰影院.py` — 苹果cms HTML 解析、播放页正则。
- `haitun/ext/茶杯狐.py` — Session/线程锁、AES 可选依赖降级。
- `xiaosa/PY/火车影视.py` — APP 接口 AES/RSA。

## 附：来源与移植说明

- 本技能由 tvbox 仓库 `.trae/skills/tvbox-py-spider/` 原样移植（该版本已合并 spider-create v3.0、py-spider-v84、zhetian-spider 三套方法论），技术内容未改动。
- 移植时仅修正了指向旧目录的引用：MCP 服务器源码改指同级技能 `../py-spider-pro-mcp/`；历史案例库 `写源技能书/py写源技能/archive/cases/zip_refs/`（52 篇）已随技能并入 `references/cases/archive/zip_refs/`。
- 技能中出现的 `webhome/Python/`、`haitun/ext/`、`xiaosa/PY/` 等落盘与范例路径是 tvbox 源仓库的约定（见第 1、11 节），在 WebHTV 仓库中写源时按同等结构自建目录即可。
- 旧版单文件技能（`写源技能书/archive/`、`py写源技能/`、`html技能书/`、`遮天法v3.0/` 独立副本）保留在 tvbox 源仓库归档，未重复安装；需要时回源仓库查阅。
