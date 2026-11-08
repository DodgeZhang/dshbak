# 验证与排错模块 v8.4

六接口（含 homeVideoContent）和端到端验证是完成门槛。故障排查表和211经验速查用于失败定位。

# 验证流程

```python
import os
import sys
sys.path.insert(0, os.environ.get('SPIDER_ROOT', '/sdcard/Download'))
import 脚本名; s = 脚本名.Spider()
if hasattr(s, 'getName'): print("T4模式:", s.getName())
s.init("")
required = ['homeContent','homeVideoContent','categoryContent','detailContent','searchContent','playerContent']
missing = [m for m in required if not hasattr(s, m)]; print("缺少接口:", missing)
if missing: raise RuntimeError("六接口不完整")
print("首页:", s.homeContent(False)); print("推荐:", s.homeVideoContent())
r = s.searchContent("测试", "0"); print(len(r['list']), r['list'][0]['vod_name'] if r['list'] else "空")
if r['list']:
    d = s.detailContent([r['list'][0]['vod_id']]); v = d['list'][0] if d['list'] else None
    if v: print(v['vod_name'], v['vod_play_from']); pid = v['vod_play_url'].split('#')[0].split('$')[1] if '$' in v['vod_play_url'] else ''; p = s.playerContent("", pid, []); print(p.get('url','')[:80])
```

静态检查分两种模式：技能自带模板执行以下命令，占位域名显示 WARN：

```bash
python3 scripts/static_check.py
```

最终交付源必须执行以下命令，任何占位域名或硬伤必须 FAIL（在技能根目录执行）：

```bash
python3 scripts/static_check.py /path/to/source.py --final
```

---
# 故障排查

| 问题 | 方案 |
|------|------|
| `module 'xxx' has no attribute 'Spider'` | 创建Spider类 |
| 影视仓无法加载T4源 | type:4 + api地址正确 |
| 字幕不显示 | playerContent返回subs |
| 播放403 | playerContent返回header |
| shell 端没数据但浏览器能打开 | Python requests 不继承系统 VPN；加载 `strategies/proxy_network.md`，支持 `extend.proxy`、环境变量和本机代理端口探测 |
| localProxy/proxyPic 图片不显示 | 检查是否裸用 requests.get；图片代理必须复用 session 并带 `proxies=self.session.proxies or None` |
| Cloudflare/Next.js HTML 403 | 不直接判死站；先测 `/api/`、`__NEXT_DATA__`、移动 UA、Referer 和实测 cookie，API 可用则走 API |
| MissAV 系图片 AES 失败 | 检查 key/iv 是否 ASCII 16 字节、是否误用 bytes.fromhex、JPEG 是否截断到 `\xff\xd9` |
| 分类页空数据 | 优先重新分析；可用 `py_mcp:analyze_website`，否则用 Operit 网页/HTTP 工具和 `super_admin 终端` 检查选择器 |
| 播放链接获取失败 | 优先 `py_mcp:debug_play_link`；不可用时按 JS/JSON/iframe/token 顺序递归调试 |
| 选择器匹配0个 | 优先 `py_mcp:debug_selector`；不可用时用 `super_admin 终端` 验证并检查 contains |
| 小说正文为空 | 检查内容区 XPath，多级兜底 |
| 图片不全 | 检查分页/data-src/data-original 懒加载 |
| 加密内容无法解密 | 优先分析工具识别加密类型；不可用时读取脚本并用 `super_admin 终端` 验证算法 |
| Nuxt 数据解析为空 | 检查 `__NUXT_DATA__`/payload 是否为索引数组；先还原再 `_walk` 字段，不套 XPath |
| 播放页有页面但无 `video_url` | 检查列表 `episode_id` 是否丢失；对比裸 ID 入口和带 episode_id 入口，后者可播则以列表入口为准 |
| folder 二级不能翻页 | `vod_tag:"folder"` 必须在 `categoryContent` 处理 `pg`，实测 `/page/2/` 或 `?page=2`，禁止固定 `pagecount=1` |
| 演员/专题列表加载很慢 | 检查是否逐条请求详情页补封面/备注；默认取消逐条请求，除非用户要求完整优先 |
| 图片 URL 有值但不显示 | 抽样请求检查 0 字节、Content-Type、magic bytes；必要时 localProxy 解密，不要返回 200 空图片 |
| 角标位置不对 | `vod_remarks` 只控制文本，位置由客户端 UI 控制，源无法强制左上/左下 |
| 页面只有 Vue/React 模板、博主列表为空 | 提取业务 JS，搜索 axios/fetch/$Http/listpagination，实测 JSON 接口和字段；游客接口失败不能清空公开数据 |
| 图片 URL 有值但封面不显示 | 检查 `z-image-loader-url`、Content-Type、响应长度和图片魔数；binary/octet-stream 需读取前端解密器并由 localProxy 解密 |
| `data-config` 播放数组为空 | 先将 HTML 的 quot、amp、apos 实体编码解码，再还原 JSON 路径中的反斜杠斜线，最后解析 JSON |
| 相对时间角标错误 | 移动端相对时间优先于桌面端绝对日期，依次支持刚刚、秒、分钟、小时、天、周、月、年 |
| 排行榜筛选无效 | 把筛选值映射到站点真实路径或接口参数，抽测默认、日、周、月及点赞/收藏项 |
| `parse:0` 播放失败 | 播放地址必须实测 HTTP、Content-Type 和媒体内容；M3U8 必须包含 `#EXTM3U`，HTML 播放页不能直接标记为直链 |
| JSON API站 | 使用采集API骨架，跳过HTML解析 |
| 搜索编码问题 | 关键词必须quote() |
| iframe播放器空白 | 二次请求iframe src提取m3u8 |
| 签名过期 | 检查API签名算法，添加时间戳参数 |
| 羊壳推荐页空/只有推荐页 | 加载 `strategies/yk_runtime.md`；检查 `homeVideoContent`、`homeContent.class`、filters dict、标准签名和翻页字段 |
| Nuxt/Next/Vite API 字段错 | 加载 `strategies/nuxt_devalue_api.md`；先还原 devalue/挖 chunk/config.js，再验证分类参数是否真的生效 |
| HLS 主 m3u8 200 但不能播 | 加载 `strategies/hls_localproxy.md`；逐级测主清单、子清单、key、ts，必要时 localProxy 重写 |
| data-preview/data-play-src 播放错片 | 列表直链站不要详情页二次抓第一个播放属性；将列表直链编码进 play id 并在 playerContent 直出 |
| 苹果CMS主分类空/补图缺前几条 | 加载 `strategies/applecms_api.md`；主分类轮询子分类，`ac=detail&ids=` 按 20 条分批并按 vod_id 回填 |
| 苹果CMS搜索验证码 | 先测 `/index.php/ajax/suggest?mid=1&wd={key}&limit=50`；无真实分页时不要伪造 pagecount |
| 发布页解出域名但列表空 | 加载 `strategies/domain_release.md`；验证目标站结构，防止发布页被其他站占用或 200 假成功 |
| folder 点击直接播放/不进二级 | 加载 `strategies/folder_routing.md`；folder 项必须 `vod_tag=folder`，并由 `categoryContent` 分发 |
| 加密 API 参数错误/401 | 加载 `strategies/encrypted_api.md`；检查 base64 URL 编码、header 大小写、guest token、成人确认流程 |
| 分类筛选栏不显示/筛选无效 | filters 外层 key 必须是分类 `type_id`（不是维度名），格式 `{tid: [{"key","name","value":[{"n","v"}]}]}`；维度必须有 `name` 字段；"全部" 的 `v` 必须是 `""`；`extend` 是 dict 用 `.get()` 取值 |

---

# 完成前验证矩阵

- 分类：至少测主分类第1页、第2页；不要用 99/999 伪分页冒充。
- folder：每一种 `vod_tag:"folder"` 至少测 `categoryContent(folder_id,1)` 和 `categoryContent(folder_id,2)`；返回真实 `pagecount/total/limit`。
- 播放：列表项带 `episode_id` 的站点，确认 `vod_id` 保留 episode_id；抽测同一资源的裸 ID 入口和带 episode_id 入口，若裸入口坏但带 episode_id 返回 `video_url`，以列表 episode 入口为准。
- 图片：抽测普通封面、演员头像/封面、本地代理图片；检查返回长度 > 0 且 magic bytes 正确。
- 代理：被墙或 shell 端异常站点，确认 `_get/_post/playerContent/localProxy/proxyPic` 都复用同一 `session` 和代理；禁止写死私人代理 IP、NAS、账号、密码。
- Cloudflare/API：HTML 被 WAF 时，确认已尝试 API 优先、移动 UA、Referer/cookie；API 可用时报告“HTML 有 WAF，数据走 API”。
- MissAV 图片：抽测 `localProxy/proxyPic` 返回长度 > 0，magic bytes 正确；AES key/iv 为 16 字节 ASCII，JPEG 解密后截断到 EOI。
- 性能：一级列表不应产生 N 条详情请求；日志不应在进入演员/专题列表时批量打印“详情/作品”。
- 原站坏内容：若原站同入口本身无源或无数据，记录为站点数据问题，不做污染全局逻辑的特殊硬编码。
- 羊壳运行时：必须测 `homeVideoContent()`、`homeContent(False)` 和一个分类入口，确认 class/list/filters 类型符合壳端。
- Nuxt/API：必须验证 API base、字段路径、分类参数差异、分页 cursor/offset/page 机制。
- HLS：必须测主 m3u8、子 m3u8、key、ts；签名过期链接必须点击实时解析。
- 苹果CMS API：主分类为空时必须测子分类合并；补图按 20 条分批；suggest 搜索不伪造分页。
- 动态域名：解出的域名必须验证目标站结构，不只看 200；跳转链限制深度。
- Folder：每个 folder 类型至少测第 1/2 页，确认 `vod_tag` 和 `categoryContent` 分发。
- 加密 API：GET/POST 加密、响应解密、guest/confirm/playback 至少各测一次；locked 付费集跳过并报告。

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
<!-- 演进: 2026-08-28 | 来源: 耐看点播线路与 sign 解密回归 | 类型: troubleshoot -->
## 播放线路与真直链门禁（v8.4）

- `vod_play_from` 与 `vod_play_url` 的 `$$$` 数量必须一致。
- 线路按详情页首次出现顺序输出，不按 sid 数值排序；抽样核对首集的 `player_aaaa.sid/from`。
- 线路名不得含 `选择播放源/播放线路/展开/收起`；内部 code 优先映射 `playerconfig.js.show`。
- 每条线路至少抽测首集；最终 URL 不得仍含 `/player/`、`/play/` 或详情页路径。
- 播放配置位于 HTML 属性时，先解码 quot、amp、apos 实体编码，再还原 JSON 路径中的反斜杠斜线，最后解析 JSON。
- `parse:0` 只能用于已确认的 HTTP/HTTPS 媒体地址；M3U8 必须实测返回 `#EXTM3U`，不能把 HTML 播放页冒充直链。
- 图片封面必须抽测响应长度和魔数；自定义 `z-image-loader-url` 图片需验证解密或本地代理后的真实 MIME。
- 相对时间角标优先使用移动端字段，桌面端绝对日期仅作回退。
- Vue/React 博主或榜单模板必须追踪业务 JS 的 JSON 接口，抽测分页和筛选参数。
- `parse:0` 只允许用于确认后的媒体 URL，禁止 `parse:0 + 播放页 URL` 冒充直链。
- 直链协议必须为 http/https；`yeerx://`、`mttby://` 等可疑协议视为解密失败。
- HLS 必须继续验证 HTTP 与 `#EXTM3U`；时效签名链接点击时实时解析。
- 双向字符映射都不报错时，以媒体 URL 语义和资源响应判定正确方向。

建议回归表：`线路名 / sid / from / 集数 / 首集播放页 / 最终URL / HTTP / #EXTM3U`。