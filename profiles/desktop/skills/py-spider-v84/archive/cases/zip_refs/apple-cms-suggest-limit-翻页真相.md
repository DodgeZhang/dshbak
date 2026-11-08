# 苹果CMS suggest 搜索：limit 与翻页真相（2026-08-24 补遗）

> 补充 `references/apple-cms-suggest-search.md` 的最终实测结论（无水印资源网 + 闪电源双站验证）。
> 背景：用户在搜索验证码被锁后追问"还有别的办法能处理翻页问题吗"，全部实测后定稿。

## limit=50 有效

`/index.php/ajax/suggest?mid=1&wd={关键词}&limit=50` 返回 **50 条**（默认 20）。py 源 `searchContent` 用 limit=50 取满。

## 翻页参数全部无效（重要！别浪费时间）

`page` / `pg` / `p` / `offset` / `start` / `pageNum` 全部实测无效：
- page=1/2/3 返回完全相同（id 列表逐位一致）
- pagecount/total 字段是假象：`pagecount=13, total=613` 显示有 13 页，但 page=2 仍返回第 1 页数据
- 原因：suggest 是"搜索框输入提示"接口（home.js 里 `$().autocomplete(...)` 调用），设计上只返回固定前 N 条建议，**服务端不支持翻页**

**结论**：苹果 CMS suggest 搜索最多 50 条，是接口硬限制。用户要求翻页时：①说明是接口限制 ②不要写复杂翻页逻辑 ③分类浏览本身翻页正常（见 `苹果CMS-API源-翻页与补图.md`）。

## 相关站验证

- api.wsyzy.net（无水印资源网）：page 参数无效 ✅
- shandianzy.com（闪电资源网）：page 参数无效 ✅（两站同是苹果 CMS，行为一致）

## 羊壳 require login 坑（再提醒）

搜索返回 vod_id='' 的提示 vod → 羊壳报 "require login [guest]"。suggest 方案返回真实 id，无此问题。搜索别返回空 id 占位项。
