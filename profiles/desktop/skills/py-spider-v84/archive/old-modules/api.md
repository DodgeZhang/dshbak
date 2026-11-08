# API 与 SPA 模板

发现 `/api.php/provide/vod` 或前端接口后，跳过 HTML 列表选择器，建立 endpoint、请求方法、参数、鉴权、解密和字段路径。
影视 API 常见接口为 `ac=list&tid={tid}&pg={pg}`、`ac=detail&ids={id}`、`ac=detail&wd={key}&pg={pg}`，实际字段以响应为准。
SPA 必须先检查同目录同站已有源，优先复用 token、解密、代理、模块前缀和播放协议；每个模块至少验证分类→列表→详情→playerContent。
字段可能嵌套，列表封面和播放地址递归检查 `item.movie`、`item.book` 等对象，不得只读取顶层同名字段。
