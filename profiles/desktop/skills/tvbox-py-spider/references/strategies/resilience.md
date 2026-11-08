# 站点韧性策略模块 v8.4

包含图片伪装、域名热更换、隐藏子分类、JS时长、限流和T4适配坑。

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
通用转换规则：详情或列表脚本出现 `secondsToHMS(数字)`、`duration=数字` 等秒数表达式时，在 Python 中转换；时分秒为零时保留两位数字，避免把秒数直接当作时长文本。

## 严格封面来源
当实测确认普通 `img` 会混入广告、头像或推荐图时，封面按以下顺序提取：
1. 详情脚本中的结构化 poster 字段。
2. `video[poster]`。
3. 站点明确标记的封面字段。
不要把该限制无条件套到所有站点；列表页默认不逐条请求详情补图。

## 图片偏移修复
图片响应无法通过魔数识别且确认存在头部偏移时，依次尝试跳过 `2,4,8,16,32,64,128,256,512,1024` 字节，再检查 JPEG、PNG、WebP、GIF 魔数。偏移修复只适用于图片代理，不能用于媒体播放地址。

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
## 场景8：动态域名/自动域名解析与容灾

**适用特征**：站点有发布页、永久地址、最新地址、`zz_line`/`zz_backup_line`、`Base64.decode`、`atob`、`words.random()`、随机子域名前缀、加载中跳转页，或源码中出现加密 `data` 后解出真实域名后缀。

**典型模式A：AES发布页后缀**：发布页源码含 `key` 和 `data`；`SHA256(key)` 得到 AES key，前 16 位作 iv；AES-CBC 解密 `data` 后提取 `zz_line` 和 `zz_backup_line`。最终域名常为 `https://随机5位.后缀/`。

**典型模式B：Base64/atob发布页后缀**：发布页源码含 `Base64.decode(...)` 或 `atob(...)`；解码后匹配 `words.random() + ".xxx"` 或 `.[a-z0-9]{5,}.com/cc/net/org`。最终域名常为 `https://随机前缀 + 后缀/`。

**典型模式C：入口页 + 中转页 + Base64后缀 + Nuxt数据**：入口发布页先给一个中转域名（例如加载中 `<a href="https://中转域/">`），中转页源码再含 `Base64.decode(...)`；解码后从 `words.random()+后缀` 得到真实随机子域。处理时必须分四步验证：发布页跳转是否有效、中转页是否解码成功、随机 host 是否可访问、目标页是否含真实 `__NUXT_DATA__`/API 数据。不要把中转域当最终 host，也不要把某个随机前缀写死。

**半自动与全自动区别**：只在 `init()` 里解析一次 host，且 `self.domains=[self.host]` 不参与 `_req()`，只能算半自动域名；真正全自动必须有候选域名池、探活、失败切换、重新解析发布页和跳转深度限制。

**标准实现要求**：
- 发布页支持多个入口，按顺序请求，失败不中断。
- 同时提取主域 `zz_line` 和备用域 `zz_backup_line`，去重后保存，不要只取第一个。
- 每个后缀生成多个随机前缀候选 host，形成 `self.domains`。
- 初始化后对候选 host 做轻量探活，成功 host 插到列表头部。
- `_req()` 必须实际使用 `self.domains`，请求失败、空页面、跳转页或状态异常时自动 `_switch_domain()`。
- 一轮域名池失败后重新解析发布页刷新 suffix/domain 池。
- 加载中跳转页/中转页递归必须限制深度，建议最多 3 层。
- fallback 域名只能兜底，仍需探活；不可盲信 fallback 成功。
- `_fix_url()` 或 `_replace_host()` 必须统一替换当前 host，避免旧域名残留。
- 日志区分发布页失败、解密失败、host 探活失败、请求失败和切换域名。

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

**判断是否适配当前方式**：如果发布页能解出域名后缀，且目标站请求路径在不同随机 host 下保持一致，就适配动态后缀+随机前缀方案；如果域名需要签名、cookie绑定、登录态或每个接口独立 token，则还需 API 鉴权模块，不应只做 host 随机化。

---