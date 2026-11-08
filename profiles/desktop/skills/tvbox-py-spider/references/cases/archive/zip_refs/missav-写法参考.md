# MissAV py 源写作步骤（未完结）

> **状态：播放加密未解完**——ts/key CDN (`tsnew.cpckgr.cn`) 直连 403，需走 `localProxy` 代理。已识别方案，未交付。
> 参考：`cache/documents/91hub2.py`(m3u8+ts+key 代理) + `51吃瓜.py`(AES 图片解密) + `51短剧用久发布站源码.json`(永久/实时发布站解析)

---

## 域名解析（3 个发布站）

- `https://missavt01.netlify.app/`
- `https://missavt01.github.io`
- `https://missavt01.pages.dev/`

HTML 都只有 683 字节，跳转到 `publish.js`，里面随机组合：
- **前缀**：`abcdefg` 之类 5 字符
- **主域名**：3 个随机取一个 → 拼成 `前缀.主域名`

**问题**：主域名本机连不上（阿里云上海 DNS 解析失败），需 shell 端代理能解析的域名直接传入，或在 ext 里硬编码。

---

## 图片解密（瓜系，来自 51吃瓜.py）

- AES-128-CBC，key=`f5d965df75336270`，iv=`97b60394abc2fbe1`
- 走 `localProxy(type=pic)` 或 51吃瓜的 `type=img`，`_aes_decrypt` 解密后返回 `[200, mime, data]`
- **注意**：源码里 `.jpeg` 结尾的图片需要特殊处理（详见 `cache/documents/51短剧图片映射.json`）

---

## 播放解密（91hub 同款，来自 91hub2.py）

**91hub2 已验证可工作的方案**：
- m3u8 里 `#EXT-X-KEY:METHOD=AES-128,URI="key_url"`
- ts 段也 AES-128-CBC 加密，用 key_url 解出 key 后逐段解密
- 全部走 `localProxy`：
  - `type=m3u8` → 解析 m3u8，把 ts 地址改写为代理 URL
  - `type=ts` → 解密 ts 段
  - `type=mkey` → 返回 AES key

**MissAV 待办**：
- m3u8 来源在 `data-url`（详情页 `#app` 里 `__NEXT_DATA__` JSON 中）
- ts/key CDN 是 `tsnew.cpckgr.cn`，直连 403，必须走代理

---

## 分类体系

按 51短剧 思路：
- 首页 `sort/renew`（最近更新）、`sort/hot`（最热）
- 分类：`jp/censored`、`jp/chinese-subtitle`、`cn/madou`、`cn/91-studio`、`uncen/fc2`、`uncen/1pondo`、`amateur/siro` 等
- 女优：`actresses/new`、`actresses/hot`
- 标签：`tags/hot`、`tags/letter/a` 等

---

## 筛选参数

TVBox 壳端筛选走 **`ext` 字符串**（json），不是 `filter` 字典。已确认：
- 壳端调用 `categoryContent(cid, pg, {}, '{"cateId":"xxx"}')`
- 代码里解析 `ext`：先 `json.loads(ext)`，再兜底 `filter`

---

## 待办（未解完）

- [ ] ts/key CDN 403 → 走 `localProxy(type=m3u8)` 代理，参考 `cache/documents/91hub2.py` 实现
- [ ] 域名自动解析 → ext 传真实域名兜底
- [ ] m3u8 直链是否被 CDN 校验 Referer → 加 `Origin/Referer` header