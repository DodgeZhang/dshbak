# Folder 二级/三级路由模块 v8.4

处理羊壳/海阔中的 `vod_tag:"folder"`、演员/标签二级页、虚拟分类、folder + filters 和复杂分类结构映射。

## 适用特征

- 用户要求二级/三级页面、演员列表、标签列表、专题目录、分类文件夹。
- 列表项不是视频详情，而是点击后继续进入资源列表。
- XBPQ/JSON 中分类是虚拟分类 + folder 二级 + 词条筛选。

## 核心规则

- folder 项必须带 `vod_tag: "folder"`；没有它客户端会当视频播放。
- 博主、UP 主、专题、榜单和标签目录都属于 folder；一级列表返回目录项，二级作品列表由 `categoryContent()` 分发。
- folder ID 必须稳定、可逆且前缀不冲突，例如 `author:{id}`、`up:{id}`、`folder:{id}`。
- 榜单通常是一级 folder 分类，筛选值必须映射到站点真实路径或接口参数，不得把筛选项伪装成视频卡片。
- 榜单卡片的粉丝数、作品数、点赞数可以放入 `vod_remarks`；位置由客户端 UI 决定。
- 目录页如果由前端模板渲染，优先查找业务 JS 中的分页 JSON 接口，再实现 `page/limit/total/list`。
- 相对时间、粉丝数、作品数、点赞数和收藏数可按目录类型写入 `vod_remarks`；目录卡片不应伪造视频播放地址。
- 排行榜筛选必须使用站点真实的路径或参数，并至少验证默认项与一个时间范围或统计维度。

- folder 点击应由 `categoryContent` 分发处理，不要塞进 `detailContent` 返回多 vod。
- folder 的 `vod_id` 必须稳定、可逆；可用路径本身，也可用 `folder$typ$cid`，但解析分支要明确。
- 演员/标签二级可返回 folder 列表；进入后再返回真实视频列表。
- 复杂分类优先遵循用户给的 JSON/原规则结构，不要自作主张平铺站内所有标签。
- folder 页也要返回 `page/pagecount/limit/total/list`，并测试第 1/2 页。
- 若 folder 页顶部有筛选，应该注册到 `filters[folder_id]`，不要把筛选选项伪装成 folder 卡片。
- Nuxt/SSR 演员对象与视频对象混杂时，必须用 `works/videos/actor_id` 等字段判别，避免把剧名当演员名。

## 门禁

- 每类 folder 至少点击一次，确认走 `categoryContent` 而不是 `detailContent`。
- 每类 folder 至少测第 1 页和第 2 页。
- 检查 folder 项、视频项的 `vod_id` 前缀不会互相冲突。

案例参考：`archive/cases/zip_refs/missav-folder写法.md`、`archive/cases/zip_refs/51hub-v2-写法参考.md`、`archive/cases/zip_refs/拼多多-json转py-分类结构.md`。