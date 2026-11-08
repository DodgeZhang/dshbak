# JavaScript Packer 解码策略 v8.4
处理 Dean Edwards Packer 或同类 `eval(function(p,a,c,k,e,d){...})` 打包脚本。
## 适用特征
- 页面内没有明文播放地址，但出现 `split('|')` 字典和 `eval(function(`。
- 播放参数、API 地址或 `u` 参数只在解包后的 JS 中出现。
- 页面使用 Packer 后仍需继续扫描 m3u8、mp4、url、u 和 iframe。
## 解码规则
- 提取打包模板、字典、进制参数和替换范围。
- 按 Packer 的 base36 索引规则从高位向低位替换。
- 处理单引号、双引号和 JavaScript 字符串转义。
- 解包结果只作为候选文本，不能直接视为媒体地址。
## 提取顺序
```text
原始 HTML
→ 明文 m3u8/mp4
→ u / encodeURIComponent 参数
→ Packer 解包
→ 解包文本中的 m3u8/mp4/url/u
→ API 请求
→ iframe 递归
```
## 实现要求
- Packer 解码器异常必须局部捕获，不能影响列表、详情或其他线路。
- 解码后再次执行 HTML 实体还原和反斜杠斜线还原。
- 候选 URL 必须通过 `http/https`、媒体扩展名或真实响应门禁。
- 不能将 `eval` 内容直接执行；只做字符串解析和受限替换。
- 多个候选地址按页面出现顺序保留，重复地址去重。
## 失败处理
- 字典不足、模板边界不完整或索引异常时返回空字符串。
- API 返回的 Packer 内容也要走同一解包流程。
- Packer 失败后继续尝试 JSON、iframe、播放器变量和站点专用解密。