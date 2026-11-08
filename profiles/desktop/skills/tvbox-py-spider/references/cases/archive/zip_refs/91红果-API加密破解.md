# 91红果（xjvbsakdroz.xyz）API 加密破解记录（2026-08-25）

`https://xjvbsakdroz.xyz/home`（91红果）。**Vue SPA 前端**——web_extract 抓不到任何内容（`<div id="app">` 空壳），内容全靠 JS 渲染。真数据在**独立 API 域名**，且**请求/响应双层加密**。用户最后放弃（"实在写不了就放弃吧"），但登录+加密+解密+大部分接口已全通，记录下来下次续写。

## 一、API 架构（从 main JS 挖出）

- 前端 JS：`/js/main-BQMH8SeU.1787546359814.js`（1MB+ 压缩），API 域名列表在 `VITE_BASE_URL` / `VITE_APP_API_BASE_URL` 变量
- **API 域名候选**（VITE_BASE_URL 数组）：`https://kaknrojcj.top`、`rzluzivis.top`、`dhg6jgydtorel.cloudfront.net`、`d2t94pysljzk4k.cloudfront.net`、`api.iyjagnspba.icu`、`api.nsjagpbiya.icu`（第一个可用即用，kaknrojcj.top 实测通）
- **API 前缀**：`{域名}/api/app`，所有业务接口走它

## 二、请求加密（POST/GET 参数都要 AES 加密）

**密钥**（`crypto` 配置段）：
- `parameterKey` = `parameterIv` = `BxJand%xf5h3sycH`（key 和 iv 相同！16 字节）
- `interfaceKey` = `bd2023712da9405b8a97f95d6c6f978b67ee1cf66f2f5dd7c243cefa126cd7c2`（响应解密用）

**加密算法**（JS `Ie()` 函数）：AES-128-CBC-PKCS7，key=iv=`BxJand%xf5h3sycH`，对 `JSON.stringify(params)` 加密 → base64。

**POST**：body = `{"data": "<base64密文>"}`，Content-Type: application/json
**GET**：参数同样加密成 `?data=<base64密文>`，**必须 URL 编码**（base64 含 `+/=`，不编码会参数错误）
**必需 header**：`temp: test` + `X-User-Agent`（设备指纹）+ 登录后 `Authorization: <token>`

**X-User-Agent 格式**（从 JS getUserAgent 挖出）：
```
BuildID=com.abc.Butterfly;SysType=android;DevID={uid};Ver=1.0.0;DevType=iPhone;DeviceBrand=Xiaomi;DeviceModel=2510DRK44C;SystemName=Android;SystemVersion=16;Terminal=1;IsH5=1;Sid=
```
- `SysType` 必须小写 `android`（大写 `Android` 报 parameters error）
- `DevID` = uid = 16 位随机字符（字母数字）+ 毫秒时间戳

## 三、登录（POST /mine/login/h5）

```json
{"devID": "<uid>", "sysType": "android", "cutInfos": null, "isAppStore": false}
```
带 `temp: test` + `X-User-Agent`。响应 `hash:true` → data 是密文 → 解密后得到**用户对象**（含 `token` 字段，JWT）。之后 `Authorization: <token>`（**不带 Bearer 前缀**，带 Bearer 反而报 invalid token）。

## 四、响应解密（hash:true 时 data 是密文）

JS 响应拦截器算法（SHA256 派生 key/iv + AES-CBC）：
```
raw = base64decode(data)
o = utf8(interfaceKey) + raw[:12]       # interfaceKey 明文拼前 12 字节
i = len(o) // 2
l = sha256(o)[8:24]                     # 16 字节
n = l + o[:i];  r = o[i:] + l
s = sha256(n);  c = sha256(r)
key = s[:8] + c[8:24] + s[24:32]        # 32 字节
iv  = c[:4] + s[12:20] + c[28:32]       # 16 字节
m = raw[12:]
plain = AES-CBC-decrypt(m, key, iv, PKCS7)   # 解密失败 try rstrip(b'\x00') 兜底
json.loads(plain)
```
Python 实现见 `/opt/data/out/91hg_probe.py`（venv python 跑，`/opt/hermes/.venv/bin/python3`）。

## 五、已确认接口

| 接口 | 方法 | 参数 | 返回 |
|------|------|------|------|
| `/mine/login/h5` | POST | 见上 | 用户对象+token |
| `/vid/library` | GET | 可空 | 分类配置：canvas（SP影片/SHORT抖音/video动漫/image漫画/PIC图集/COVER帖子）、orderBy（new/playNum/love）、vidTags/acgTags、paymentType、timeType |
| `/tag/conf/list` | GET | 空 | 标签列表 `{tags:[{id, tagName}]}` |
| `/search/list` | POST | 见下 | 列表/搜索（JS 返回 `tagVidList`/`list`） |
| `/vid/play` | POST | publisher.uid/videoID/playTime | 播放心跳上报（不是拿地址！） |
| `/vid/video/play` | GET | path | 播放签名 |

**search/list 参数结构**（从 Go 校验错误逆向出字段名）：
```json
{"pageNumber":1,"pageSize":12,"keyWords":[""],"realm":"SP","sortType":2}
```
- `realm` = canvas key（SP/SHORT/video/image/PIC/COVER）
- ⚠️ 报错 `NewsKeywordSearchReq.Realm/KeyWords/Page.PageNumber/Page.PageSize required`——**keyWords 空数组 `[]` 会被 Go required 校验拒绝，必须 `[""]` 或带词**；但带 `[""]` 后仍报错，疑 realm 值/嵌套 page 结构未完全对上，**这是未解之谜**（用户已放弃）
- 播放地址线索：videoInfo 组件 `queryVideoInfo({videoID})` 返回 `horizontal-hls-${id}` 相关字段，未深挖

## 六、教训

1. **SPA 站 web_extract 空壳是常态**——别浪费时间，直接挖 main JS 找 API 域名（grep `VITE_BASE_URL`/`baseURL`/`api/app`）
2. **POST body 包 `{"data": 加密}` 模式**：参数先 AES 再塞 data 字段，GET 同理 `?data=`；密钥常在同一 JS 的 crypto 配置段（`parameterKey`/`parameterIv`/`interfaceKey` 一起出现）
3. **响应 `hash:true` = data 密文**：SHA256 派生 key/iv 是常见套路（interfaceKey 做种子）
4. **Go 后端参数校验错误信息会泄露字段名**——`Key: 'Xxx.Yyy' Error:Field validation...required` 就是字段清单，照着改参数名
5. 探测脚本保留在 `/opt/data/out/91hg_probe.py`（完整加密/解密/登录/接口探测），续写直接复用
