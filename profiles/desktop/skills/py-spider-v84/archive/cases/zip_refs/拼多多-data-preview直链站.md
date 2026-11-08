# 拼多多.py：data-preview 直链站模式 + 性能教训（2026-08-24）

`/opt/data/archive/xbpq资料/拼多多.py`（json 转 py，播放链接替换版）。
用户原需求：JSON 的"链接"字段直接取播放地址（`data-preview` 属性），`https://ckbhm3u8.vip/` 前缀替换成 `https://ckbhm3u8.com/`；该给二级给二级、该给一级给一级。

## 站点结构（色多多/拼多多，sddww 系）

- **域名候选**（多域名同站，`nlet.sddww.com` 会 301 到 `se-duo-duo-l3s2.sddww.xyz`）：
  `https://ca4j.sddww.xyz` / `https://epgo.sddww.xyz` / `https://nlet.sddww.com` / `https://sddww.xyz`
  - 域名测活标准：GET `/` 返回 200 且含 `models-videos__col`（首页就有 28 张卡，根路径可用——与 18j 不同）
- **列表卡片**：`<div class="models-videos__col">` 块（首页 28 个/页）
  - 链接：`<a href="/?play-56117-1-.html">` ← **注意末尾 `-`**，重拼 URL 时保留原分隔符
  - 标题：`<p class="mb-1"><a href="...">标题</a></p>`
  - 图片：`<img src="https://ckbhjpg.top/upload/...png">`（jpg/图片域是 ckbhjpg.top，与播放域 ckbhm3u8 不同）
  - **播放：`<img ... data-preview="https://ckbhm3u8.vip/20251119/qLW7tAtU/index.m3u8">`** ← 播放地址直接嵌在列表卡片 img 的 data-preview 属性里（同黄果 data-play-src 一类：自定义 data 属性直链 m3u8）
- **URL 格式**：
  - 分类：`/?fenlei={分类名}&p={pg}`（分类名是中文，直接用，requests 自动编码）
  - 详情：`/?play-{vid}-{pg}-.html`
  - 搜索：`/?search={wd}&p={pg}`（GET，返回 28 条 data-preview）
  - 最新视频：`/?video={pg}.html`；热门标签：`/?tags-ch-all.html`（162 个分类一次拿全）
  - 推荐类型下拉：`/?categories=1.html`（分类名链接同样 `/?fenlei=xxx`）
- **播放链接替换**（用户明确要求）：`re.sub(r'https://ckbhm3u8\.vip/', 'https://ckbhm3u8.com/', url)`——旧 CDN 域名失效，必须换新域。同类还有 ckbhm3u8.vip→com 这种"域名后缀轮换"模式（不同于 t26/t30→t33 的节点替换，这里是完整域名换后缀）

## ⚠️ 性能教训（用户"好慢啊"打回）

**homeContent 绝不能遍历所有分类逐个发请求**：第一版遍历 26 个分类每个 GET 一次（26×2-3s = 50s+），用户直接喊"好慢啊"。
修复后：homeContent 只 GET 主页 1 次解析 28 条推荐（~1s）；分类页由 categoryContent 按需请求；init 的分类列表抓取也只请求 tags-ch-all.html 一次正则全量提取。

## ⚠️ 羊壳环境 bs4 依赖

交付 py 时用了 `from bs4 import BeautifulSoup` → 本机没装 bs4 直接挂；羊壳环境同样**不保证有 bs4**（同 Crypto 教训）→ 改纯正则解析（`re.split(r'<div class="models-videos__col">', html)[1:]` 按卡切块）。黄果用户重写版用 bs4 是用户自己的选择，交付给壳的 py 不赌壳有 bs4。

## ⚠️ 详情页 URL 拼接坑

第一版 `f'{host}/?play-{vid}-{pg}.html'` 少了末尾 `-` → 详情 404/空。卡片 href 是 `/?play-56117-1-.html`（`{vid}-{pg}-` 双分隔），重拼必须保留：`f'{host}/?play-{vid}-{pg}-.html'`。

## 验证

- init 1.75s（域名发现 0.9s + 分类 81 个）/ homeContent 0.96s 28 条 / categoryContent 0.99s / detailContent 0.89s 播放链接已替换
- 交付提醒：删旧文件再导入、ext 留空（代码自动发现域名）
