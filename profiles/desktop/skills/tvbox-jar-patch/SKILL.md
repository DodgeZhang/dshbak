---
name: tvbox-jar-patch
description: TVBox spider jar 逆向缝合修复，含跨 jar csp 源移植(子类+dex 类级合并)、PoW/cookie 取证、Go 代理、Gate 中和、UC/夸克 403/412、抓 pvideo、丢类校验与 md5 更新。Invoke when reverse/patch a TVBox jar, port a spider between jars, or fix pan playback.
---

# TVBox Jar 逆向缝合

针对 FongMi 系 TVBox spider jar（如 `950055803_4_*.jar`）做四件事：完整逆向 → 缝合外部 Go 网盘代理 → 统一重写图标 base → 重打包并同步 md5。参考实现见 `C:\Users\Dodge\AppData\Local\Temp\pvb\src\com\github\catvod\spider\PVB.java`。

## 触发场景

- jar 内 Go 代理因官方授权服务器关闭而启动失败（5266 不通 / 退出重进失活）
- 需要把另一 jar（如 xiaosa 的 `09071531.png`，实为 jar）里的 FishGo 二进制缝进目标 jar
- 站源设置页图标 404：仅替换 FishConfig JSON 出口不够，其它站源（FishPs/Bili/Local/Push/WoNiu/FishDrive/Kan360…共 68 处）也读 `merge.A.x1.s` 拼 URL
- 配置提交 CNB 仓库后图标仍缺失（解密状态机任意时刻 sput 覆盖 x1.s）
- jar 内远程 Gate 授权失效导致闪退/被清，或加载接口时弹"验证/请输入口令"模态框（`com/github/catvod/spider/gate/*`；闪退链与弹窗链是两个独立决策点）
- 把 A jar 里免登录/免 cookie 的 csp 爬虫源（如观影 csp_Gying）缝到只有旧版同类的 B jar
- 站点有 JS PoW/人机校验（browser_pow/browser_verified/app_auth 类 cookie 挑战），spider 需自动取证
- 网盘资源（UC 原画/夸克）Go 多线程代理无法起播，播放器反复重试：OSS 直链回调 403 `RequestDeniedByCallback`
- 怀疑"多线程被封"但需要运行时证据；无 root 抓不到 APP 私有进程的 pvideo 出站请求
- smali 重打包后全源无法加载（疑似丢类）
- 更新 jar 外独立分发的 Go 代理（`moyu/go/{dev,stable}` 的 pvideo/libfishgo.so + go.json；manifest 现为固定 `https://6800.kstore.vip/go_version.json`，可用 root 模拟器或真机 MITM 取，见第 9 节；不动 jar）
- 用户明示「逆向」「缝合」「重打包 jar」「更新 md5」

## 工具链

| 工具 | 用途 |
|---|---|
| `baksmali` / `smali` | dex ↔ smali 互转 |
| `dexlib2`（或 d8/dx） | 编译 Java → dex |
| `apksigner`/`jarsigner` | jar 重签名（按需） |
| Python ` zipfile ` / `hashlib` | 解包/打包/算 md5 |
| `readelf -h` 或自写 ELF 头解析 | 识别 Go 二进制 ABI |

无 baksmali 时可用 `java -jar baksmali.jar disassemble input.dex -o out/`；合并阶段 `java -jar smali.jar assemble smali/ -o classes.dex`。

**本机实测可用工具链（aidaox 系列，2026-09）**：
- `C:\Users\Dodge\AppData\Local\Temp\smalitools\smali-2.5.2.jar`（配 `C:\Users\Dodge\AppData\Local\Temp\tools\antlr-runtime-3.5.2.jar`），汇编命令 `java -cp "smali-2.5.2.jar;antlr-runtime-3.5.2.jar" org.jf.smali.Main assemble -a 28 <smaliDir> -o out.dex`（Windows classpath 用分号，PS 中整体引号）
- JRE 1.8；smali 2.5.2 对 api28 dex 兼容良好
- 设备端 `/system/bin/curl`（curl/8.x）做同出口 IP 的对照实验；adb 多设备时所有命令带 `-s <序列号>`

## 工作流

### 1. 逆向

1. **解包**：`jar` 本质是 zip，`unzip` 出 `classes*.dex` + `assets/` + `META-INF/`。
2. **反汇编**：`baksmali disassemble classes.dex -o smali/`（多 dex 时逐个 dis，输出到不同子目录避免冲突）。
3. **关键类清单**（按优先级读取）：
   - `com/github/catvod/spider/merge/A/s0.smali` — Go 代理管理器：`J0()`（下载+启动）、`Q()`（ping 校验置 `d=true`）、字段 `d`（adopted 标志）、`t()`（取单例）
   - `com/github/catvod/spider/merge/A/x1.smali` — 字段 `s` 是**所有站源设置页图标统一 base**，`public static volatile String` 非 final，可直接 sput 覆盖；解密状态机会反复回写旧图床地址
   - `com/github/catvod/spider/Init.smali` — 启动链入口
   - `com/github/catvod/spider/FishConfig.smali` — 设置页 JSON 出口，用于挂接 `rewriteIcons`
   - `com/github/catvod/spider/FishPs.smali` / `Bili` / `Local` / `Push` / `WoNiu` / `FishDrive` / `Kan360` — 全部走 `x1.s + 文件名` 拼接图标，无需逐个改
   - `np/protect/*.smali` — 字符串解密状态机，直接反射调用其解密方法通常返回 null（依赖初始化时机），故用轮询抢窗口而非一次解密
   - **aidaox 系（feimao/pan-go 架构，类混淆在 `merge/h/`）**：`merge/h/L2.smali` 是 feimao 注册器（`N(II,String,String,Map)` 拼 register JSON：id/url/thread/chunk/headers），`merge/h/J9.smali` 用 ProcessBuilder `sh -c` 启动 pvideo；网盘 API 在 `com/github/catvod/api/QuarkYun.smali` 与 `UcYun.smali`（**UcYun extends QuarkYun**，关键方法 `headers()/driveReferer()/driveUa()/buildSmartPlayProxy/panSiteKey()`）；`spider/gate/RemoteGate.smali`、`spider/gate/GatePolicy.smali` 是远程授权闸门
4. **Go 二进制分析**：解出来的 `assets/pvideo-*` 或 jar 内 `*.bin`，用 `readelf -h` 看 `e_machine`：
   - `0xB7`=ARM64 / `0x28`=ARM / `0x3E`=X86_64 / `0x03`=X86
   - 用 `strings` 找 `fishplay`/`-port`/`-danmu-dir` 等 flag 确认是 FishGo 系
   - jk 二进制（`jk.catvod.site`）默认 1314 端口、不支持 `-host`；xs 二进制（如 `xs_v7a.bin`）支持 `-port 5266` 且含完整 `/fishplay` 网盘路由，**优先选 xs**

### 2. 缝合 Go 代理

把外部 Go 二进制作为 `assets/pvideo-armeabi-v7a`（按目标 ABI 命名）注入 jar，配套写入 `assets/pvideo.md5` 清单（每行 `文件名 md5`），运行时由 PVB 类释放到 `filesDir` 再 `sh -c '二进制 -port 5266 -danmu-dir ... >> pvideo.log 2>&1'`。

**二进制选型**：
- 优先 `xs_v7a.bin` / `xs_arm64.bin`（支持 `-port` flag，路由完整）
- 次选 `jk_v7a.bin`（默认端口 1314，需 PVB 把 `PORT` 常量改 1314 或二进制 patch）
- 多 ABI 注入时按 `pvideo-arm64-v8a` / `pvideo-armeabi-v7a` / `pvideo-x86_64` / `pvideo-x86` 命名，PVB 会读 ELF 头自动排序

**注入 PVB 类**：
1. 在临时目录建 `src/com/github/catvod/spider/PVB.java`（模板见参考实现）
2. 编译为 dex：`javac -source 1.8 -target 1.8 -d build src/com/github/catvod/spider/PVB.java && d8 build/com/github/catvod/spider/PVB.class --output build/`
3. 合并到原 dex：用 `d8` 的 `--min-api` 或直接把 PVB.dex 和原 classes.dex 合并为新 classes.dex（保留多 dex 结构时把 PVB 放在最末 dex）
4. 改 `Init.smali` 的 `<clinit>` 或主 Activity 入口，插入 `invoke-static {p0}, Lcom/github/catvod/spider/PVB;->boot(Landroid/content/Context;)V`（用 `getApplicationContext()` 传 ctx）
5. 在 `FishConfig.smali` 各 action JSON 返回前插入 `invoke-static {p0}, Lcom/github/catvod/spider/PVB;->rewriteIcons(Ljava/lang/String;)Ljava/lang/String;` 并用返回值替换原寄存器

### 3. 图标 base 重写

**核心**：`merge.A.x1.s` 是所有站源设置页图标的统一前缀，`public static volatile String` 非 final，可直接写。`FishConfig` 单点改写不够（其它 67 处站源直接读 `x1.s` 拼接，不经 FishConfig）。

**三层兜底**（PVB.rewriteIcons）：
1. 硬编码旧 base（`https://tc-new.z.wiki/autoupload/k2fxc/configicon/`）整体替换为 `<config 目录>/ico/`（取不到则回退 `https://cnb.cool/dodgezhang/tvbox/-/git/raw/main/moyu/ico/`）
2. 运行时反射读真实 base（`x1.s` 当前值）做替换
3. 按已知图标文件名（`115.jpg`/`baidu.jpg`/`go.jpg`/`settings.jpg`/`android-os.png`/`link_ok.jpg` 等 50+ 个）正则兜底，任何图床域名都能覆盖

**持续守护**（PVB.boot 内 scheduleWithFixedDelay）：
- 启动期 tick 1~30 每 2 秒一次 `overrideIconBase()` 抢解密窗口
- 稳态 tick % 15 == 0 每 30 秒一次兜底，应对解密状态机任意时刻 sput 回写

`overrideIconBase` 直接反射 `x1.getDeclaredField("s").set(null, want)`，比较 cur != want 时才写，避免无意义 put。

### 4. 重打包与 md5 同步

1. **打包 dex**：`java -jar smali.jar assemble smali/ -o classes.dex`（多 dex 时逐个 assemble，原 dex 结构保持不变）
2. **重组 jar**：用 Python `zipfile` 把新 dex + 原 assets（含新加的 `pvideo-*`、`pvideo.md5`）+ 原 META-INF（按需重签名）写入新 jar；**保持 zip 不压缩级别与原 jar 一致**（FongMi 系对 deflate 级别不敏感，但 STORED 与 DEFLATE 混用会导致某些壳子校验失败，统一 DEFLATED level 6 最稳）
3. **算 md5**：`certutil -hashfile new.jar MD5` / `Get-FileHash new.jar -Algorithm MD5`
4. **同步配置**：更新 `config.json`、`my.json`、`old.json` 中 `spider` 字段，格式 `./jar/<jar名>.jar;md5;<新md5>`（注意 jar 名必须与仓库实际路径一致）
5. **图标清单**：确保 `moyu/ico/` 下所有引用的图标文件都存在（直播类 16 个 + 文件管理器 11 个 + 网盘状态 4 个等），CNB 仓库路径与 PVB.FALLBACK_ICON_BASE 一致

### 5. 网盘播放 403/412 排查（先证伪，再改 jar）

铁律：**先拿运行时证据再下结论**。"多线程被封""UA 不对""TLS 指纹"都是猜，必须在手机本机用设备 curl 对同一条新鲜直链做对照矩阵。

1. **线程阶梯证伪**：用 register 得到的会话 token 直接打 `/feimao/go/uc/1t/<id>`…`/128t/<id>`。若 **1 线程也 403**，立即排除并发方向。
2. **抓真实 register 报文（无 root 抢端口拦截链）**——APP 私有 pvideo 的出站流量常规手段抓不到，用"第二份二进制 + 双向 adb 映射 + PC 中间人"：
   - 设备另起一份 pvideo：push 二进制到 `/data/local/tmp/pv` 并 `chmod 755`，`nohup ./pv -listen 127.0.0.1 -port 1315 -wallpaper-port 0 -data-dir /data/local/tmp/pvdata &`（**`-listen` 与 `-port` 是两个独立 flag，连写 `ip:port` 会报 `too many colons`**；`-h` 可列全部 flag）
   - 释放 1314：shell 用户 `kill` APP 子进程会 `Operation not permitted`，只能 force-stop APP（高风险操作，**必须请用户手动划掉/强行停止或显式授权**），轮询 `ps -A -o NAME | grep '^pvideo-arm'` 等待退出
   - `adb reverse tcp:1314 tcp:1314`（设备 APP/JVM 连 127.0.0.1:1314 → PC 拦截器）+ `adb forward tcp:1315 tcp:1315`（PC 拦截器 → 设备 1315 真 pvideo）
   - PC 跑 `ThreadingHTTPServer` 拦截器：HTTP/1.1、转发时剥 hop-by-hop 头、上游无 Content-Length 时自己发 chunked 并流式写结尾 `0\r\n\r\n`；对 `/feimao/register` 的 body 落盘（**body 含完整 Cookie，属敏感凭证，日志不外传、不打印、用完即删**）
   - 拦截器还能**实时改写 JSON 再转发**（替换 body 后同步改 Content-Length），用于在动 jar 前做端到端验证
3. **设备 curl 头矩阵**（直链来自 register body，几小时有效；必须在设备上跑，保证同出口 IP）：全头 / 无 Cookie / 无 Referer / 无 UA / 不同 Range（256K、1M、中间段、开放区间）/ h1 vs h2。
4. **交替复测排除时间相关混淆**：若某个头一变就通，按「禁→放→放→禁」背靠背交替 3 轮（间隔 2s）。只有稳定复现才算命中，防止把 CDN 冷却/IP 限流误判为头差异。
5. **修复落地优先改最小面**：UC 案中 `driveReferer()` 常量同时被取 token 的 UC API 和播放头使用，直接改常量会污染 API 链路；正确做法是**在 UcYun 重写 `headers()`**：`invoke-super` 拿 HashMap 后只 `put("Referer", "https://drive.uc.cn/")`，夸克类不动。
6. **端到端验收**：拦截器改写验证能播 → 再改 smali 重打包 → 拆链（reverse/forward 移除、第二份 pv kill、PC 后台停）→ 用户重启 APP 重载配置拉新 jar → 完全走真实 pvideo 复测。

### 6. smali 重打包防丢类

`smali assemble` 成功 ≠ 类完整。每次重打包后必须用 Python 解析 dex 头核对：`0x60` 处读 `class_defs_size/off`，经 `0x40` type_ids、`0x38` string_ids 还原每个 class_def 的描述符，确认**类总数与原 dex 完全一致**（aidaox 为 3999）且关键类（Init/UcYun/QuarkYun/gate 等）都在。**丢类根因（cb5976c）**：用于 assemble 的反汇编目录本身不完整（部分类从未 baksmali 出来），汇编器不报错、静默少类 → 全源无法加载。防范：①改类前先对原始 dex 跑一次 baksmali 全量导出作为汇编源；②assemble 后立刻比对 class_defs 数；③加类优先用 dexlib2 类级合并（只增不改）。重组 jar 只替换 `classes.dex`，其它条目原样回写，先复制一份 `.bak_<原因>` 再原地覆盖生产制品（覆盖需用户明确授权）。

### 7. Gate 远程验证中和（四刀）

**定位方法**：症状有两类——①"APP 一加载该 jar 的接口就闪退/被杀"（作者关服务器或远程下发 kill）；②**不闪退但弹模态验证框**（标题"验证"、输入口令、扫码输入/确定按钮，2026-09 作者新增）。先 `adb logcat`（无过滤抓崩溃栈，注意先 `grep -vi cookie` 脱敏）拿异常栈类名，再在 smali 树搜 `gate/verify/license/auth/check` 等包名与字符串（远程 URL、`isAllowed`、`kill`、`System.exit`/`Process.killProcess`），顺藤摸瓜到决策方法。aidaox 系落点：`com/github/catvod/spider/gate/`（`RemoteGate`/`GatePolicy`/`GateDialog`/`GateConfig`/`GateCrypto`/`GateSecrets`）。

**字符串全加密时怎么找弹窗**：明文 grep "口令/扫码/验证" 零结果——所有 UI 文案经 `Lcom/github/catvod/spider/obf/Str;->u(String)String` 解密（const 全是 `\u4e4d…` 移位串）。不要试图解密，直接按**结构特征**定位：`gate` 包里找带 `EditText`/`AlertDialog`/`CountDownLatch` 的类即弹窗本体（`GateDialog`：`a()` 构建视图、`b()` 校验 sha256、`showAndWait()` 用 CountDownLatch+AtomicBoolean 阻塞等用户点确定）；再 grep `showAndWait` 的调用方上溯触发链（`RemoteGate.a()`：jarEnabled → `GatePolicy.shouldShowGate()` → 弹窗 → 失败置 c=false/killNow）。

**四刀改法**（只改决策点，不动任何调用点，波及面最小）：
1. `RemoteGate.isAllowed()Z` → `const/4 v0,0x1; return v0`
2. `GatePolicy.killNow()V` → `return-void`
3. `GatePolicy.applyAction(String,String,I)V` → `return-void`（另可把 `checkPackage()Z` 改返 true）
4. **`GatePolicy.shouldShowGate(GateConfig)Z` → 恒返 false**（弹窗决策点；前三刀已在但弹窗仍出现就是缺这一刀——作者可远程动态下发 `gateEnabled:true`+`gatePasswordSha256`，`gateMode`（always/session/interval）判定未验证即弹窗，与闪退链相互独立）：

```smali
.method public static shouldShowGate(Lcom/github/catvod/spider/gate/GateConfig;)Z
    .registers 1
    const/4 p0, 0x0
    return p0
.end method
```

跳过弹窗后 `RemoteGate.a()` 继续走正常分支置放行标志、写 SharedPreferences，源照常加载；`GateDialog`/`showAndWait` 本体与 4 个调用点一概不改。前两刀提交参考 `00b02dd`，第四刀 2026-09-23 实测通过（备份 `.bak_gate`）。

#### 7.1 彻底断网：砍除 GateConfig 全部远程下发（断网两刀）

四刀只中和决策，作者服务器仍在每次启动下发 60+ 字段的总控 JSON。要求"砍掉所有作者远程下发"时，先认清链路再在 `RemoteGate` 上断两处：

- **启动链**：`Init` → `RemoteGate.bootstrap()`（`merge/c/d0` 线程）→ `b()`（DCL，标志 `a:Z`=已初始化）→ `c()`：`OkHttp.string(GateSecrets.controlUrl())`（URL 来自 `HxqNative.gateControlUrl()` native，catch 用 `GateSecrets` 加密数组+`Str.d` 硬编码兜底）→ `GateCrypto.decrypt`（AES，key/iv 在 GateSecrets/native）→ `GateConfig.fromJson` → 写 SharedPreferences → `a(config)` 执行策略：jarEnabled 封杀、`shouldShowGate` 弹窗、**公告 Toast**（Notify.show）、**keepalive 调度**（`merge/h/M8`+`L8`/`s0(0x15)`，用用户夸克/UC/迅雷/百度/广雅 cookie 定时 bgSaveOnce 转存作者的 5 家网盘分享链接）。
- **手动刷新链**：`refreshSoft()`（PandoraUi/XueLuoUi 入口）**绕过 b() 直接调 c()**，只断 b() 会漏。
- **配置消费面**（`getConfig()` 内部先调 b() 再返回静态 config）：BinMarket、LiveProxy（liveTxtUrl）、NtvLive/NtvSoLoader（ntv*）、Proxy/F0（danmuTip）、Bh（pvideo goUseCdn/goCdn*）、L2（4 处：quarkAppStoreJson、panRecruit*、zhuiXin*）、XueLuoUi（xueluoHubPass）、PromoHelper（广告/拉新）。

**断网两刀（只改 RemoteGate 两个方法，状态刻意复刻原"联网失败 catch 分支"——该安全状态 APP 本来就能正常跑，无需逐字段审计）**：
1. 重写 `b()V`：保留双重检查锁结构；锁内直接 `sput GateConfig.empty()`，置 `b:Z=0/c:Z=0/a:Z=1` 后 `return-void`；**不调 c()、不调 a(config)**（因此无公告 Toast、无 keepalive 调度）。
2. 重写 `c()`：方法体只剩 `invoke-static GateConfig;->empty()` + `move-result-object v0` + `return-object v0`（启动链与 refreshSoft 两条联网入口同时失效；原 OkHttp/解密/写 SP 代码整段移除）。

**为什么必须跳过 a(config)**：empty 默认值里 `noticeEnabled=true` 且 noticeText 是非空硬编码串、noticeMode=interval、interval=7 天——`a(empty)` 会在首次/隔 7 天弹作者默认公告 Toast；原联网失败 catch 分支恰好**不调 a()**，复刻该分支即零回归。keepalive 侧：`M8.d()`（GateSpider/Proxy/PromoHelper 正常流程会调）开头判 `M8` 静态 GateConfig 字段为 null 即 return；未进 a() 该字段永远 null、`M8.a:AtomicBoolean` 永远 false，Q/S/u0/a6 里的网盘转存搭车钩子全部短路。`RemoteGate` 的 `b:Z/c:Z` 经 grep 确认全树只有写没有读。

**动手前 grep 一遍 getConfig 消费点确认 empty 兜底**（本 jar 实测）：LiveProxy 空 liveTxtUrl 走 `GateSecrets.liveTxtFallback()`；Bh 空 CDN 只用 JSON 自带 url（jar 内置 4-ABI pvideo 优先不受影响）；L2.c5/k/u1/v1 各有硬编码兜底（shareId 列表/网盘官网/gyz key/jk.catvod.site txt）；BinMarket `pandoraShowEnabled=false` 时隐藏 Pandora 入口；detailAd/playFromAd/ntvLive/goUseCdn/keepalive 默认全 false。**不要误砍**：`Hxq`/`HxqCrypto`/`HxqNative` 是站点签名加密业务、`Xjj.xjjConfigUrl` 是该源自身配置、`binmarket/PandoraEngine`/`PackageConfig` 是用户主动进实验室才跑的 jar 市场（默认入口隐藏）——均非静默总控，砍了影响接口正常运行。

2026-09-23 断网两刀实测版本：aidaox jar md5 `e78d86355ecbfd17d474f7b6ce2b00c5`，备份 `.bak_noremote`（上一版四刀 md5 `9d13176b…` 备份 `.bak_gate`）。

**动手前必做一致性核对**：补丁用的 smali 工作目录可能是旧 jar 的反汇编（jar 事后被大幅改过，体积都可能差几倍）。必须从**现行生产 jar** 重新解出 `classes*.dex` baksmali，与工作目录的 gate 类逐文件比对（注意 baksmali 输出可能仅 CRLF 行尾差异，规范化 `\r\n→\n` 后再比），确认同源再 patch；先列 dex 确认单/多 dex。

**设备侧解锁（弹窗 modal 且 setCancelable=false，返回键无效，进不去设置换配置时）**：输错口令点确定——`gateFailAction` 为 kill 分支时 `killNow()` 已被第 2 刀中和、fail runnable 会释放 latch 关闭弹窗且不杀 APP，借此窗口进设置。测本地补丁包不必推远程：仓库根 `python -m http.server <port>` + `adb reverse tcp:<port> tcp:<port>`，APP 里新增点播配置填 `http://127.0.0.1:<port>/pangmao/pm.json` 即可拉到本地 jar。坑：魅族中文 IME 会把 `adb shell input text` 的拉丁串当拼音上屏且吞特殊字符，切纯拉丁 IME 无效时改用 `am start` 深链或请用户手输。

### 8. 跨 jar 爬虫源缝合（观影 Gying 免 cookie 案例）

需求：A jar（pangmao/aidaox）里某 csp 源免 cookie 可用，B jar（moyu/950055803）里同名源要手工 cookie。提交链 `f7e9e65 → bcfca9f → bba7052 → a824771 → 7fbd278`。

1. **先对比，别急着搬**：两个 jar 反汇编后找同名 spider 类（本例都是 `com/github/catvod/spider/Gying.smali`，配置 `api: csp_Gying`）。对比类规模/字符串：新版（pangmao，14845 行，const 全是 `\u4e4d…` 这种移位加密串）已不依赖 cookie；老版（moyu，13531 行）有 `saveCookie/getSavedCookie/clearCookie`，只从 `ext.cookie` 读手工 cookie。站点是同一批中文 IDN 域名（`https://www.教父.com` 等，配置里写中文或 punycode `xn--…` 均可）。
2. **方案 A（不推荐）**：把 A 的整个 dex 作为 classes2.dex 注入 B（`csp_Gyinx`）。jar 从 10.76MB 膨胀到 14.13MB（拖入大量无关类与依赖），且多 dex 合并易出幺蛾子。
3. **方案 B（采用）**：**子类继承 + 只编译新类 + dex 类级合并**：
   - 写 `GyingFix extends Gying`，只 override 需要的生命周期方法；编译时不依赖原 jar，用**手写 stub**：建同名 `Gying.java` 只声明用到的父类/父方法签名（`init(Context,String)`、`static getCurrentSiteUrl()/saveCookie()/getSavedCookie()/clearCookie()`，方法体空），`javac -cp stub目录:android.jar` 编过即可
   - d8 只把 `GyingFix.class` 编成只含一个类的 dex（stub 不进 dex），再用 **dexlib2 类级合并**进原 classes.dex（Merge 只加类，不整 dex 替换——不膨胀、不丢类）
   - 配置把该源 `api` 改成 `csp_GyingFix`（csp_ 后即类名），ext 的 cookie 留空
4. **观影站 PoW 反爬协议复刻**（站点 JS 工作量证明，cookie 三件套 `browser_pow`→`browser_verified`→`app_auth`），在 `init()` 里 `super.init` 后执行：
   - GET 站点根，`setInstanceFollowRedirects(false)`，从 Set-Cookie 取 `browser_pow`
   - 带它 GET `/res/pow` 拿 challenge 原文
   - POST challenge 到**外部解算服务器**（设备端跑不动该 PoW；独立 HTTP 服务，读超时放到 90s），返回 JSON 取 `y`
   - `application/x-www-form-urlencoded` POST `y=<编码>` 回 `/res/pow`，从 Set-Cookie 取 `browser_verified`
   - 再 GET 一个固定分发地址拿 `app_auth`，拼成 `browser_verified=…; app_auth=…` 调父类 `saveCookie()`
   - 全程 try/catch 吞掉并打 log（解算失败不影响 APP，只是该源不可用）
5. **WebView 方案的坑（先走的弯路）**：曾想用 WebView 加载站点让其 JS 自己解 PoW 再钩 Cookie——spider 无 Activity 环境时 View 未 attach，`view.postDelayed` **永不执行**（要改用独立 `new Handler(Looper.getMainLooper())`，提交 `a824771`），且 WebView 链路重且不稳，最终被外部解算服务器方案取代。
6. **后续维护**：B jar 后来整体换版（`4d42f62` 换成 `466454997_2_*.jar`）时 GyingFix 不会自动迁移，需在新 jar 上重做子类合并；换 jar 后先确认目标类与父方法签名是否仍在。

### 9. 更新 jar 外独立分发的 Go 代理（moyu/go 模式，取 go_version.json）

适用：仓库 `moyu/go/{dev,stable}/` 独立存放 pvideo（4 ABI）+ libfishgo.so（4 ABI）共 16 个二进制，`moyu/go/go.json` 是 dev/stable 两段、每段 16 字段（8 个 sha256 + 8 个 zip url）的 manifest。用户说"更新一下 go/so"时走本节，**不动 jar**。注意 `moyu/go/` 在仓库 `.gitignore` 中（`/moyu/go/`），更新后 `git status` 无变化属正常，属本地分发文件。

**2026-10-25 起的新链路（优先按此执行）**：
- manifest 固定为 **`https://6800.kstore.vip/go_version.json`**（明文 JSON，`Content-Encoding: gzip`），dev/stable 两段、每段 8 个 `<abi>[_so]_url` + `<abi>[_so]_sha256`。旧的 `tc-new.z.wiki/.../go.json` 已废弃（16 个 URL 全 404），**新版冷启动不再请求任何 go.json**。
- 下载地址是 `eos-huhehaote-1.cmecloud.cn` 的 **S3 签名 URL**（`moyuer-<8hex>.zip`，`X-Amz-Expires=86400` → **24 小时后过期**）；`go.json` 只能保存当前批次快照，过期后重新拉 `go_version.json` 即可。
- APP 把二进制存到私有目录 `files/moyu_go/pvideo-stable-<abi>-<sha256>`（文件名 sha256 = 清单期望值），只下载当前 ABI 的 pvideo；`_so_*` 仅 SO 模式使用。
- 实测启动参数：`pvideo -port 5266 -danmu-dir <files>/fishdanmu -x-cache <cache>/pvc -x-startup`；APP 对就绪状态只等约 20s，超时即杀进程并重试（`[GoProxy] start failed ... reason=就绪等待超时`）。

**取清单的两条路**：
1. **root 模拟器（最快，推荐）**：雷电等模拟器开 root + 装同版本 APP，`adb shell su -c` 可直接读写 `/data/data/com.silent.android.webhtv/`。mitm CA 装成**用户证书**：`/data/misc/user/0/cacerts-added/<subject_hash_old>.0`（`chmod 644`、`chown system:system`、`restorecon`）；LDPlayer 的 `/system` 通常 remount 失败，别走 `/system/etc/security/cacerts`。`subject_hash_old` 用 `openssl x509 -subject_hash_old` 或 Python cryptography 对 DER subject 做 MD5 取前 4 字节小端。设置 `http_proxy` 后**清空 `files/moyu_go/` 再冷启动**，APP 会重新拉清单并下载；抓完 `settings delete global http_proxy` 等三项，并 `adb reboot`（APP 可能缓存 OkHttp 代理，只删设置仍连旧代理）。
2. **无 root 真机 MITM**：`POST https://fast.wya6.com/d.php`（旧域名 `www.y456y.com/moyu/d.php`）是 FishGuard 加密，**不要离线解密**；明文的是随后的 `GET https://6800.kstore.vip/go_version.json`。**冷启动挂全局代理可能让 go 代理起不来**（2026-10-25 魅族20实测：代理存在时 pvideo 只监听 5266，APP 20s 判超时），抓完必须删三项代理设置并冷启动恢复。

**下载与落地**：
- dev/stable 一般完全相同 → 只需下载 8 个唯一 zip（4 ABI × pvideo/so），每个 zip 内单文件；`curl -L` + `UA okhttp/5.4.0`。
- 解压后**逐文件**按 `<abi>_sha256`/`<abi>_so_sha256` 校验，任一不符立即中止；按 `pvideo-<abi>`、`libfishgo-<abi>.so` 落盘。
- `go.json` 用**按 key 正则替换**（保留原缩进/CRLF，不要 json.dumps 重排），dev/stable 分块替换；落盘后重算 16 个文件 sha256 复核。
- 覆盖前先整目录备份到 Temp（如 `Temp/moyu_go_emu/old_backup`）。

#### 9.1 本次实测坑（2026-10-25）
- **arm64 构建 sha 对但起不来 ≠ 下载损坏**：清单 sha256 与设备文件名一致只说明文件完整。实测 arm64 `726cf488…`（FishGo 15.1.0）在魅族20只监听 5266 且 20s 探活超时；同 APP 在模拟器 x86 构建上曾 `healthy=true`，属构建/设备相关。先用 APP「Java多线程」兜底，等作者修复，别反复重下。
- **端口取证**：`netstat -lntp`（root）或 `/proc/net/tcp`（hex：5266=`1492`、1314=`0522`）；`ps -A -o PID,NAME | grep pvideo` 看真实运行的二进制名。
- **读不到私有目录**：真机非 debuggable 时 `run-as`/`ls /data/user/0/...` 全拒绝；要取二进制/清单只能用 root 模拟器。
- **抓包落盘是 raw_content**：`go_version.json`/`d.php` 都带 `Content-Encoding: gzip`（首字节 `1f 8b`），先 `gzip.decompress` 再 `json.loads`。
- **代理残留**：`settings delete global http_proxy` + `global_http_proxy_host` + `global_http_proxy_port`；真机/模拟器若仍连旧代理，冷启动或 `adb reboot` 后恢复。
- **`moyu/go` 不在 git**：已被 `.gitignore` 忽略，更新后无需也不能 git 提交。

## 常见坑

| 现象 | 原因 | 修复 |
|---|---|---|
| 5266 退出重进失活 | dex 内 Go so 未被引用，或官方 J0() 因授权服务器关闭返回 false | 注入 PVB.boot，每 20s 看门狗 |
| jable.tv 拦截 py 源 | Cloudflare Managed Challenge | Session 持 Cookie + 完整浏览器头 + extend 配 `cf_clearance` + UA（详见 `huangju/ext/jable.py`） |
| hanime1.me 不拦截 | 服务端未启用质询 | 朴素 `self.fetch` 即可 |
| 图标只在 FishConfig 页显示 | 只改了 FishConfig JSON 出口，其它站源读 `x1.s` 拼接未覆盖 | 反射改写 `merge.A.x1.s` + 轮询守护 |
| 改完 x1.s 后图标又消失 | `np.protect` 解密状态机任意时刻 sput 回写旧 base | 启动期 2s 一次抢窗口，稳态 30s 一次兜底 |
| 反射调用 `np.protect.*` 解密返回 null | 解密依赖状态机初始化 | 放弃一次解密，改用轮询改写 x1.s |
| xs_v7a.bin 启动后 5266 不通 | 命令行参数不匹配 | 确认支持 `-port` flag；不传 `-host`（FishGo 默认监听 loopback） |
| 新 jar md5 校验失败 | dex 合并顺序/压缩级别与原 jar 不一致 | 用 `Get-FileHash` 重算，统一 DEFLATED level 6 |
| x86 模拟器跑 armeabi-v7a jar | JNI so 探测 ABI 失败，官方 J0() 直接放弃 | PVB 自行 ELF 头排序启动，不依赖 JNI |
| 网盘直链在线播放 412（夸克典型，UC/百度正常，Tengine 页） | **真因（2026-09 实锤，推翻早期"UA 丢弃"误判）**：arm64 tvbox-pan-proxy 的 `main.parseHeaderQuery` 先 `req.URL.Query().Get("header")`（已做一次 form 解码），又对值调一次 `net/url.unescape`——双重解码把 Cookie 里的 `+` 全部变成空格（任何 `%xx` 也会二次解码），Tengine 鉴权失败返回 412；与 UA/TLS/IP 无关。早期在 v7a 上 NOP 掉的两处 memequal 比较的其实是 "connection"（0x4dade）不是 user-agent（0x4dad4），补丁无害但无意义 | arm64 补丁点 `parseHeaderQuery+0x88`（vaddr 0x2fceb8，文件偏移 vaddr-0x10000）：`bl net/url.unescape`(0x97f9b0da) 改成 `mov x2,#1`(0xD28000022)，后续 csel 即选择原始（Query 解码后）字符串。**验证方法是手机本机对照实验，见下两坑**，勿在缺运行时证据时猜 UA |
| 412 排查方法论：先证伪再 patch | PC curl 全 412 曾误导为"UA 无关"——PC 出口 IP 不同，auth_key 可能绑 IP，且直链有时效；单看日志反汇编极易走偏 | 用 APP 内运行的看门狗把二进制/日志导出到 externalFilesDir（release 包 run-as/root 全拒，只能走这条）；`logcat -s TV-player:D` 抓完整入站 URL（含 header JSON）；**用设备自带 `/system/bin/curl` 在手机本机做矩阵实验**（同 IP，-K 配置文件，选项与参数必须同行写）：①直连全头（Cookie+UA+Referer）②无任何头 ③仅 UA ④仅 Cookie ⑤经 Go 代理带/不带 header。实测结论：直连无 Cookie=412、有 Cookie=200；Go 不带 header=200（代理对夸克域名自带默认头）、带单层编码 header=412、带双层编码 header=200（坐实双重 unescape） |
| arm64 设备从不运行 v7a 二进制 | ABI 排序中官方 J0() 下载的 arm64 优先；jar 注入的 v7a 永远不会被选中 | patch 前必须 `adb shell ps -A -o PID,NAME | grep pvideo` + 读 `/proc/<pid>/cmdline` 确认**实际运行的 ABI、路径、启动参数**，再对对应二进制下手 |
| Go1.20+ f1 pclntab 地址错位 | f1 头里 textStart 字段为 0，但 functab entryoff 相对实际 `.text` sh_addr（本机 arm64 二进制是 0x11000，.text file off 0x1000）；直接按 textStart=0 算地址会把字符串 xref 误归到 crypto/fips 函数 | 解析符号时 `真实vaddr=entryoff+0x11000`，文件偏移=`vaddr-0x11000+0x1000`；关键函数：`main.handleStream/parseHeaderQuery/proxyHead/proxyPass/probeURL/rangeMultithreadStream/applyHeaders`；反汇编用 capstone 时开 `skipdata=True`（`skipdata_setup=('.byte',None,4)`）否则无效指令字产生地址空洞 |
| 覆写运行中的 ELF → ETXTBSY / 旧进程重启竞争 | kill 后官方 s0 管理器可能抢先重启原路径二进制，PVB 释放窗口与之竞争 | 先发版：把 md5 不符的二进制 `renameTo(".<name>.bak")`（点文件不被 listCandidates 扫描选中，旧进程继续持有旧 inode）→ 立即 `extractEmbedded` 写新文件到原路径 → 再 kill -9；这样无论谁重启拉起的都是新二进制 |
| 想从其他 jar（如 wangerxiao `7674fec9*.jpg`）提取 Go 代理 | Wex 系框架无独立 Go 代理：`DexNative.getLoader/getSpider/proxyInvoke` 全是 native，整套 spider 加密在 `wexshinidie.guard`（非 ELF 密文，由 `wexguard_v7/v8.so` 运行时解密），提取需逆向解密 so | 确认无独立二进制后转向 patch 现有 FishGo 或找同系官方构建 |
| patch 二进制后刷新接口仍报 412，Java 代理正常 | 进程生命周期：刷新接口只重建类加载器，旧 Go 进程存活；PVB `ensure()` 第 0 步 `ping 通 && adopted → return` 直接采纳旧进程，patched 二进制从未运行；且旧进程执行中时 `extractEmbedded` 覆写会 ETXTBSY 失败被吞 | PVB 增加版本一致性检查：首查读 `assets/pvideo.md5` 清单逐项对比 filesDir md5，不一致则 `ps -A` 找 pvideo 进程 kill -9 → 等端口关闭 → 重释放重启；每类实例只查一次防抖 |
| Go 符号/字符串分析工具 | — | v7a：`go_sym.py`/`go_dis_one.py`；arm64：`go_sym64.py`（f1 pclntab，自动修正 0x11000 基址）、`go_dis64.py <lo> <hi>`（capstone SKIPDATA，adrp+add 字符串注释）、`find64_scan.py`（adrp/add 字符串 xref）、`find64_calls.py`（BL 目标调用方扫描）；符号 pickle `go_funcs_arm64.pkl`，均在 Temp 下 |
| UC 原画 Go 代理全部 403，1 线程也 403（2026-09 实锤） | **不是并发问题**。UC 签名直链（`*.pds.uc.cn`，AliyunOSS）URL 内嵌 `callback=`（base64 JSON，`callbackStage=before-execute`，`callbackUrl=https://auth-cdn.uc.cn/outer/oss/checkplay`，回调模板引用 httpHeader 的 host/range/**referer**/cookie/method/x-urlp 与 clientIp/queryString.client_token）。该回调对 Referer 做精确匹配：`Referer: https://drive.uc.cn`（无尾斜杠）→ 403 `RequestDeniedByCallback` / `forbid[deny]` / `x-oss-ec: 0007-00000209`；`https://drive.uc.cn/` 或**完全不带** Referer → 200/206。无 Cookie → 403 `require login [auth not found]`；UA/h1/h2/Range 大小与位置均不影响；HEAD 另有 `0002-00000040` 但播放器不用 HEAD | 在 `UcYun` 重写 `headers()`：`.registers 4`，`invoke-super {p0} QuarkYun->headers()` 得 HashMap，`put("Referer","https://drive.uc.cn/")` 返回。**不要改 `driveReferer()` 常量**——它还被 `createOwnShare` 等取 token API（pc-api.uc.cn）使用。夸克无此 callback，QuarkYun 不动 |
| 无 root 抓 pvideo 回源报文 | APP 私有进程，`run-as`（非 debuggable）/`kill`/`/proc/<pid>/exe` 全拒；pvideo.log 在 filesDir 读不到；子进程不走 adb reverse 的回环（假源 sink 场景：sink 绑 127.0.0.1 时子进程连不通，必须 0.0.0.0 + 局域网 IP） | 抢 1314 拦截链（工作流第 5 节）：APP/JVM 侧走 `adb reverse` 有效；设备第二份 pvideo 监听 1315，PC 拦截器经 `adb forward 1315` 回源；用 `/feimao/register` 真实 body 拿直链+headers |
| `-listen 127.0.0.1:1315` 启动失败报 `too many colons`/`address ...:1314` | pvideo 把 `-listen` 当纯 host，port 由独立 `-port` 决定（默认 1314）；另有 `-wallpaper-port`（默认 5266，0=关闭）、`-data-dir`、`-danmu-dir`、`-iptv-auth-token`；`-h` 可列全部 | `pv -listen 127.0.0.1 -port 1315 -wallpaper-port 0 -data-dir <dir>`；先 `curl 127.0.0.1:1315/ping` 应回 `ok` |
| 想 kill APP 的 pvideo 做端口接管 | shell(uid 2000) 与 APP(u0_a*) 不同 uid，`kill <pid>` 直接 Operation not permitted；`am force-stop` 属高风险中断用户会话，需显式授权或请用户手动强行停止 | 设备放轮询脚本等 `pvideo-arm` 消失后立刻 `adb reverse`；接管后先 `/ping` 验证链路，再用假 register（指向 PC 假源）验证 register→go 全链路 206 |
| PC 起的 Python 假源/拦截器一会儿就死 | 普通前台/Start-Process 起的 python 随沙箱命令结束被杀，设备随后 connection refused/502 | 用 `run_in_background:true` + `dangerouslyDisableSandbox:true`；监听 `0.0.0.0`；拦截转发用 HTTP/1.1 + chunked 收尾，避免客户端挂死等 Content-Length |
| PowerShell/adb 组合命令各种引号损坏 | PS5 不支持 `&&` 与 heredoc；curl 是 IWR 别名（用 `curl.exe` 或设备内 curl）；`&` 是 PS 保留字；`$(...)` 被 PS 先解析；设备 sh 不支持 `for` 单行经 adb 传参 | 复杂逻辑一律写 `.sh`，push 后 `adb shell sh /data/local/tmp/x.sh`；设备 curl 不支持 `-K` 时用 `-H 'K: V'` 内联，长 Cookie 用单引号变量 |
| 设备端手动复刻 UC 取链总返回 `{status:500,code:15000}` | 缺 APP OkHttp 封装注入要素（设备指纹/TLS 栈/内部 header），参数（`pr=UCBrowser&fr=pc&uc_param_str=&__t=`、body pwd_id/passcode）核对无误也拿不到 download_url | 放弃手动取链，改走拦截 register 直接拿 jar 已取好的签名直链；不要在此纠缠 |
| register 抓包泄露凭证 | register body 的 `headers.Cookie` 是网盘完整登录态（ctoken/Video-Auth/__puus 等） | 落盘日志只留本机临时目录，不外传不打印；分析脚本只输出 host/长度/headerKeys 摘要；验证完删日志；fileToken/shareId 属分享参数可用 |
| feimao 接口契约不清 | — | `POST /feimao/register` JSON 必填 `id`+`url`（缺回 missing id or url），可选 `thread`/`chunk`/`headers`(map)/`header`；播放走 `GET /feimao/go/<site>/<N>t/<id>`（缺段 400，旧 token 404 session not found）；单次透传 `GET /feimao/get?url=<编码>`（客户端 UA 透传）；分片首片 256K 后 512K |
| 缝合源：整体注入 A 的 classes2.dex 后 jar 巨大且类冲突 | 整 dex 拖入 A 的全部无关类/依赖（10.76MB→14.13MB），多 dex 还可能改变壳子加载顺序 | 子类继承（XxxFix extends 原类）+ stub 编译 + d8 单类 dex + dexlib2 类级合并；只增一个类，jar 几乎不变大；配置 `api` 指向 `csp_XxxFix` |
| 编译子类拿不到父类 | 原 jar 里的父类是混淆/壳内类，正常 javac 缺符号 | 手写 stub：同包同名空类，只声明要调用/重写的方法签名（含静态方法），方法体空返回；javac `-cp stub;android.jar`；stub 只供编译，不打进 dex |
| WebView 解站点 JS 挑战在 spider 里不执行 | spider 无 Activity，View 未 attach 到窗口，`view.postDelayed` 任务永不触发 | 用 `new Handler(Looper.getMainLooper())` 调度；更稳的做法是放弃 WebView，协议复刻（直接 HTTP 走 challenge→solution），算力密集的 PoW 交给外部解算服务 |
| 观影站无 cookie 全挂（browser_pow/app_auth/browser_verified） | 站点 JS PoW 反爬：根路径先发 `browser_pow`，`/res/pow` 下挑战，解对后才给 `browser_verified`，另有 `app_auth` | init 中按 6 步复刻（见工作流第 8 节）：根路径取 browser_pow（禁自动重定向）→GET /res/pow→外部解算服务器算 y→POST y 回 /res/pow→取 app_auth→合并后 `saveCookie()`；ext.cookie 置空 |
| 换了新版宿主 jar 后缝合源失效 | 子类是 dex 合并进旧 jar 的，jar 整体换版后新 dex 里没有该类；父类方法签名也可能变 | 换 jar 后重新执行一遍"找父类→核签名→stub 编译→类级合并"，并在配置 md5 更新后实测该源 |

## 参考实现

**注意：以下逆向产物仅本地保留，不进 CNB 公开仓库，防止原开发者代码被滥用。**

- PVB 源码（仓库内 _local，不进 CNB）：`d:\交投资料\相关文档\07-Git文件\Cnb\tvbox\_local\reverse\PVB.java`
- 完整逆向产物（仓库内 _local，不进 CNB）：`d:\交投资料\相关文档\07-Git文件\Cnb\tvbox\_local\reverse\`（含 PVB.java 源码副本 + 全量 smali 反汇编，1379 个文件）
- 已缝合 jar（公开仓库）：`d:\交投资料\相关文档\07-Git文件\Cnb\tvbox\moyu\jar\950055803_4_1788301315144.jar`（md5 以 config.json spider 字段为准，当前 `a6826087918252eeaf42e701643bcf44`；内含 patched `pvideo-arm64-v8a` md5 `b1e84736694fe33f9f50511073ce41de` 与早期 patched `pvideo-armeabi-v7a`）
- PVB 编译链（本机无 javac）：`java -jar Temp\tools\ecj-3.16.0.jar -1.8 -cp Temp\android.jar -d build3 src\...\PVB.java` → `java -cp Temp\tools\r8-2.2.64.jar com.android.tools.r8.D8 --release --min-api 21 --output dex4 <classes>` → `Merge.java`（dexlib2 类级合并，classes2\Merge.class 已编译）
- 图标目录（公开仓库）：`d:\交投资料\相关文档\07-Git文件\Cnb\tvbox\moyu\ico\`
- 配置同步（公开仓库）：`d:\交投资料\相关文档\07-Git文件\Cnb\tvbox\moyu\config.json` / `my.json` / `old.json` 的 `spider` 字段

**运行时不依赖 reverse/**：TVBox 壳子加载 jar 内已编译的 dex 即可，`moyu/reverse/` 不参与接口加载，仅作为本地逆向参考。file:// 加载 config 时，PVB 拼出 `file://.../moyu/ico/` 路径读图，与 reverse 无关。

**aidaox 系列（feimao 架构，2026-09）**：
- 公开 jar：`pangmao/jar/aidaox-20260911-111534.jar`（Gate 四刀 + **远程总控断网两刀** + 防丢类重打包 + UC Referer 修复；2026-09-23 起 md5 `e78d86355ecbfd17d474f7b6ce2b00c5`，备份链 `.bak_noremote`/`.bak_gate`；每次覆盖前同目录留 `.bak_<原因>`）
- 配置：`pangmao/pm.json`、`pangmao/fm.json` 的 `spider` 字段（该系列不是 config.json/my.json）
- 反汇编工作目录（Temp，不进仓库）：`C:\Users\Dodge\AppData\Local\Temp\pangmao\smali2\`（3999 类），UC 相关在 `com/github/catvod/api/UcYun.smali`、`QuarkYun.smali`，feimao 注册/启动在 `com/github/catvod/spider/merge/h/L2.smali`、`J9.smali`
- 拦截链脚本范式（Temp\pangmao）：`intercept.py`（PC 1314 拦截转发+改写）、`startpv.sh`（设备 1315 第二份 pvideo）、`waitstop.sh`（等 APP 退出）、`gen_*.py`（从 register_log.jsonl 抽直链生成设备 curl 矩阵 .sh）
- 观影缝合工作目录（Temp，不进仓库）：`C:\Users\Dodge\AppData\Local\Temp\gyingfix\`（`src/.../GyingFix.java` 最终版 PoW 解算子类、`stub/.../Gying.java` 手写编译桩、`dex/classes.dex` 单类 dex）；两版 Gying 反汇编对照 `Temp\pangmao\smali2\com\github\catvod\spider\Gying.smali`（新版混淆免 cookie）与 `Temp\moyu_smali\com\github\catvod\spider\Gying.smali`（老版读 ext.cookie）；配置替换脚本范式 `Temp\update_gyfix.py`（UTF-8 无 BOM 断言、md5 与 api 双替换）

## 执行检查清单

- [ ] 原始 jar 已解包，smali 完整可读
- [ ] 关键类（s0/x1/Init/FishConfig）已定位并阅读
- [ ] Go 二进制 ABI 已识别，flag 支持情况已确认
- [ ] PVB.java 已按目标二进制调整 PORT/启动参数
- [ ] PVB.dex 已合并进 jar，Init.smali 已插入 boot 调用
- [ ] FishConfig.smali 已挂 rewriteIcons（可选，x1.s 守护已足够）
- [ ] assets/pvideo-* 和 assets/pvideo.md5 已写入 jar
- [ ] ico/ 目录图标齐全（50+ 文件）
- [ ] 新 jar md5 已算，config.json/my.json/old.json 已同步（PS5 写 UTF8 去 BOM，原文件无 BOM）
- [ ] 推送 CNB 仓库后实测 5266 通 + 图标加载
- [ ] patch Go 二进制前已 `ps -A` + `/proc/<pid>/cmdline` 确认设备实际运行的 ABI/路径
- [ ] 已在**手机本机**（非 PC）用 curl 做带/不带 Cookie 与经代理的对照实验，根因有运行时证据
- [ ] 刷新接口后经 logcat(PVB tag) 确认：stale 检测 → 改名 .bak → 释放 → kill 旧 pid → `pvideo up via` → adopted；并导出 filesDir 二进制核对 md5，最后经 5266 实测原失败请求 200 且 APP 端播放成功
- [ ] Gate 类改动仅四刀（isAllowed 返 true、killNow/applyAction 返 void、shouldShowGate 返 false），未动调用点/GateDialog 本体
- [ ] 要求彻底断远程时：`RemoteGate.b()` 直装 empty 且不调 a(config)、`c()` 直返 empty（覆盖 refreshSoft）；已 grep 全部 getConfig 消费点确认 empty 兜底，并反汇编新 jar 复核 RemoteGate 中已无 OkHttp 引用
- [ ] 重打包后已用 dex 头解析核对 class_defs 总数与原 dex 一致（aidaox=3999）且关键类齐全
- [ ] 403/412 类问题已先线程阶梯证伪（1 线程也失败即排除并发），再经抢端口拦截链拿到真实直链与 headers
- [ ] 头矩阵在设备本机完成，且疑似命中头已背靠背交替 3 轮稳定复现，排除冷却/限流
- [ ] 修复选在最小影响面（如重写 UcYun.headers() 而非改 driveReferer 常量），夸克等其它网盘不受影响
- [ ] 动 jar 前已用拦截器实时改写做过端到端验证（改写即能播）
- [ ] 覆盖生产 jar 前已有用户明确授权且留 `.bak_<原因>`；jar md5 与对应配置（pm.json/fm.json 或 config.json/my.json/old.json）已同步
- [ ] 实验环境已拆除：adb reverse/forward 移除、设备第二份 pv 与 *.sh 清理、PC 后台 python 停止、含 Cookie 的拦截日志删除
- [ ] 用户重启 APP 重载配置（拉新 md5 jar）后，完全走真实 pvideo 复测原失败资源播放成功
- [ ] 闪退类问题已从 logcat 崩溃栈定位到远程验证决策类，只中和决策方法（返回 true/void），未改调用点
- [ ] 跨 jar 缝合前已对比两边同名 spider 类的版本差异，确认缝的是行为差异而非配置差异
- [ ] 缝合采用子类+stub+单类 d8+dexlib2 类级合并（非整 dex 注入），jar 体积无明显膨胀，合并后类总数=原数+新增
- [ ] 子类 override 的父方法签名与 stub 一致；配置 `api` 已指向新 `csp_XxxFix`，ext 冗余 cookie 已清空
- [ ] 自动取证（PoW/cookie）逻辑在 init 中 try/catch 兜底，失败不闪退；WebView 调度（若有）用主线程 Handler 而非 view.postDelayed
- [ ] 换宿主 jar 版本后已重做缝合或确认新 jar 原生覆盖该能力，并实测该源可用
