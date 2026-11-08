---
name: py写源技能
description: 多模块 v8.3。跨 Agent 全类型 Spider 自动开发技能；新增 MacCMS 线路四层模型、真直链门禁、XOR双字母表sign解密，以及羊壳、Nuxt/API、HLS、苹果CMS等模块调度。
---

# py写源技能 v8.3 多模块版

## 1. 目标

输入站点 URL 和可选需求，自动完成需求归一化、站点分析、站点画像、策略选择、代码生成、静态检查、五接口测试、播放/阅读/图片/队列端到端验证、自动修复和最终交付。

禁止未分析直接套模板。禁止把未测试源称为完成。

## 2. Operit 工具调用协议

本模块版面向 Operit。优先使用当前会话中实际可用的工具和已激活的包，不假设每个任务都存在或需要全部 py_mcp 工具。工具调用以解决当前阶段问题为准，避免无收益的重复抓取、重复调试和重复测试。

工具优先级：

1. 站点首次分析或结构不明确：优先 `py_mcp:analyze_website`；若当前未提供该工具，使用 `visit_web`、浏览器或 `extended_http_tools` 获取页面/API，再分析。
2. 选择器有实际匹配问题：调用 `py_mcp:debug_selector`；如果选择器已有真实证据且数据正常，不重复调用。
3. 代码生成后需要接口回归：调用 `py_mcp:test_interface`；若无法调用，使用目标框架本地测试或 `super_admin` 终端（Ubuntu heredoc）。
4. 代码规范和字段检查：调用 `py_mcp:evaluate_source`；小改动可先用静态检查，存在跨接口风险时再评估。
5. 播放链接为空、仍是播放页、iframe/API/token 未解析：调用 `py_mcp:debug_play_link`；直链已确认可用时不调用。
6. 文件操作：使用 Operit 文件工具；代码执行优先用 `super_admin` 终端（Python heredoc，可装依赖、可访问被改文件）；网页读取使用 `visit_web`/浏览器/HTTP 工具。工具名以当前会话实际暴露的名称为准。

禁止行为：

- 不把逻辑别名当成真实工具名调用。
- 不因 Skill 写了某工具就盲目调用不存在的工具。
- 不在页面/API已确认正常时重复 analyze、debug 或 fetch。
- 不因某个专用工具不可用而跳过分析；必须按上述降级路径继续。
- **非必要不使用 `code_runner`**。该工具参数必须是严格 JSON 对象（`{script:...}` 多行长代码一碰就坏），且跑在无 `base.spider`/无 pycryptodome 的隔离 Python 环境，测源十测九败。它不参与：源文件增删改、编译校验、运行环境依赖、真实弹幕/接口联调。执行任意脚本一律改用 `super_admin` 终端（`python3 - <<'PY'`）或 `py_mcp` 文件工具；仅用户点名要求时才可考虑 code_runner。

## 3. 唯一执行流程

```text
需求归一化
→ 判断并加载匹配模块
→ 选择合适的分析工具（专用分析优先，普通工具可替代）
→ 建立站点画像
→ 仅在选择器/播放策略有疑点时调试
→ 生成 Spider
→ 静态检查
→ 按风险选择接口回归工具
→ 端到端播放/阅读/图片/队列验证
→ 失败时针对性 debug_selector/debug_play_link
→ 按需 evaluate_source
→ 交付
```

模块加载是强制的，工具调用不是机械强制的。首次写源必须完成有效站点分析；可以使用 `py_mcp:analyze_website`，也可以使用 Operit 的网页/HTTP/代码工具完成等价分析。选择器、路由和播放策略必须以后者的真实结果为准。

## 4. 决策优先级

用户明确指定 > 当前站点实测 > API/HTML字段 > URL特征 > 模板默认值。未指定模式默认 T4；未指定内容类型按真实行为判断；MacCMS 路由优先归 video；“动漫”按播放列表或章节图片判断。

## 5. 统一契约

T4 必须继承 `from base.spider import Spider`，有 `init` 和 `getName`；客户端使用独立 `class Spider`。所有源必须实现 `homeContent`、`categoryContent`、`detailContent`、`searchContent`、`playerContent`。

分类至少返回 `page`、`pagecount`、`limit`、`total`、`list`；详情返回 `{"list":[vod]}`。核心字段为 `vod_id`、`vod_name`、`vod_pic`、`vod_play_from`、`vod_play_url`。线路用 `$$$`，线路内剧集用 `#`，剧集格式为 `名称$播放ID`。统一使用 `self.headers`。

## 6. 冲突修正规则

模块中的历史示例保留知识价值，但最终代码禁止：精确 class XPath、99/999 伪分页、示例域名、`__main__` 测试块、空壳接口、重复请求、未经解析的播放页冒充直链。历史选择器、token、密钥和播放地址必须重新验证。
## 7. 需求识别与模块加载矩阵

先根据用户话术和站点特征确定需求，再加载模块。用户明确需求优先；站点分析发现的特征可追加模块。

### v8.1 追加经验：Nuxt/SSR 短剧站与 folder 分页

- 页面含 `__NUXT_DATA__`、`window.__NUXT__`、`_payload.js`、Nuxt 路由 chunk，且普通 HTML 选择器为空时，不按 XPath 模板硬写；必须还原 Nuxt 索引数组或读取 payload JSON，再递归扫描真实字段。
- 动态域名可能是“入口发布页 → 中转页 → `Base64.decode/atob` 解出 `words.random()+后缀` → 随机前缀域名”的组合链路；必须把发布页跳转、中转页解码、随机子域生成和 Nuxt/API 数据解析分开验证。
- Nuxt 影视/短剧站的列表项如果含 `episode_id`，必须把它保留进 `vod_id` 或播放 ID，例如 `drama-play?id={video_id}&episode_id={episode_id}`；丢失 `episode_id` 可能导致播放页没有 `video_url`。
- 原站裸 ID 播放入口坏不代表资源不可播；必须对比裸入口 `drama-play?id=xxx` 与列表入口 `drama-play?id=xxx&episode_id=yyy`。若后者能返回 `video_url`，源应以列表 episode 入口为准。
- 返回 `vod_tag:"folder"` 的项目不是详情页，而是可分页目录；必须在 `categoryContent(folder_id, pg, ...)` 里实现二级目录和翻页，`detailContent()` 只能做兼容兜底。
- folder 二级分页 URL 必须实测，可能是 `/page/2/`、`?page=2`、`/p/2` 或接口参数；不能固定 `pagecount=1`。
- 图片字段非空不代表可显示；要验证魔数、0 字节、`binary/octet-stream`、加密二进制。若需要本地代理解密，图片代理只处理图片，不能误用于 m3u8/mp4 播放 URL。
- 列表页禁止默认逐条请求详情页补封面/备注。除非用户明确要求“完整优先”，否则列表只用当前页数据；二级/详情请求只在用户点击后发生。
- `vod_remarks` 只能提供角标文本；角标左上/左下由客户端 UI 决定，Spider 不保证位置。


| 用户需求 / 站点特征 | 内容类型 / 场景 | 必载模块 | 验证重点 |
|---|---|---|---|
| 写影视源、电影、电视剧、综艺、动漫播放、MacCMS 路径 | video / HTML影视 | `templates/maccms.md`、`validators/gates.md` | 分类、详情线路、playerContent 最终 m3u8/mp4 |
| `/frim/index`、`/search.php?searchtype=5` | MacCMS v8 | `templates/maccms.md`、`validators/gates.md` | v8 分类、POST 搜索、`var now` 播放 |
| `/index.php/vod/show`、`/index.php/vod/detail` | MacCMS v10 | `templates/maccms.md`、`validators/gates.md` | v10 分类、GET 搜索、`player_data` |
| `/api.php/provide/vod`、JSON 接口、采集站、苹果CMS API、ac=list/detail、主分类 t=0 条、suggest 搜索 | API影视/苹果CMS API | `templates/api_spa.md`、`strategies/applecms_api.md`、`validators/gates.md` | JSON 字段、子分类合并、批量补图、suggest 搜索、播放字段直出 |
| 首页只有 app 容器、接口加载、token、enc:true、VITE_BASE_URL、parameterKey/parameterIv、hash:true | SPA/API/加密API | `templates/api_spa.md`、`strategies/nuxt_devalue_api.md`、`strategies/encrypted_api.md`、`strategies/encrypted_iframe.md`、`validators/gates.md` | API base、鉴权、参数加密、响应解密、接口字段、模块链路 |
| `__NUXT_DATA__`、Nuxt SSR、payload、动态 chunk、Next.js/Vite SPA、短剧 API、列表有 `episode_id`、cursor/offset 翻页 | Nuxt/SSR/API 短剧 | `templates/api_spa.md`、`strategies/nuxt_devalue_api.md`、`strategies/encrypted_iframe.md`、`strategies/resilience.md`、`validators/gates.md` | Nuxt/devalue 还原、API base 挖掘、episode_id 保留、cursor 翻页、参数有效性对比 |
| 小说、书、章节、笔趣阁、正文 | novel | `templates/nonvideo.md`、`validators/gates.md` | `vod_player=novel`、`novel://` 正文 |
| 漫画、章节图片、manga | manga | `templates/nonvideo.md`、`validators/gates.md` | `vod_player=pics`、`pics://` 图片顺序 |
| 图片、写真、壁纸、图集 | image | `templates/nonvideo.md`、`strategies/resilience.md`、`validators/gates.md` | 懒加载、图片魔数、`pics://` |
| 音乐、歌曲、歌手、歌单、榜单 | music | `templates/nonvideo.md`、`strategies/queues.md`、`validators/gates.md` | 上下文队列、当前项定位、顺序稳定 |
| 直播、频道、stream、m3u8/flv 频道 | live | `templates/nonvideo.md`、`validators/gates.md` | 真实 stream，不把详情页当播放地址 |
| 短剧、微短剧、竖屏、滑动流 | short | `templates/nonvideo.md`、`templates/maccms.md`、`strategies/queues.md`、`validators/gates.md` | 分集、竖屏播放、点击项首位 |
| AES、CryptoJS、XOR、RSA、atob、Base64、Hex、iframe、`player_aaaa`、`player/api.php`、`customStrDecode/deString` | 加密/播放器 | `templates/maccms.md`、`strategies/encrypted_iframe.md`、`validators/gates.md` | sid/from/show 四层映射、解密样本、iframe/API 递归、最终真 m3u8 |
| 发布页、永久地址、最新地址、zz_line/zz_backup_line、Base64.decode/atob、words.random、随机子域、域名跳转、频繁更换、限流、图片扩展名异常、JS 时长 | 动态域名/韧性/特殊HTML | `strategies/resilience.md`、`validators/gates.md` | 发布页解析、域名池、探活切换、限流、图片魔数、时长转换 |
| 手机浏览器可访问但 shell 端没数据、被墙域名、系统 VPN 不生效、`Network is unreachable`、代理端口、`extend.proxy`、环境变量代理 | Shell 端代理/网络 | `strategies/proxy_network.md`、`validators/gates.md` | session 代理探测、所有请求显式 proxies、禁止写死私人代理 |
| `localProxy`/`proxyPic`、图片 CDN 超时、图片有 URL 但壳端不显示、CDN 返回 binary/octet-stream、MissAV/MissAVt/91hub 图片加密 | 图片代理/加密图片 | `strategies/proxy_network.md`、`strategies/encrypted_iframe.md`、`validators/gates.md` | 图片代理走代理、AES key/iv 长度、JPEG EOI 截断、magic bytes、真实 MIME |
| Cloudflare/WAF/验证码、Next.js、`/_next/`、`__NEXT_DATA__`、HTML 403 但 `/api/` 返回 JSON、getav 类站点 | WAF/API 优先 | `strategies/proxy_network.md`、`templates/api_spa.md`、`validators/gates.md` | 移动 UA、Referer/cookie 实测、API 字段优先、HTML fallback |
| 羊壳里没数据、只有推荐页、分类空白、推荐页空、XBPQ/JSON 转 py、filters 类型异常、homeVideoContent 缺失 | 羊壳/海阔运行时兼容 | `strategies/yk_runtime.md`、`validators/gates.md` | 继承基类、homeVideoContent、class 字段、filters dict、标准签名、翻页字段 |
| m3u8 主清单能开但不能播、HLS AES-128、#EXT-X-KEY、ts/key CDN、签名过期、data-preview/data-play-src 直链 | HLS/localProxy 播放代理 | `strategies/hls_localproxy.md`、`strategies/proxy_network.md`、`validators/gates.md` | 主/子清单/ts/key 逐级验证、固定 IV、m3u8 重写、实时解析、防推荐位错链 |
| 发布页 key+data、appConfig、Base64/atob、words.random、加载中 href、raw deflate、解出域名不是目标站 | 发布页/动态域名解密 | `strategies/domain_release.md`、`strategies/resilience.md`、`validators/gates.md` | 解密方案 A/B、href 直提、raw deflate、目标站结构验证、候选域名探活 |
| 二级/三级页面、演员/标签/专题 folder、vod_tag、虚拟分类、folder + filters、JSON 分类结构迁移 | Folder 路由 | `strategies/folder_routing.md`、`validators/gates.md` | vod_tag=folder、categoryContent 分发、folder 翻页、filters 注册、id 前缀不冲突 |
| Vite/SPA 加密 API、AES 参数、响应密文、guest/anonymous token、成人确认、locked 付费集、X-Zone | 加密API/游客身份 | `strategies/encrypted_api.md`、`templates/api_spa.md`、`validators/gates.md` | API 域名探活、URL 编码、请求头大小写、guest-confirm-playback、locked 跳过 |
| 像抖音一样随机上下滑、点击哪条第一条就是哪条 | 随机短视频 | `strategies/queues.md`、`templates/api_spa.md`、`validators/gates.md` | 第一项固定、后续随机、避免续播缓存 |
| 不确定类型、混合站、多模块站 | 综合分析 | 先 `validators/gates.md`，再按画像追加模块 | 每个模块至少一条完整链路 |
| 原文细节缺失、历史案例对照 | 回溯 | `archive/legacy-v5.md` | 只参考，必须重新实测 |

## 8. 模块激活协议

模块不是可有可无的参考链接，而是本轮写源的工作上下文。主 Skill 完成需求识别后，必须把所有命中的模块一次性读入当前上下文，再开始编码；不要只读主 Skill，也不要命中一个模块后才逐个补读。

激活规则：

1. 所有任务先加载 `validators/gates.md`。
2. 根据第 7 节需求矩阵取模块集合，多个条件命中时取并集。
3. 只要出现 shell 端访问异常、被墙、系统 VPN 不继承、Cloudflare/WAF、Next.js/API 优先、图片代理或 CDN 图片不显示，必须把 `strategies/proxy_network.md` 加入模块集合；若同时涉及 AES/二进制图片，再追加 `strategies/encrypted_iframe.md`。
4. 只要出现羊壳没数据、推荐页空、分类空白、XBPQ/JSON 转 py、filters 类型异常，必须加入 `strategies/yk_runtime.md`。
5. 只要出现 Nuxt/devalue/Next/Vite/chunk/config.js/API base/cursor/episode_id，必须加入 `strategies/nuxt_devalue_api.md`；若 API 参数或响应加密，再追加 `strategies/encrypted_api.md`。
6. 只要出现 HLS AES-128、ts/key、m3u8 主清单能开但不能播、data-preview/data-play-src、签名过期，必须加入 `strategies/hls_localproxy.md`。
7. 只要出现苹果CMS采集 API 主分类为空、批量补图、suggest 搜索或验证码搜索，必须加入 `strategies/applecms_api.md`。
8. 只要出现发布页 key+data、Base64/atob、words.random、加载中 href、raw deflate 或域名被占用，必须加入 `strategies/domain_release.md`。
9. 只要出现 folder、演员/标签二级、虚拟分类、folder+filters 或三级页面，必须加入 `strategies/folder_routing.md`。
10. 模块读取可并行进行；不命中的模块不加载，避免无关内容干扰。
11. 读取后先执行模块中的“适用条件/关键约束”，再使用代码模板；模板只是实现素材，不能覆盖主 Skill 的统一契约。
12. 模块之间冲突时，优先级为：当前站点实测 > 主 `SKILL.md` > 专项策略模块 > 类型模板 > 历史归档。
13. 模块缺失或读取失败时，必须报告缺失模块并使用 `archive/legacy-v5.md` 或当前已读内容降级，不得假装模块已激活。
14. 模块激活完成后再选择工具；模块读取本身不需要调用 py_mcp。
15. 只要出现 `player_aaaa`、`player/api.php`、`playerconfig.js`、线路名错位、`parse:0` 仍返回播放页或 XOR 后出现伪协议，必须同时加载 `templates/maccms.md`、`strategies/encrypted_iframe.md`、`validators/gates.md`，并按 sid/from/show/media 四层验证。

典型组合：

- 普通 MacCMS v8/v10：`validators/gates.md` + `templates/maccms.md`。
- API/SPA 加密站：`validators/gates.md` + `templates/api_spa.md` + `strategies/nuxt_devalue_api.md` + `strategies/encrypted_api.md` + `strategies/encrypted_iframe.md`。
- Nuxt/SSR 短剧站：`validators/gates.md` + `templates/api_spa.md` + `strategies/nuxt_devalue_api.md` + `strategies/encrypted_iframe.md`；若有发布页/随机域名/图片异常，追加 `strategies/domain_release.md`、`strategies/resilience.md`、`strategies/proxy_network.md`。
- 动态域名影视站：在基础组合上追加 `strategies/resilience.md`；若发布页或目标域可能被墙，再追加 `strategies/proxy_network.md`。
- Shell 端没数据/被墙/系统 VPN 不继承：`validators/gates.md` + `strategies/proxy_network.md`，再按站点类型追加模板。
- Cloudflare/Next.js/API 优先站：`validators/gates.md` + `strategies/proxy_network.md` + `templates/api_spa.md`。
- MissAV 系 AES 图片/CDN 图片不显示：`validators/gates.md` + `strategies/proxy_network.md` + `strategies/encrypted_iframe.md`，必要时追加 `strategies/resilience.md`。
- 羊壳/海阔运行时没数据：`validators/gates.md` + `strategies/yk_runtime.md`，再按站点类型追加模板。
- Nuxt/Next/Vite 短剧/API站：`validators/gates.md` + `templates/api_spa.md` + `strategies/nuxt_devalue_api.md`；参数/响应加密追加 `strategies/encrypted_api.md`。
- HLS AES-128 或 m3u8 分片/key 问题：`validators/gates.md` + `strategies/hls_localproxy.md` + `strategies/proxy_network.md`。
- 苹果CMS采集 API 源：`validators/gates.md` + `templates/api_spa.md` + `strategies/applecms_api.md`。
- 发布页/动态域名解密：`validators/gates.md` + `strategies/domain_release.md` + `strategies/resilience.md`，被墙时追加 `strategies/proxy_network.md`。
- 二级/三级 folder 路由：`validators/gates.md` + `strategies/folder_routing.md`。
- 音乐上下文队列：`validators/gates.md` + `templates/nonvideo.md` + `strategies/queues.md`。
- 混合站：先加载 `validators/gates.md`，再按画像和用户需求取所有相关模块。

## 9. 完成标准

只有静态检查、五接口测试和对应类型端到端链路全部通过，才可写完成。缺少网络或执行工具时必须写未验证。遇到登录、验证码、WAF、签名不明、解密参数缺失或站点持续不稳定时输出阻塞报告。

## 10. 输出格式

报告源文件/代码、模式、类型、CMS/API、工具等级、五接口状态、端到端状态、修复轮数和剩余风险。

## 11. 经验案例索引

- `archive/cases/getav-me.md`：Cloudflare/Next.js API 优先、Android UA、年龄验证 cookie 的实测案例。
- `archive/cases/missav-image-debug.md`：MissAV 系 localProxy、AES-CBC 图片解密、JPEG EOI 截断和 CDN 替换案例。
- `archive/cases/nkdvd-line-sign-debug.md`：MacCMS sid/from/show 线路错位、playerconfig 映射、XOR+双字母表 sign 解密和真直链门禁。

## 12. zip_refs 实战案例库

`archive/cases/zip_refs/` 保存 references.zip 原始案例，用于溯源，不直接覆盖主规则。新增策略模块只抽象 py 源通用方法：

- `strategies/yk_runtime.md`：羊壳/海阔运行时兼容。
- `strategies/nuxt_devalue_api.md`：Nuxt/devalue/Next/Vite API 解析。
- `strategies/hls_localproxy.md`：HLS AES-128、m3u8 分片/key 和 localProxy。
- `strategies/applecms_api.md`：苹果CMS采集 API、子分类合并、批量补图、suggest 搜索。
- `strategies/domain_release.md`：发布页、动态域名、跳转壳和 raw deflate。
- `strategies/folder_routing.md`：folder 二级/三级路由与 filters。
- `strategies/encrypted_api.md`：AES 加密 API、guest token、成人确认和付费边界。
