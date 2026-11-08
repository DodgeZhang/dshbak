# 发布页/动态域名解密模块 v8.4

处理发布页、永久地址、跳转壳、`key+data` 解密、Base64/atob/words.random、raw deflate、域名被占用和 href 直接提取。

## 适用特征

- 发布页、最新地址、永久地址、加载中跳转页。
- 源码含 `window.appConfig`、`key`、`data`、`zz_line`、`zz_backup_line`、`Base64.decode`、`atob`、`words.random()`。
- 解出的域名可访问但内容不是目标站。
- play_data/base64 后还需 inflate/deflate。

## 核心规则

- 解出域名后必须验证目标站结构，例如特征 class、文章结构、站点标题、`dateModified`、`loadBannerDirect`、API 返回字段；不能只看 200。
- 发布页域名可能被别的站占用，模板/key 相同但目标不同；结构校验失败必须丢弃。
- `key+data` 常见方案不止一种：方案 A 为 sha256 hex 前 16 位做 iv；方案 B 为密文字节前 16 字节做 iv；都要按实测判断。
- `Base64.decode/atob + words.random()` 场景要提取域名后缀并生成随机前缀，不写死一次性的完整域名。
- 加载中跳转页若有明确 `<a target="_self" href="https://...">加载中</a>`，优先直接提取 href 跟随，比解析 JS 跳转更快。
- raw deflate 解压需 `zlib.decompressobj(-15)`；普通 `zlib.decompress()` 可能报 incorrect header check。
- 动态域名候选列表第一位放当前有效域名；失败再轮询候选。
- 发布页若分别提供 `subdomains` 与 `urls` 数组，可按 `subdomain.suffix` 组合生成候选；只保留去重后的候选并逐个探活。
- 对随机前缀域名应生成有限数量候选，不把单次生成的完整域名写死；站点路径保持一致时才复用该组合策略。

## 门禁

- 发布页解析后至少验证一个候选是真目标站。
- 随机前缀站要验证 2-3 个候选，避免 DNS 抖动误判。
- 跳转链限制深度，避免无限递归。
- 解密/解压失败时保留 fallback，但报告未完全自动化。

案例参考：`archive/cases/zip_refs/51吃瓜发布页解密与羊壳py排障.md`、`archive/cases/zip_refs/404自动挡-域名轮询与解密.md`、`archive/cases/zip_refs/跳转页href直接提取.md`。