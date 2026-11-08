# 公共生成骨架

所有模板共享以下能力：`_get`、`_post`、`_fix`、`_clean`、`_tree`、`_parse_list`、`_extract_play_url`。生成时只保留实际用到的方法。

请求要求：使用 `self.headers`、超时、异常隔离和一次请求结果复用；禁止在条件判断和表达式中重复请求同一 URL。

URL 规则：`//` 补协议，`/` 拼接 host，相对路径使用 `urllib.parse.urljoin`；不要对已是绝对 URL 的地址再次拼接。

列表规则：选择器按画像顺序尝试，真实 ID/URL 稳定去重，保留首次顺序，单条异常 continue。

播放规则：优先确认直链；播放页、iframe、API 地址必须经过实际提取验证后才能写入返回值。
