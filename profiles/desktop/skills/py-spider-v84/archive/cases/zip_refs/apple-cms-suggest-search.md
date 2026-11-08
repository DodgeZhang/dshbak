# 苹果CMS 验证码搜索绕过方案（suggest 接口）

> 来源: 无水印资源网（api.wsyzy.net）实战，用户提示 shandianzy.com 的接口后验证成功
> 适用: 苹果 CMS 站点搜索被验证码锁死时

## 问题

苹果 CMS 站点的搜索页（`/index.php/vod/search/wd/xxx.html`）常被**强制验证码**保护：
- py 源请求 → 返回"系统安全验证"页（需人工输验证码）
- 搜索 API（`api.php/provide/vod/?ac=detail&wd=`）→ 返回"暂不支持搜索"
- 验证码服务端校验（`ajax/verify_check`），无法绕过

## 方案：ajax suggest 接口（无验证码！）

苹果 CMS 的**搜索建议接口通常不设验证码**：

```
GET /index.php/ajax/suggest?mid=1&wd={关键词}
```

### 关键参数（血泪教训）
- **必须带 `mid=1`**（mid=模块 id，1=视频）——之前失败就是因为少了它！
- `wd` = 关键词（URL 编码）

### 返回格式（JSON，无验证码）
```json
{
  "code": 1,
  "msg": "数据列表",
  "page": 1,
  "pagecount": 31,
  "limit": 20,
  "total": 613,
  "list": [
    {
      "id": 146895,
      "name": "爱情盲选英国篇第三季",
      "en": "aiqingmangxuanyingguopiandisanji",
      "pic": "https://img1.wsyzy.org/upload/vod/20260819-1/xxx.jpg"
    }
  ]
}
```

## py 源实现

```python
def searchContent(self, key, quick, pg='1'):
    try:
        key = str(key or '').strip()
        if not key:
            return {'list': []}
        # suggest 接口（mid=1&wd=，无验证码）
        r = self.sess.get(
            f"{self.host}/index.php/ajax/suggest?mid=1&wd={quote(key)}",
            timeout=10, verify=False)
        d = json.loads(r.text)
        vods = []
        for it in d.get('list', [])[:30]:
            vods.append({
                'vod_id': str(it.get('id', '')),
                'vod_name': it.get('name', ''),
                'vod_pic': (it.get('pic') or '').replace('\\/', '/'),  # JSON 转义
                'vod_remarks': '',
            })
        return {'list': vods}
    except Exception:
        return {'list': []}
```

### 播放链路
suggest 返回的 `id` 直接用于详情接口：
```python
self._get({'ac': 'detail', 'ids': vid})  # → vod_play_url m3u8 直链
```

## 验证要点

- ✅ 搜索"爱情" → 20 条全部带图
- ✅ 点结果 → 详情（ac=detail&ids=id）→ m3u8 播放
- ⚠️ 番号搜索（如 SSNI）可能 0 条（取决于站点是否有番号资源）

## 常见坑

1. **参数名**：`mid=1&wd=`（不是只有 wd）——不同站 mid 值可能不同（视频模块一般是 1）
2. **JSON 转义**：`pic` 字段的 `\/` 要 replace 成 `/`
3. **无验证码**：suggest 接口本身不触发验证码，直接 JSON
4. 同站验证：shandianzy.com 和无水印资源（api.wsyzy.net）都是苹果 CMS，接口一致
