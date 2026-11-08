# 游客身份解锁登录墙/成人确认（付费墙 API 站的突破技术，2026-08-24 绮梦短剧实证）

**场景**：API 站（如 shorttv.online 绮梦短剧）的 SENSITIVE/成人内容需要"登录+成人确认"才能返回播放链接，游客请求拿不到 playback_url。用户问"锁定集不能解锁吗？想办法 敏感剧同理"——**敏感剧可解，locked 付费集不可解**（真付费墙）。

## 三步解锁流程（已验证）

```python
import uuid, requests

H = {'User-Agent': UA, 'Referer': 'https://shorttv.online/', 'Content-Type': 'application/json'}
BASE = 'https://production.nodenear.shorttv.online'

# ① 游客注册（无需账号！服务端常见 guest/anonymous 端点）
r = requests.post(f'{BASE}/api/v3/auth/guest',
                  headers=H, json={'device_id': str(uuid.uuid4())}, timeout=10, verify=False)
token = r.json()['data']['access_token']   # + refresh_token

# ② 带 token 做成人确认
H['Authorization'] = f'Bearer {token}'
requests.post(f'{BASE}/api/v3/me/adult-confirmations', headers=H, json={}, timeout=8, verify=False)
# → data.adult_confirmed: true

# ③ 之后播放接口对 SENSITIVE 剧免费集也返回 playback_url 了
```

实测《淫魔重生之情欲江山》（free_episodes=9999, sensitivity=SENSITIVE）：游客+确认后 **9 集全可播**（之前 0 集）。

## 怎么发现 guest 接口

- 在 JS chunks 里搜 `identityGuest` / `auth/guest` / `anonymousRequest` / `guest`（openapi client 的 `e.s(["xxx",0,e=>e.client.post({url:"/api/v3/auth/guest",...})]` 模式）
- client 认证机制：`e.security` 数组 + `Authorization` header / cookie / query 三种注入方式（openapi-fetch 风格）
- `POST adult-confirmations` 返回 401 unauthorized ≠ 无解，先试游客身份

## 边界（要诚实告诉用户）

- **locked 集（付费墙）不可解**：`episode.locked=True` → 无 playback_url；`unlock_price_coins` 80/集，游客 `coin_available=0`，需真充值。这是平台收入来源，绕过就是盗版——**跳过并向用户说明是站点限制**
- `?adult_confirm=true` 等 query 参数无效，必须走 guest token 流程
- 免费集边界：`free_episodes=9999` = 全免费；`free_episodes=N` = 前 N 集免费（试看），第 N+1 起 locked

## 泛化教训

受限/付费 API 站（登录墙、成人确认、部分接口 401）先找 **guest/anonymous/session** 类接口——游客 token 常能解锁登录墙的一部分，不要直接放弃或跳过。付费墙（要充值）才真正无解。
