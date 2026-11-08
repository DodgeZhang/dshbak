#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
══════════════════════════════════════════════════════════════════
《遮天法 2.0》 — TVBox 爬虫开发专家系统（自包含单文件版）
══════════════════════════════════════════════════════════════════

【这是什么】
  以《遮天》修炼体系为隐喻的 TVBox / 影视仓 / py-drpy / drpy-node
  爬虫源开发框架。将爬虫技术栈映射为"九秘→极道帝兵"和"八境功法"，
  通过大帝级自动路由引擎自动分析目标站点、判定防御等级、匹配最佳策略。

【核心能力】
  - 大帝级自动路由（RealmAutoRouter）：扫描 30 项特征（含现代 HTMX / CloudFlare）→ 自动判定防御等级 0-4
  - 洞天境（DongTian）：专治现代 HTMX 局部刷新 / CloudFlare Bot 管理站点，自带 HTMX 伪头部、initPlayer m3u8 提取与 episodeList 选集
  - 完整本地代理服务器（道宫五藏全激活）：m3u8 广告过滤 + Referer 伪装
  - 结构化日志（ZheTianLogger）+ 请求统计（RequestStats）
  - UA 池内置、会话线程安全、境界自动降级
  - 支持 video / novel / image / comic / audio / live / variety / anime / mix 九种内容类型
  - 九秘帝兵：荒塔、诛仙四剑、吞天魔罐、无始钟、仙珍图、诛仙阵图、虚空镜、不死天刀

【最简单的用法 — 一行代码自动路由】
    >>> from zhetian_fa import create_spider_for
    >>> spider = create_spider_for("https://example-video.com")
    >>> data = spider.homeContent()

【依赖安装】
    pip install requests beautifulsoup4 pyyaml pycryptodome
    可选更强：pip install curl_cffi      # 洞天境专治 CloudFlare 的指纹伪装（impersonate 浏览器 TLS）

  其中 pyyaml 和 pycryptodome 为可选依赖：
    - 无 pyyaml：使用内置默认配置，功能完整
    - 无 pycryptodome：AES 解密降级为纯 Python 框架

【命令行用法】
    python 遮天法2.0.py                          # 自检模式
    python 遮天法2.0.py --self-test              # 同上
    python 遮天法2.0.py https://example.com      # 自动分析 URL

【外部配置文件（可选）】
  如果在同目录放置 realm_config.yaml，程序会优先加载外部配置；
  没有则使用内置 DEFAULT_CONFIG 正常运行，无需任何外部文件。

【1.0 → 2.0 兼容性】
  - 境界类名不变：LunHai_BiAn / DaoGong_ShenZang / SiJi_TongTian 等
  - TVBox 六接口签名不变：homeContent / categoryContent / detailContent / ...
  - 新增 create_spider_for(url) 一键入口（推荐使用）

作者：红尘仙·叶凡（误）
版本：2.1.0
══════════════════════════════════════════════════════════════════
"""

import sys
import os
import re
import json
import time
import base64
import hashlib
import logging
import threading
import random
from urllib import parse
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional, Any, Callable

import requests
from bs4 import BeautifulSoup

# ─── 兼容 TVBox 生态（drpy 框架）───
try:
    from base.spider import Spider as SpiderBase  # noqa: F401
except ImportError:
    pass  # 自包含模式不需要


# ══════════════════════════════════════════════════════════════
# 2.0 内置默认配置（等同于 realm_config.yaml 内容）
# 外部 realm_config.yaml 存在时会被优先加载覆盖
# ══════════════════════════════════════════════════════════════
DEFAULT_CONFIG = {
    "selectors": {
        "轮海": {
            "list_item": [
                "//a[contains(@class,'videopic')]",
                "//li[contains(@class,'video-item')]/a",
                "//div[contains(@class,'module-item')]//a[./img]",
                "//div[contains(@class,'hy-video-list')]//a[./img]",
            ],
            "title": [
                ".//@title",
                ".//img/@alt",
                ".//h3/text()",
                ".//span[contains(@class,'name')]/text()",
            ],
            "pic": [
                ".//img/@data-original",
                ".//img/@data-src",
                ".//img/@src",
            ],
            "link": [".//@href"],
            "next_page": [
                "//a[contains(text(),'下一页')]/@href",
                "//a[contains(@class,'next')]/@href",
                "//a[contains(text(),'下页')]/@href",
            ],
        },
        "道宫": {
            "ad_keywords": ["ad", "advert", "gg", "promo", "推广", "广告"],
            "referer_map": {"img": "", "video": "/player", "m3u8": ""},
            "retry": {"max": 3, "delay": 2},
            "delay_range": [1, 3],
        },
        "四极": {
            "encrypt_patterns": [
                r'var\s+player_data\s*=\s*["\']([^"\']+)["\']',
                r'"encrypted"\s*:\s*"([^"]+)"',
                r'player_aaaa\s*=\s*["\']([^"\']+)["\']',
                r'var\s+url\s*=\s*atob\(["\']([^"\']+)["\']\)',
                r'"video_url"\s*:\s*"([^"]+)"',
            ]
        },
        "化龙": {
            "protocol_map": {
                "video": "video_",
                "novel": "novel_",
                "image": "image_",
                "comic": "comic_",
                "audio": "audio_",
                "live": "live_",
                "variety": "variety_",
                "anime": "anime_",
                "mix": "mix_",
            }
        },
    },
    "player_extract": {
        "13_layers": [
            {"name": "正则_m3u8", "pattern": r'src="([^"]+\.m3u8[^"]*)"'},
            {"name": "正则_mp4", "pattern": r'src="([^"]+\.mp4[^"]*)"'},
            {"name": "JS变量_player_data", "pattern": r'var\s+player_data\s*=\s*["\']([^"\']+)["\']'},
            {"name": "JS变量_player_aaaa", "pattern": r'player_aaaa\s*=\s*["\']([^"\']+)["\']'},
            {"name": "iframe嵌套", "pattern": r'<iframe[^>]+src=["\']([^"\']+)["\']'},
            {"name": "video标签", "pattern": r'<video[^>]+src=["\']([^"\']+)["\']'},
            {"name": "base64编码", "pattern": r'data:([A-Za-z0-9+/=]+)'},
            {"name": "JSON_url字段", "pattern": r'"url"\s*:\s*"([^"]+)"'},
            {"name": "JSON_src字段", "pattern": r'"src"\s*:\s*"([^"]+)"'},
            {"name": "JSON_video字段", "pattern": r'"video"\s*:\s*"([^"]+)"'},
            {"name": "eval加密", "pattern": r'eval\(([^)]+)\)'},
            {"name": "atob解码", "pattern": r'atob\(["\']([^"\']+)["\']\)'},
            {"name": "自定义函数", "pattern": r'getVideoUrl\(["\']([^"\']+)["\']\)'},
        ]
    },
    "洞天": {
        # ── 现代 HTMX / SPA / CloudFlare 抗压站点专用（命中后路由到 洞天境）──
        "htmx": {
            # HTMX 局部刷新接口必须携带的伪头部；服务端靠它们区分"真人点击"与"直连爬虫"
            "headers": {
                "HX-Request": "true",
                "HX-Target": "main",
                "HX-Current-URL": "{siteUrl}/",
            },
            # True=列表/搜索/详情走 HTMX；播放页 /play/... 必须 False（带 HX 头会 404）
            "content_api_use_htmx": True,
        },
        # 端点模板：{type}=分类id，{kw}=关键词，{siteUrl}=站点根
        "endpoints": {
            "discover": "/discover/{type}",            # 路径式 /discover/movie，不是 ?type=movie
            "search":   "/api/htmx/search?kw={kw}",    # 内容接口，需 HTMX 头
            "play":     "/play/{src}/{vod}?douban_id=",
            "douban_card": "/api/htmx/douban-card?kw={kw}",
        },
        "selectors": {
            "list_item": ["a[href*='/play/']"],
            "title":     ["@title", "img@alt", ":scope"],
            "pic":       ["img@src", "img@data-src"],
        },
        # 正则提取器——换站时按目标站点微调即可
        "regex": {
            "episode_list": r"episodeList\s*=\s*(\[.*?\]);",                    # 剧集列表 JS 数组
            "init_player":  r"initPlayer\(\s*'[^']*'\s*,\s*'([^']+)'\s*,",      # 播放器 m3u8（注意 \/ 转义）
        },
    },
    "proxy": {
        "default_port": 9979,
        "fallback_ports": [9980, 9981, 9982, 9983, 9984, 9985, 9986, 9987, 9988, 9989],
        "max_retry": 3,
        "retry_delay_base": 2,
    },
    "ua_pool": [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.2 Safari/605.1.15",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/131.0.0.0 Safari/537.36",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
        "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36",
    ],
    "stats": {
        "enabled": True,
        "report_interval": 50,
    },
}


# ══════════════════════════════════════════════════════════════
# 2.0 结构化日志系统
# ══════════════════════════════════════════════════════════════
class ZheTianLogger:
    """遮天日志——按境界分级，结构化输出"""

    REALM_EMOJI = {
        "轮海": "~", "道宫": "#", "四极": "=",
        "化龙": "@", "仙台": "^", "红尘仙": "*",
        "路由": ">", "统计": "$", "洞天": "⊙"
    }

    def __init__(self, name: str = "遮天法"):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.DEBUG)
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            handler.setFormatter(
                logging.Formatter(
                    "%(asctime)s [%(levelname)s] %(message)s",
                    datefmt="%H:%M:%S"
                )
            )
            self.logger.addHandler(handler)

    def _tag(self, realm: str, msg: str) -> str:
        emoji = self.REALM_EMOJI.get(realm, ".")
        return f"{emoji}[{realm}] {msg}"

    def info(self, realm: str, msg: str):
        self.logger.info(self._tag(realm, msg))

    def debug(self, realm: str, msg: str):
        self.logger.debug(self._tag(realm, msg))

    def warning(self, realm: str, msg: str):
        self.logger.warning(self._tag(realm, msg))

    def error(self, realm: str, msg: str):
        self.logger.error(self._tag(realm, msg))


log = ZheTianLogger("遮天法2.0")


# ══════════════════════════════════════════════════════════════
# 2.0 请求统计面板
# ══════════════════════════════════════════════════════════════
class RequestStats:
    """请求统计——记录成功率、耗时、降级次数"""

    def __init__(self):
        self.total = 0
        self.success = 0
        self.fail = 0
        self.total_time = 0.0
        self.fallback_count = 0
        self.by_realm: Dict[str, Dict[str, int]] = defaultdict(
            lambda: {"total": 0, "success": 0, "fail": 0}
        )
        self._lock = threading.Lock()

    def record(self, realm: str, success: bool, elapsed: float, was_fallback: bool = False):
        with self._lock:
            self.total += 1
            self.total_time += elapsed
            if success:
                self.success += 1
            else:
                self.fail += 1
            self.by_realm[realm]["total"] += 1
            self.by_realm[realm]["success" if success else "fail"] += 1
            if was_fallback:
                self.fallback_count += 1

    def snapshot(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "total": self.total,
                "success": self.success,
                "fail": self.fail,
                "success_rate": f"{self.success / max(self.total, 1) * 100:.1f}%",
                "avg_time_ms": f"{self.total_time / max(self.total, 1) * 1000:.0f}ms",
                "fallback_count": self.fallback_count,
                "by_realm": dict(self.by_realm),
                "timestamp": datetime.now().isoformat()
            }

    def report(self) -> str:
        s = self.snapshot()
        lines = [
            "+------------ 遮天统计 ------------+",
            f"| 总请求: {s['total']:<6}  成功率: {s['success_rate']:<8}  均耗时: {s['avg_time_ms']:<8} |",
            f"| 降级次数: {s['fallback_count']:<6}                         |",
        ]
        for realm, data in s["by_realm"].items():
            rate = f"{data['success'] / max(data['total'], 1) * 100:.0f}%"
            lines.append(f"| {realm:<4}: {data['total']}次 | 成功{data['success']} | 失败{data['fail']} | {rate} |")
        lines.append("+------------------------------------+")
        return "\n".join(lines)


stats = RequestStats()


# ══════════════════════════════════════════════════════════════
# 2.0 抽象境界基类（统一接口契约）
# ══════════════════════════════════════════════════════════════
class JieJingBase:
    """
    境界基类——所有秘境必须遵循的接口契约。

    TVBox 铁律六接口 + 境界元信息。
    """

    realm_name: str = "未知"
    realm_level: int = 0
    defense_level: int = 0   # 0=无, 1=简单反爬, 2=加密, 3=全能混合

    def __init__(self):
        self.siteUrl = ""
        self._ua_pool = self._build_ua_pool()

    @staticmethod
    def _build_ua_pool() -> List[str]:
        """内置 UA 池"""
        return [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.2 Safari/605.1.15",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/131.0.0.0 Safari/537.36",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
            "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36",
        ]

    def _random_ua(self) -> str:
        return random.choice(self._ua_pool)

    def _build_headers(self, extra: Dict = None) -> Dict:
        h = {
            "User-Agent": self._random_ua(),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "DNT": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }
        if extra:
            h.update(extra)
        return h

    # ───── TVBox 六大铁律接口 ─────
    def homeContent(self, filter: bool = False) -> Dict:
        raise NotImplementedError(f"{self.realm_name} 需实现 homeContent")

    def categoryContent(self, tid: str, pg: str, filter: bool, extend: Dict) -> Dict:
        raise NotImplementedError(f"{self.realm_name} 需实现 categoryContent")

    def detailContent(self, ids: List[str]) -> Dict:
        raise NotImplementedError(f"{self.realm_name} 需实现 detailContent")

    def playerContent(self, flag: str, id: str, vipFlags: str) -> Dict:
        raise NotImplementedError(f"{self.realm_name} 需实现 playerContent")

    def searchContent(self, key: str, quick: str, pg: str = "1") -> Dict:
        raise NotImplementedError(f"{self.realm_name} 需实现 searchContent")

    def localProxy(self, param: Dict) -> List:
        """本地代理——仅道宫境以上需要"""
        return [404, "text/plain", "此境界不支持本地代理"]


# ══════════════════════════════════════════════════════════════
# 源天书 · 基础源术（2.0 线程安全版）
# ══════════════════════════════════════════════════════════════
class YuanTianShu(JieJingBase):
    """
    源天书 2.0 —— session 改为线程局部存储，多线程安全。
    """
    realm_name = "源天书"
    realm_level = 0

    def __init__(self):
        super().__init__()
        self._local = threading.local()

    @property
    def session(self) -> requests.Session:
        if not hasattr(self._local, "session"):
            self._local.session = requests.Session()
        return self._local.session

    def fetch(self, url: str, headers: Dict = None, timeout: int = 10,
               htmx: bool = False, hx_target: str = "main", hx_current: str = "",
               use_cffi: bool = False) -> str:
        """发 HTTP GET 请求，返回响应文本。

        2.1 现代站点增强（洞天境专用）：
          - htmx=True  → 附带 HX-Request / HX-Target / HX-Current-URL 伪头部，
            绕开 HTMX SPA 的"空壳"反爬（服务端无这些头只回骨架，于是你拿到 DEMO/空数据）。
          - use_cffi=True → 改用 curl_cffi 的 impersonate 浏览器 TLS 指纹，
            专治 CloudFlare 等主动式 Bot 管理。**未安装 curl_cffi 时显式抛错**，
            不再静默降级到 requests（否则只会拿到空页面，问题更难排查）。
          - curl_cffi 的 Response 没有 apparent_encoding 属性，统一用 getattr 兜底，
            避免 AttributeError。
        """
        h = self._build_headers(headers)
        if htmx:
            h["HX-Request"] = "true"
            h["HX-Target"] = hx_target
            h["HX-Current-URL"] = hx_current or f"{self.siteUrl}/"
        t0 = time.time()
        try:
            if use_cffi:
                try:
                    from curl_cffi import requests as cffi_req
                except ImportError:
                    raise RuntimeError(
                        "未安装 curl_cffi，无法启用浏览器指纹伪装。"
                        "请先执行: pip install curl_cffi"
                    )
                resp = cffi_req.get(
                    url, headers=h, timeout=timeout,
                    impersonate="chrome131", allow_redirects=True,
                )
                text = resp.text
                elapsed = time.time() - t0
                stats.record(self.realm_name, True, elapsed)
                log.debug(self.realm_name, f"GET(cffi) 成功 {url[:60]} ({resp.status_code})")
                return text
            resp = self.session.get(url, headers=h, timeout=timeout, allow_redirects=True)
            resp.encoding = getattr(resp, "apparent_encoding", None) or "utf-8"
            elapsed = time.time() - t0
            stats.record(self.realm_name, True, elapsed)
            log.debug(self.realm_name, f"GET 成功 {url[:60]} ({resp.status_code})")
            return resp.text
        except Exception as e:
            elapsed = time.time() - t0
            stats.record(self.realm_name, False, elapsed)
            log.warning(self.realm_name, f"GET 失败: {e}")
            return ""

    def post(self, url: str, data: Dict = None, json_data: Dict = None,
             headers: Dict = None, timeout: int = 10) -> str:
        """POST 请求。"""
        h = self._build_headers(headers)
        t0 = time.time()
        try:
            if json_data:
                resp = self.session.post(url, json=json_data, headers=h, timeout=timeout)
            else:
                resp = self.session.post(url, data=data, headers=h, timeout=timeout)
            resp.encoding = getattr(resp, "apparent_encoding", None) or "utf-8"
            elapsed = time.time() - t0
            stats.record(self.realm_name, True, elapsed)
            return resp.text
        except Exception as e:
            elapsed = time.time() - t0
            stats.record(self.realm_name, False, elapsed)
            log.warning(self.realm_name, f"POST 失败: {e}")
            return ""

    # ───── 工具方法 ─────
    @staticmethod
    def fix_url(url: str, host: str) -> str:
        """补全 // 或 / 开头的相对路径"""
        if not url or url.startswith("http"):
            return url
        if url.startswith("//"):
            return f"https:{url}"
        if url.startswith("/"):
            return f"{host.rstrip('/')}{url}"
        return f"{host.rstrip('/')}/{url}"

    @staticmethod
    def clean_title(title: str) -> str:
        """清洗 HTML 标题"""
        import html as _html
        t = _html.unescape(title or "")
        t = re.sub(r"<[^>]+>", "", t)
        return t.strip()

    def homeContent(self, filter=False):
        raise NotImplementedError

    def categoryContent(self, tid, pg, filter, extend):
        raise NotImplementedError

    def detailContent(self, ids):
        raise NotImplementedError

    def playerContent(self, flag, id, vipFlags):
        raise NotImplementedError

    def searchContent(self, key, quick, pg="1"):
        raise NotImplementedError


# ══════════════════════════════════════════════════════════════
# 2.0 外部配置加载器（内置默认 + 外部 YAML 可选覆盖）
# ══════════════════════════════════════════════════════════════
class RealmConfig:
    """
    境界配置——优先加载 realm_config.yaml，不存在时使用内置 DEFAULT_CONFIG。
    """

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._loaded = False
                    cls._instance._data = {}
        return cls._instance

    def load(self, config_path: str = None):
        """加载配置：优先外部 YAML，回退到内置 DEFAULT_CONFIG"""
        import copy

        # 深拷贝内置默认配置
        self._data = copy.deepcopy(DEFAULT_CONFIG)

        # 确定配置文件路径
        if config_path is None:
            config_path = os.path.join(
                os.path.dirname(os.path.abspath(__file__)),
                "realm_config.yaml"
            )

        # 尝试加载外部 YAML 并深度合并
        try:
            import yaml
            with open(config_path, "r", encoding="utf-8") as f:
                external = yaml.safe_load(f)
            self._deep_merge(self._data, external)
            log.info("路由", f"外部配置已加载: {config_path}")
        except ImportError:
            log.info("路由", "未安装 pyyaml，使用内置默认配置（功能完整）")
        except FileNotFoundError:
            log.info("路由", f"配置文件不存在 {config_path}，使用内置默认配置")
        except Exception as e:
            log.warning("路由", f"配置加载异常: {e}，回退到内置默认")

        self._loaded = True

    def _deep_merge(self, base: Dict, overlay: Dict):
        """递归深度合并配置"""
        for key, val in overlay.items():
            if key in base and isinstance(base[key], dict) and isinstance(val, dict):
                self._deep_merge(base[key], val)
            else:
                base[key] = val

    def get(self, *keys, default=None):
        if not self._loaded:
            self.load()
        d = self._data
        for k in keys:
            if isinstance(d, dict):
                d = d.get(k, default)
            else:
                return default
        return d


config = RealmConfig()


# ══════════════════════════════════════════════════════════════
# 2.0 核心：大帝级自动路由引擎
# ══════════════════════════════════════════════════════════════
class RealmAutoRouter:
    """
    大帝级自动路由——自动分析目标网站 → 判定防御等级 → 实例化。

    使用方式：
        router = RealmAutoRouter()
        spider = router.route("https://example-video-site.com")
        data = spider.homeContent()
    """

    # ───── 24 项特征扫描规则 ─────
    FEATURE_SCANNERS: Dict[str, Callable[[str], bool]] = {
        # 加密特征（命中 → 四极境）
        "encrypt_aes": lambda h: bool(re.search(r'AES|aes\.(?:encrypt|decrypt)', h)),
        "encrypt_base64_url": lambda h: bool(re.search(r'atob\(|btoa\(|base64', h)),
        "encrypt_player_aaaa": lambda h: bool(re.search(r'player_aaaa', h)),
        "encrypt_eval": lambda h: bool(re.search(r'eval\(function\(', h)),
        "encrypt_js_obfuscate": lambda h: bool(re.search(r'\[_0x[a-f0-9]+\]', h)),
        "encrypt_xor": lambda h: bool(re.search(r'xor|XOR|charCodeAt.*\^', h)),
        "encrypt_token_sign": lambda h: bool(re.search(r'token=|sign=|timestamp=', h)),
        "encrypt_crypto_js": lambda h: bool(re.search(r'CryptoJS|crypto\.create', h)),

        # 反爬特征（命中 → 道宫境）
        "anticrawl_cf": lambda h: bool(re.search(r'cf-browser-verification|challenge-platform', h)),
        "anticrawl_captcha": lambda h: bool(re.search(r'captcha|验证码|g-recaptcha|h-captcha', h)),
        "anticrawl_waf": lambda h: bool(re.search(r'403 Forbidden|access denied|request blocked', h, re.I)),
        "anticrawl_referer": lambda h: bool(re.search(r'Referer|referer', h)),
        "anticrawl_ad_ts": lambda h: bool(re.search(r'/ad\d*\.ts|/advert/', h)),

        # 混合内容特征（命中 → 化龙境）
        "mixed_novel": lambda h: bool(re.search(r'novel|小说网|阅读|章节目录|book', h)),
        "mixed_image": lambda h: bool(re.search(r'gallery|图集|写真|套图|photo', h)),
        "mixed_comic": lambda h: bool(re.search(r'comic|漫画|manga|cartoon', h)),
        "mixed_live": lambda h: bool(re.search(r'live|直播|stream', h)),
        "mixed_music": lambda h: bool(re.search(r'music|音乐|audio|mp3', h)),

        # 高级特征（命中 → 化龙/仙台）
        "advanced_wasm": lambda h: bool(re.search(r'wasm|WebAssembly', h)),
        "advanced_iframe_nest": lambda h: bool(len(re.findall(r'<iframe', h)) >= 3),
        "advanced_api_multi": lambda h: bool(re.search(r'/api/provide/vod', h)),
        "advanced_dynamic_load": lambda h: bool(re.search(r'XMLHttpRequest|fetch\(|axios|ajax', h)),

        # ── 现代站点特征（命中 → 洞天境）──
        "modern_htmx": lambda h: bool(re.search(
            r'htmx(?:\.min)?\.js|HX-Request|hx-get|data-hx-|hx-target|hx-swap|hx-boost|'
            r'htmx\.config|document\.body\.innerHTML\s*=\s*htmx', h, re.I)),
        "modern_cloudflare": lambda h: bool(re.search(
            r'__cf_bm|cf-ray|challenge-platform|cdn-cgi|cf-mitigated|cloudflare', h, re.I)),
        "modern_async_shell": lambda h: bool(re.search(
            r'id=["\']app["\']|id=["\']root["\']|__NEXT_DATA__|window\.__INITIAL|<noscript>|'
            r'loading\.\.\.|骨架屏|__NUXT__|data-server-rendered', h)),
    }

    LEVEL_TO_REALM = {
        0: "轮海",
        1: "道宫",
        2: "四极",
        3: "化龙",
        4: "仙台",
    }

    def __init__(self):
        self._cache: Dict[str, Dict] = {}

    def analyze(self, url: str, html: str = None) -> Dict[str, Any]:
        """扫描目标网站，返回完整特征报告。"""
        if html is None:
            temp = YuanTianShu()
            html = temp.fetch(url)
        if not html:
            return {"url": url, "defense_level": 0, "realm": "未知", "features": {},
                    "recommend_weapons": [], "cms_type": "unknown", "error": "无法访问"}

        # 扫描特征
        features = {}
        for name, scanner in self.FEATURE_SCANNERS.items():
            features[name] = scanner(html)

        # 判定防御等级
        encrypt_count = sum(1 for k in features if k.startswith("encrypt_") and features[k])
        anticrawl_count = sum(1 for k in features if k.startswith("anticrawl_") and features[k])
        mixed_count = sum(1 for k in features if k.startswith("mixed_") and features[k])
        advanced_count = sum(1 for k in features if k.startswith("advanced_") and features[k])

        if advanced_count >= 3:
            defense_level = 4
        elif mixed_count >= 3:
            defense_level = 3
        elif encrypt_count >= 3:
            defense_level = 2
        elif anticrawl_count >= 2:
            defense_level = 1
        else:
            defense_level = 0

        # ── 现代站点优先判定（洞天境）──
        # HTMX SPA / CloudFlare / 异步空壳 三大现代特征，命中即单独走洞天境，
        # 不走旧防御等级体系——旧体系会把"空壳首页"误判成无防御的轮海，结果全是 DEMO。
        modern_signals = [
            k for k in ("modern_htmx", "modern_cloudflare", "modern_async_shell")
            if features.get(k)
        ]
        if modern_signals:
            defense_level = max(defense_level, 4)
            realm = "洞天"
            log.info("路由", f"现代站点特征命中 {modern_signals} → 洞天境")
        else:
            realm = self.LEVEL_TO_REALM.get(defense_level, "未知")

        cms_type = self._detect_cms(html)
        weapons = self._recommend_weapons(defense_level, features, realm)

        result = {
            "url": url,
            "defense_level": defense_level,
            "realm": realm,
            "features": features,
            "recommend_weapons": weapons,
            "cms_type": cms_type,
            "encrypt_count": encrypt_count,
            "anticrawl_count": anticrawl_count,
            "mixed_count": mixed_count,
            "advanced_count": advanced_count,
            "modern": bool(modern_signals),
            "modern_signals": modern_signals,
        }

        self._cache[url] = result
        return result

    def _detect_cms(self, html: str) -> str:
        if "/api.php/provide/vod" in html or ('"code":' in html and '"list":' in html):
            return "api"
        if "/index.php/vod/" in html or "MacCMS" in html:
            return "v10"
        if "/search.php?searchtype=" in html:
            return "v8"
        return "unknown"

    def _recommend_weapons(self, level: int, features: Dict, realm: str = None) -> List[str]:
        weapons = ["荒塔"]
        if realm == "洞天":
            weapons.append("洞天镜")       # 洞天境专属帝兵：照见 SPA 真身，破空壳
        if level >= 1:
            weapons.append("诛仙四剑")
        if level >= 2:
            weapons.append("吞天魔罐")
        if features.get("anticrawl_cf"):
            weapons.append("无始钟")
            weapons.append("仙珍图")
        if level >= 3:
            weapons.append("诛仙阵图")
        if level >= 4:
            weapons.append("虚空镜")
            weapons.append("不死天刀")
        return weapons

    def route(self, url: str, html: str = None) -> Any:
        """大帝级路由——分析 + 实例化一步到位。"""
        analysis = self.analyze(url, html)
        realm = analysis["realm"]
        defense = analysis["defense_level"]

        log.info("路由", f"目标 {url[:50]}... -> {realm}境 (防御等级 {defense})")
        log.info("路由", f"推荐帝兵: {', '.join(analysis['recommend_weapons'])}")

        active = [k for k, v in analysis["features"].items() if v]
        log.info("路由", f"检测到 {len(active)} 项特征: {', '.join(active[:8])}")

        spider = self._instantiate(realm, defense)
        spider.siteUrl = url.rstrip("/")
        return spider

    def _instantiate(self, realm: str, defense: int):
        if realm == "轮海":
            return LunHai_BiAn()
        elif realm == "道宫":
            return DaoGong_ShenZang()
        elif realm == "四极":
            return SiJi_TongTian()
        elif realm == "化龙":
            return HuaLong_JiuBian()
        elif realm == "仙台":
            return XianTai_DiJiuTian()
        elif realm == "洞天":
            return DongTian_HengYu()
        else:
            log.warning("路由", f"未识别的境界 {realm}，回退到轮海境")
            return LunHai_BiAn()

    def report(self) -> str:
        if not self._cache:
            return "暂无站点分析记录。"
        lines = ["====== 遮天法 2.0 站点分析报告 ======"]
        for url, a in self._cache.items():
            features_str = ", ".join(
                k for k, v in a["features"].items() if v
            )[:80]
            lines.append(
                f"{a['realm']:4}境 | {url[:50]:50} | 帝兵: {','.join(a['recommend_weapons'][:3])}"
            )
        lines.append("=" * 40)
        return "\n".join(lines)


# ══════════════════════════════════════════════════════════════
# 轮海秘境 · 轻量直取
# ══════════════════════════════════════════════════════════════
class LunHai_KuHai(YuanTianShu):
    """轮海·苦海——仅实现搜索"""
    realm_name = "轮海·苦海"
    realm_level = 1
    defense_level = 0

    def searchContent(self, key, quick, pg="1"):
        url = f"{self.siteUrl}/search?q={parse.quote(key)}&page={pg}"
        html = self.fetch(url)
        soup = BeautifulSoup(html, "html.parser")
        videos = []
        for item in soup.select(".video-item"):
            a = item.find("a")
            img = item.find("img")
            if a:
                videos.append({
                    "vod_id": a.get("href", ""),
                    "vod_name": a.get("title", ""),
                    "vod_pic": self.fix_url(img.get("src", ""), self.siteUrl) if img else "",
                })
        return {"list": videos}


class LunHai_MingQuan(LunHai_KuHai):
    """轮海·命泉——增加分类列表"""
    realm_name = "轮海·命泉"
    realm_level = 1

    def categoryContent(self, tid, pg, filter, extend):
        url = f"{self.siteUrl}/category/{tid}?page={pg}"
        html = self.fetch(url)
        soup = BeautifulSoup(html, "html.parser")
        videos = []
        for item in soup.select(".video-item, .movie-item"):
            a = item.find("a")
            img = item.find("img")
            if a:
                videos.append({
                    "vod_id": a.get("href", ""),
                    "vod_name": a.get("title", "") or img.get("alt", ""),
                    "vod_pic": self.fix_url(
                        img.get("data-original") or img.get("src", ""),
                        self.siteUrl
                    ) if img else "",
                })
        next_match = re.search(r'<a[^>]+href="([^"]+)"[^>]*>下一页', html)
        pagecount = 1
        page_match = re.search(r'/(\d+)[^/]*["\']\s*[^>]*>末页', html)
        if page_match:
            pagecount = int(page_match.group(1))
        return {
            "list": videos,
            "page": int(pg),
            "pagecount": pagecount,
            "limit": len(videos),
            "total": pagecount * len(videos),
        }


class LunHai_ShenQiao(LunHai_MingQuan):
    """轮海·神桥——增加详情页"""
    realm_name = "轮海·神桥"
    realm_level = 1

    def detailContent(self, ids):
        url = f"{self.siteUrl}{ids[0]}" if ids[0].startswith("/") else f"{self.siteUrl}/{ids[0]}"
        html = self.fetch(url)
        soup = BeautifulSoup(html, "html.parser")

        play_sources = []
        for panel in soup.select(".play-list, .hy-play-list, .playlist"):
            source_name = "默认源"
            tab = panel.select_one(".tab, .option")
            if tab:
                source_name = tab.get("title", "") or tab.get_text(strip=True)
            episodes = []
            for a in panel.select("a[href]"):
                href = a.get("href", "")
                if "/play/" in href or "/vod/play/" in href:
                    episodes.append(f"{a.get_text(strip=True)}${self.fix_url(href, self.siteUrl)}")
            if episodes:
                play_sources.append({
                    "name": source_name,
                    "episodes": "#".join(episodes)
                })

        return {
            "list": [{
                "vod_id": ids[0],
                "vod_name": self.clean_title(
                    soup.select_one("h1,h2,.title") and
                    soup.select_one("h1,h2,.title").get_text(strip=True) or ""
                ),
                "vod_pic": self.fix_url(
                    soup.select_one("img.poster,img.cover") and
                    (soup.select_one("img.poster,img.cover").get("src") or ""),
                    self.siteUrl
                ) if soup.select_one("img.poster,img.cover") else "",
                "vod_play_from": "$$$".join(s["name"] for s in play_sources),
                "vod_play_url": "$$$".join(s["episodes"] for s in play_sources),
            }]
        }


class LunHai_BiAn(LunHai_ShenQiao):
    """轮海·彼岸——大圆满，五接口齐全"""
    realm_name = "轮海·彼岸"
    realm_level = 1

    def homeContent(self, filter=False):
        return {
            "class": [
                {"type_name": "电影", "type_id": "1"},
                {"type_name": "电视剧", "type_id": "2"},
                {"type_name": "动漫", "type_id": "3"},
                {"type_name": "综艺", "type_id": "4"},
            ]
        }

    def playerContent(self, flag, id, vipFlags):
        if not id.startswith("http"):
            html = self.fetch(f"{self.siteUrl}{id}")
            m3u8 = re.search(r'(https?://[^"\s]+\.m3u8[^"\s]*)', html)
            id = m3u8.group(1) if m3u8 else ""
        return {"parse": 0, "url": id, "header": ""}


# ══════════════════════════════════════════════════════════════
# 道宫秘境 · 反爬防御（完整本地代理）
# ══════════════════════════════════════════════════════════════
class DaoGong_ShenZang(YuanTianShu):
    """道宫·五脏神藏 —— 完整本地代理服务器"""
    realm_name = "道宫"
    realm_level = 2
    defense_level = 1

    def __init__(self):
        super().__init__()
        self.siteUrl = ""
        self.proxyPort = 9979
        self._proxy_server = None
        self._proxy_thread = None
        self._init_wu_mi()

    def _init_wu_mi(self):
        """五脏初始化——皆阵行兵者五秘全激活"""
        self.ad_patterns = [
            re.compile(r"https?://[^/]*ad[^/]*/.*\.ts"),
            re.compile(r"https?://[^/]*advert[^/]*/.*\.ts"),
            re.compile(r".*_ad_\d+\.ts"),
            re.compile(r".*/ad\d+\.ts"),
            re.compile(r".*/gg\d*\.ts"),
        ]
        self.referer_map = {"img": "", "video": "/player", "m3u8": ""}
        self.delay = (1, 3)
        self.max_retry = 3
        self.retry_delay = 2

    def _clean_m3u8(self, content: str) -> str:
        """皆字秘——净化广告分片"""
        lines = content.split("\n")
        cleaned = []
        skip_next = False
        for line in lines:
            stripped = line.strip()
            is_ad = any(p.match(stripped) for p in self.ad_patterns)
            if is_ad:
                skip_next = True
                continue
            if skip_next and stripped.startswith("#EXTINF"):
                skip_next = False
                continue
            cleaned.append(line)
        return "\n".join(cleaned)

    def _proxy_url(self, real_url: str, referer_type: str = "video") -> str:
        """阵字秘——包装为本地代理地址"""
        encoded = base64.b64encode(real_url.encode()).decode()
        ref_url = self.referer_map.get(referer_type, self.siteUrl)
        ref = base64.b64encode(ref_url.encode()).decode()
        return f"http://127.0.0.1:{self.proxyPort}/proxy?url={encoded}&ref={ref}"

    def _xing_delay(self):
        """行字秘——随机延迟"""
        time.sleep(random.uniform(*self.delay))

    def _zhe_retry(self, func, *args, **kwargs):
        """者字秘——失败自动重试"""
        for i in range(self.max_retry):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                if i == self.max_retry - 1:
                    stats.record(self.realm_name, False, 0, was_fallback=True)
                    raise e
                time.sleep(self.retry_delay * (i + 1))
                log.debug(self.realm_name, f"者字秘重试 {i + 1}/{self.max_retry}")

    def start_proxy(self):
        """启动本地代理服务器（后台线程）"""
        import http.server
        import socketserver

        outer = self

        class ProxyHandler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                from urllib.parse import parse_qs, urlparse
                parsed = urlparse(self.path)
                params = parse_qs(parsed.query)

                if parsed.path == "/proxy":
                    try:
                        real_url = base64.b64decode(params.get("url", [""])[0]).decode()
                        referer = base64.b64decode(params.get("ref", [""])[0]).decode()

                        headers = {
                            "Referer": referer or outer.siteUrl,
                            "User-Agent": outer._random_ua()
                        }
                        resp = requests.get(real_url, headers=headers, stream=True, timeout=15)

                        content_type = resp.headers.get("Content-Type", "")
                        if "mpegurl" in content_type or real_url.endswith(".m3u8"):
                            content = resp.text
                            cleaned = outer._clean_m3u8(content)
                            self.send_response(200)
                            self.send_header("Content-Type", "application/vnd.apple.mpegurl")
                            self.end_headers()
                            self.wfile.write(cleaned.encode())
                        else:
                            self.send_response(resp.status_code)
                            for k, v in resp.headers.items():
                                if k.lower() not in ["content-encoding", "transfer-encoding"]:
                                    self.send_header(k, v)
                            self.end_headers()
                            for chunk in resp.iter_content(8192):
                                self.wfile.write(chunk)
                    except Exception as e:
                        self.send_response(502)
                        self.end_headers()
                        self.wfile.write(f"Proxy Error: {e}".encode())
                else:
                    self.send_response(404)
                    self.end_headers()

            def log_message(self, format, *args):
                pass

        try:
            self._proxy_server = socketserver.ThreadingTCPServer(
                ("127.0.0.1", self.proxyPort), ProxyHandler
            )
            self._proxy_thread = threading.Thread(
                target=self._proxy_server.serve_forever, daemon=True
            )
            self._proxy_thread.start()
            log.info("道宫", f"本地代理大阵启动 端口:{self.proxyPort}")
            return True
        except OSError as e:
            log.warning("道宫", f"代理端口 {self.proxyPort} 被占用: {e}")
            for port in range(9980, 9990):
                try:
                    self.proxyPort = port
                    self._proxy_server = socketserver.ThreadingTCPServer(
                        ("127.0.0.1", port), ProxyHandler
                    )
                    self._proxy_thread = threading.Thread(
                        target=self._proxy_server.serve_forever, daemon=True
                    )
                    self._proxy_thread.start()
                    log.info("道宫", f"本地代理大阵启动 备用端口:{port}")
                    return True
                except OSError:
                    continue
            log.error("道宫", "无法启动本地代理，所有端口均被占用")
            return False

    def stop_proxy(self):
        if self._proxy_server:
            self._proxy_server.shutdown()
            log.info("道宫", "本地代理大阵已关闭")

    def playerContent(self, flag, id, vipFlags):
        if id.startswith("http://127.0.0.1"):
            return {"parse": 0, "url": id, "header": ""}
        if not self._proxy_server:
            self.start_proxy()
        proxy = self._proxy_url(id, "m3u8")
        return {"parse": 0, "url": proxy, "header": ""}


# ══════════════════════════════════════════════════════════════
# 四极秘境 · 加密破解
# ══════════════════════════════════════════════════════════════
class SiJi_TongTian(YuanTianShu):
    """四极·四肢通天"""
    realm_name = "四极"
    realm_level = 3
    defense_level = 2

    def __init__(self):
        super().__init__()
        self.key_table = {
            "aes_key": b"0123456789abcdef0123456789abcdef",
            "aes_iv": b"abcdef0123456789",
            "xor_key": 0x5A,
            "token_secret": "default_secret"
        }

    def set_keys(self, aes_key: bytes = None, aes_iv: bytes = None,
                 xor_key: int = None, token_secret: str = None):
        """外部密钥注入"""
        if aes_key:
            self.key_table["aes_key"] = aes_key
        if aes_iv:
            self.key_table["aes_iv"] = aes_iv
        if xor_key is not None:
            self.key_table["xor_key"] = xor_key
        if token_secret:
            self.key_table["token_secret"] = token_secret

    def _aes_cbc_decrypt(self, ciphertext_b64: str) -> str:
        try:
            from Crypto.Cipher import AES
            from Crypto.Util.Padding import unpad
            cipher = base64.b64decode(ciphertext_b64)
            key = self.key_table["aes_key"]
            iv = self.key_table["aes_iv"]
            cipher_obj = AES.new(key, AES.MODE_CBC, iv)
            plaintext = unpad(cipher_obj.decrypt(cipher), AES.block_size)
            return plaintext.decode("utf-8", errors="replace")
        except ImportError:
            log.warning("四极", "环境无 pycryptodome，使用纯 Python AES 框架")
            return self._pure_aes_fallback(ciphertext_b64)
        except Exception as e:
            log.error("四极", f"AES 解密失败: {e}")
            stats.record("四极", False, 0, was_fallback=True)
            return ""

    def _pure_aes_fallback(self, ciphertext_b64: str) -> str:
        try:
            return base64.b64decode(ciphertext_b64).decode("utf-8", errors="replace")
        except:
            return ""

    def _xor_decrypt(self, data_b64: str) -> str:
        data = base64.b64decode(data_b64)
        key = self.key_table["xor_key"]
        return "".join(chr(b ^ key) for b in data)

    def _generate_token(self, video_id: str) -> Dict:
        ts = int(time.time())
        sign = hashlib.sha256(
            f"{video_id}{ts}{self.key_table['token_secret']}".encode()
        ).hexdigest()
        return {"id": video_id, "time": ts, "sign": sign}

    def _multi_decrypt(self, encrypted: str) -> str:
        """多策略解密——依次尝试 AES/XOR/Base64"""
        for method in [self._aes_cbc_decrypt, self._xor_decrypt]:
            try:
                result = method(encrypted)
                if result and ("http" in result or ".m3u8" in result):
                    return result
            except:
                continue
        try:
            return base64.b64decode(encrypted).decode("utf-8", errors="replace")
        except:
            return ""

    def detailContent(self, ids):
        url = f"{self.siteUrl}/api/video?id={ids[0]}"
        html = self.fetch(url)
        enc_match = re.search(r'"encrypted"\s*:\s*"([^"]+)"', html)
        if not enc_match:
            return {"list": []}
        real_url = self._multi_decrypt(enc_match.group(1))
        return {
            "list": [{
                "vod_id": ids[0],
                "vod_name": "四极破法",
                "vod_play_from": "解密直链",
                "vod_play_url": f"第1集${real_url}"
            }]
        }

    def playerContent(self, flag, id, vipFlags):
        header = f"Referer={self.siteUrl}/"
        return {"parse": 0, "url": id, "header": header}


# ══════════════════════════════════════════════════════════════
# 化龙秘境 · 全能混合
# ══════════════════════════════════════════════════════════════
class HuaLong_JiuBian(YuanTianShu):
    """化龙·九变登仙"""
    realm_name = "化龙"
    realm_level = 4
    defense_level = 3

    def __init__(self):
        super().__init__()
        self.protocol_handlers = {
            "video": self._handle_video,
            "novel": self._handle_novel,
            "image": self._handle_image,
            "comic": self._handle_comic,
            "audio": self._handle_audio,
            "live": self._handle_live,
            "variety": self._handle_variety,
            "anime": self._handle_anime,
            "mix": self._handle_mix,
        }

    def _detect_type(self, vod_id: str) -> str:
        for prefix in self.protocol_handlers:
            if vod_id.startswith(f"{prefix}_"):
                return prefix
        return "video"

    def _handle_video(self, vod_id: str) -> str:
        real_id = vod_id.replace("video_", "")
        html = self.fetch(f"{self.siteUrl}/video/{real_id}")
        m3u8 = re.search(r'src="([^"]+\.m3u8)"', html)
        return m3u8.group(1) if m3u8 else ""

    def _handle_novel(self, vod_id: str) -> str:
        real_id = vod_id.replace("novel_", "")
        html = self.fetch(f"{self.siteUrl}/novel/{real_id}")
        soup = BeautifulSoup(html, "html.parser")
        content = soup.select_one(".chapter-content, #content, .content")
        if content:
            text = content.get_text("\n", strip=True)
            return f"novel://{base64.b64encode(text.encode()).decode()}"
        return ""

    def _handle_image(self, vod_id: str) -> str:
        real_id = vod_id.replace("image_", "")
        html = self.fetch(f"{self.siteUrl}/gallery/{real_id}")
        imgs = re.findall(r'<img[^>]+(?:data-src|src)="([^"]+)"[^>]*>', html)
        return "pics://" + "|".join(imgs) if imgs else ""

    def _handle_comic(self, vod_id: str) -> str:
        real_id = vod_id.replace("comic_", "")
        html = self.fetch(f"{self.siteUrl}/comic/{real_id}")
        pages = re.findall(r'<img[^>]+src="([^"]+)"[^>]*data-page="\d+"', html)
        return "pics://" + "|".join(pages) if pages else ""

    def _handle_audio(self, vod_id: str) -> str:
        real_id = vod_id.replace("audio_", "")
        html = self.fetch(f"{self.siteUrl}/audio/{real_id}")
        mp3 = re.search(r'<audio[^>]+src="([^"]+\.mp(?:3|4))"', html)
        return mp3.group(1) if mp3 else ""

    def _handle_live(self, vod_id: str) -> str:
        real_id = vod_id.replace("live_", "")
        return f"{self.siteUrl}/live/{real_id}.m3u8"

    def _handle_variety(self, vod_id: str) -> str:
        real_id = vod_id.replace("variety_", "")
        html = self.fetch(f"{self.siteUrl}/variety/{real_id}")
        eps = re.findall(r'<a href="(/variety/[^"]+)">第([^<]+)期</a>', html)
        return "#".join(f"第{ep[1]}期${self.siteUrl}{ep[0]}" for ep in eps) if eps else ""

    def _handle_anime(self, vod_id: str) -> str:
        real_id = vod_id.replace("anime_", "")
        html = self.fetch(f"{self.siteUrl}/anime/{real_id}")
        eps = re.findall(r'<a href="(/anime/[^"]+)">第(\d+)集</a>', html)
        return "#".join(f"第{ep[1]}集${self.siteUrl}{ep[0]}" for ep in eps) if eps else ""

    def _handle_mix(self, vod_id: str) -> str:
        real_id = vod_id.replace("mix_", "")
        video = self._handle_video(f"video_{real_id}")
        img = self._handle_image(f"image_{real_id}")
        return f"{video}##{img}"

    def detailContent(self, ids):
        vod_id = ids[0]
        content_type = self._detect_type(vod_id)
        handler = self.protocol_handlers.get(content_type, self._handle_video)
        result = handler(vod_id)

        type_meta = {
            "novel": ("小说阅读", f"全文${result}"),
            "image": ("图集浏览", f"套图${result}"),
            "comic": ("漫画阅读", f"全卷${result}"),
            "audio": ("音频直链", f"第1集${result}"),
            "live": ("直播源", f"直播${result}"),
        }
        play_from, play_url = type_meta.get(
            content_type,
            ("视频直链", result if "#" in str(result) else f"第1集${result}")
        )

        return {
            "list": [{
                "vod_id": vod_id,
                "vod_name": f"化龙九变·{content_type}",
                "vod_play_from": play_from,
                "vod_play_url": play_url,
            }]
        }

    def playerContent(self, flag, id, vipFlags):
        if id.startswith("novel://") or id.startswith("pics://"):
            return {"parse": 1, "url": id, "header": ""}
        return {"parse": 0, "url": id, "header": ""}


# ══════════════════════════════════════════════════════════════
# 仙台秘境 · 大帝级整合
# ══════════════════════════════════════════════════════════════
class XianTai_DiYiTian(HuaLong_JiuBian):
    """仙台·第一重天——半步大能，继承化龙九变"""
    realm_name = "仙台·一步"
    realm_level = 5
    defense_level = 4

    def homeContent(self, filter=False):
        return LunHai_BiAn().homeContent(filter)

    def categoryContent(self, tid, pg, filter, extend):
        return HuaLong_JiuBian.categoryContent(self, tid, pg, filter, extend)

    def detailContent(self, ids):
        return HuaLong_JiuBian.detailContent(self, ids)


class XianTai_DiJiuTian(XianTai_DiYiTian):
    """仙台·第九重天——大帝级，自动路由选择最佳策略"""
    realm_name = "仙台·大帝"
    realm_level = 5
    defense_level = 4

    def __init__(self):
        super().__init__()
        self._strategies: Dict[int, Any] = {}
        self._auto_router = RealmAutoRouter()

    def _ensure_strategies(self):
        if not self._strategies:
            self._strategies = {
                0: LunHai_BiAn(),
                1: DaoGong_ShenZang(),
                2: SiJi_TongTian(),
                3: HuaLong_JiuBian(),
            }
            for s in self._strategies.values():
                s.siteUrl = self.siteUrl

    def homeContent(self, filter=False):
        self._ensure_strategies()
        analysis = self._auto_router.analyze(self.siteUrl)
        s = self._strategies.get(analysis["defense_level"], self._strategies[0])
        s.siteUrl = self.siteUrl
        log.info("仙台", f"大帝自动选择 {s.realm_name} 执行 homeContent")
        try:
            return s.homeContent(filter)
        except:
            return self._strategies[0].homeContent(filter)

    def categoryContent(self, tid, pg, filter, extend):
        self._ensure_strategies()
        s = self._strategies.get(
            self._auto_router.analyze(self.siteUrl)["defense_level"],
            self._strategies[0]
        )
        s.siteUrl = self.siteUrl
        try:
            return s.categoryContent(tid, pg, filter, extend)
        except:
            return self._strategies[0].categoryContent(tid, pg, filter, extend)

    def detailContent(self, ids):
        self._ensure_strategies()
        s = self._strategies.get(
            self._auto_router.analyze(self.siteUrl)["defense_level"],
            self._strategies[0]
        )
        s.siteUrl = self.siteUrl
        try:
            return s.detailContent(ids)
        except:
            return self._strategies[0].detailContent(ids)

    def playerContent(self, flag, id, vipFlags):
        self._ensure_strategies()
        s = self._strategies.get(
            self._auto_router.analyze(self.siteUrl)["defense_level"],
            self._strategies[0]
        )
        s.siteUrl = self.siteUrl
        try:
            return s.playerContent(flag, id, vipFlags)
        except:
            return self._strategies[0].playerContent(flag, id, vipFlags)


# ══════════════════════════════════════════════════════════════
# 洞天境 · 现代 HTMX / SPA / CloudFlare 抗压站点
# ══════════════════════════════════════════════════════════════
class DongTian_HengYu(YuanTianShu):
    """洞天境·横宇 —— 现代 HTMX / SPA / CloudFlare 抗压站点专用境界。

    ── 技术注释（给分享对象看的干货）──
    现代影视站多用 HTMX 局部刷新 + CloudFlare Bot 管理，和老 MacCMS 静态 DOM 完全不同：
      1) 列表 / 搜索 / 详情都靠 HX-Request 伪头部区分"真人点击"和"直连爬虫"。
         不带头 → 服务端只回一个空骨架（loading…）→ 你拿到 DEMO / 空数据。
      2) 播放页 /play/... 反而必须走**普通 GET**（带 HX 头会直接 404）。
         真正的 m3u8 藏在页面 JS 的 initPlayer('...','<m3u8>',{...}) 里，
         且斜杠被转义成 \\/，需还原成 /。
      3) 剧集列表在播放页 JS 的 episodeList = [{title, url}] 数组里，
         不再是一个个 <a> 标签——所以 detail 靠正则抠数组，而不是 BeautifulSoup 找链接。

    本境界是"骨架 + 示例"：默认参数按 moovie.c2v2.com 调通，
    换站时只改 DEFAULT_CONFIG["洞天"] 的端点与正则即可，逻辑无需重写。
    """

    realm_name = "洞天"
    realm_level = 7
    defense_level = 4

    # ── 站点可调参数（优先读 realm_config.yaml 的 洞天 段，否则用内置默认）──
    DISCOVER_TYPES = [("电影", "movie"), ("电视剧", "tv"), ("综艺", "show"), ("动漫", "cartoon")]
    SEARCH_ENDPOINT = "/api/htmx/search?kw={kw}"
    DISCOVER_PATH = "/discover/{type}"          # 优先：路径式
    DISCOVER_QUERY = "/discover?type={type}"    # 兜底：查询式（部分站点用这种）
    PLAY_PATH = "/play/{src}/{vod}"             # douban_id 可空，按需拼
    RE_EP_LIST = re.compile(r"episodeList\s*=\s*(\[.*?\]);", re.S)
    RE_INIT_PLAYER = re.compile(r"initPlayer\(\s*'[^']*'\s*,\s*'([^']+)'\s*,")
    USE_CFFI = False   # 真被 CloudFlare 拦时置 True（需 pip install curl_cffi）

    def _cfg_ep_list(self):
        pat = config.get("洞天", "regex", "episode_list", default=r"episodeList\s*=\s*(\[.*?\]);")
        return re.compile(pat, re.S)

    def _cfg_init_player(self):
        pat = config.get("洞天", "regex", "init_player",
                         default=r"initPlayer\(\s*'[^']*'\s*,\s*'([^']+)'\s*,")
        return re.compile(pat)

    def _htmx_headers(self):
        return {
            "HX-Request": "true",
            "HX-Target": "main",
            "HX-Current-URL": f"{self.siteUrl}/",
        }

    def _parse_list(self, html: str) -> List[Dict]:
        """从列表/搜索 HTML 中抠出视频卡片（现代站点仍是 a[href*='/play/']）。"""
        soup = BeautifulSoup(html, "html.parser")
        videos = []
        seen = set()
        for a in soup.select("a[href*='/play/']"):
            href = a.get("href", "")
            if not href or href in seen:
                continue
            seen.add(href)
            img = a.find("img")
            title = (a.get("title")
                     or (img.get("alt", "") if img else "")
                     or a.get_text(strip=True))
            if not title:
                continue
            videos.append({
                "vod_id": href,
                "vod_name": self.clean_title(title),
                "vod_pic": self.fix_url(img.get("src", "") if img else "", self.siteUrl),
            })
        return videos

    def homeContent(self, filter=False):
        return {"class": [{"type_name": n, "type_id": t} for n, t in self.DISCOVER_TYPES]}

    def categoryContent(self, tid, pg, filter, extend):
        # 端点自适应：先试路径式 /discover/{type}，拿不到内容再试查询式 ?type=
        url = f"{self.siteUrl}{self.DISCOVER_PATH.format(type=tid)}"
        html = self.fetch(url, headers=self._htmx_headers(), use_cffi=self.USE_CFFI)
        if not html or ("loading" in html[:500].lower() and len(self._parse_list(html)) == 0):
            url = f"{self.siteUrl}{self.DISCOVER_QUERY.format(type=tid)}"
            html = self.fetch(url, headers=self._htmx_headers(), use_cffi=self.USE_CFFI)
        videos = self._parse_list(html)
        return {
            "list": videos, "page": int(pg), "pagecount": 999,
            "limit": len(videos), "total": 999 * max(len(videos), 1),
        }

    def searchContent(self, key, quick, pg="1"):
        url = f"{self.siteUrl}{self.SEARCH_ENDPOINT.format(kw=parse.quote(key))}"
        html = self.fetch(url, headers=self._htmx_headers(), use_cffi=self.USE_CFFI)
        return {"list": self._parse_list(html)}

    def detailContent(self, ids):
        # 注意：播放页必须普通 GET，禁 HTMX，否则 404
        path = ids[0]
        url = path if path.startswith("http") else f"{self.siteUrl}{path}"
        html = self.fetch(url, use_cffi=self.USE_CFFI)
        soup = BeautifulSoup(html, "html.parser")
        name = self.clean_title(
            soup.select_one("h1,h2,.title,.movie-title,.name") and
            soup.select_one("h1,h2,.title,.movie-title,.name").get_text(strip=True) or ""
        ) or "洞天·未知"
        pic_node = soup.select_one("img.poster,img.cover,img")
        pic = self.fix_url(pic_node.get("src", "") if pic_node else "", self.siteUrl)

        # 剧集列表：从 JS 数组 episodeList 抠，没有就退化成单集"正片"
        episodes = []
        m = self._cfg_ep_list().search(html)
        if m:
            try:
                for ep in json.loads(m.group(1)):
                    t = ep.get("title") or ep.get("name") or "未知"
                    u = ep.get("url") or ""
                    if not u:
                        continue
                    ep_url = u if u.startswith("http") else f"{self.siteUrl}{u}"
                    episodes.append(f"{t}${ep_url}")
            except Exception:
                pass
        if not episodes:
            episodes.append(f"正片${url}")

        return {"list": [{
            "vod_id": path,
            "vod_name": name,
            "vod_pic": pic,
            "vod_play_from": "洞天源",
            "vod_play_url": "#".join(episodes),
        }]}

    def playerContent(self, flag, id, vipFlags):
        # 同样是普通 GET（TVBox 点哪一集，id 就是那一集的 /play/...?ep= 链接）
        url = id if id.startswith("http") else f"{self.siteUrl}{id}"
        html = self.fetch(url, use_cffi=self.USE_CFFI)
        m = self._cfg_init_player().search(html)
        if m:
            m3u8 = m.group(1).replace("\\/", "/")   # 还原被转义的斜杠
            return {"parse": 0, "url": m3u8, "header": ""}
        # 兜底：直接在 HTML 里找 .m3u8
        m2 = re.search(r'(https?://[^"\s]+\.m3u8[^"\s]*)', html)
        if m2:
            return {"parse": 0, "url": m2.group(1), "header": ""}
        return {"parse": 1, "url": url, "header": ""}


# ══════════════════════════════════════════════════════════════
# 红尘仙 · 最终入口
# ══════════════════════════════════════════════════════════════
class HongChenXian(XianTai_DiJiuTian):
    """红尘仙 —— 万法归一，TVBox 最终入口"""

    realm_name = "红尘仙"
    realm_level = 6

    def init(self, extend=""):
        log.info("红尘仙", "不为成仙，只为在红尘中抓尽天下视频...")
        log.info("红尘仙", f"统计面板: {stats.snapshot()['total']} 次请求已完成")
        return True

    def isVideoFormat(self, url):
        formats = [".m3u8", ".mp4", ".flv", ".mkv", ".ts", ".avi", ".mov", ".webm"]
        return any(f in url.lower() for f in formats)

    def manualVideoCheck(self):
        return False

    def localProxy(self, param):
        """红尘仙代理——启动道宫大阵"""
        dao = DaoGong_ShenZang()
        dao.siteUrl = self.siteUrl
        if not dao._proxy_server:
            dao.start_proxy()
        return [200, "application/json", json.dumps({
            "proxy": f"http://127.0.0.1:{dao.proxyPort}",
            "status": "running",
            "version": "2.0.0"
        })]


# ══════════════════════════════════════════════════════════════
# TVBox 标准入口
# ══════════════════════════════════════════════════════════════
class Spider(HongChenXian):
    """TVBox 标准入口——红尘仙降世为 Spider"""
    pass


# ══════════════════════════════════════════════════════════════
# 一键自动路由
# ══════════════════════════════════════════════════════════════
def create_spider_for(url: str) -> Spider:
    """
    遮天法 2.0 一键入口。

    用法：
        spider = create_spider_for("https://example-video.com")
        data = spider.homeContent()
    """
    router = RealmAutoRouter()
    analysis = router.analyze(url)
    log.info("红尘仙", "=" * 50)
    log.info("红尘仙", f"目标: {url}")
    log.info("红尘仙", f"境界: {analysis['realm']} (防Lv.{analysis['defense_level']})")
    log.info("红尘仙", f"帝兵: {', '.join(analysis['recommend_weapons'])}")
    log.info("红尘仙", f"CMS: {analysis['cms_type']}")
    if analysis.get("modern"):
        log.info("红尘仙", "⚠ 现代站点：若被 CloudFlare 拦截，请在 DongTian_HengYu 置 USE_CFFI=True 并 pip install curl_cffi")
    log.info("红尘仙", "=" * 50)

    spider = Spider()
    spider.siteUrl = url.rstrip("/")
    spider.init()
    return spider


# ══════════════════════════════════════════════════════════════
# 自检入口
# ══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="遮天法 2.0 — TVBox 爬虫开发专家系统")
    parser.add_argument("url", nargs="?", help="目标站点 URL")
    parser.add_argument("--self-test", action="store_true", help="运行自检")
    parser.add_argument("--analyze-only", action="store_true", help="仅分析不生成")
    parser.add_argument("--generate-only", action="store_true", help="仅生成代码")
    parser.add_argument("--realm", help="指定境界（轮海/道宫/四极/化龙/仙台/洞天）")
    parser.add_argument("--test", help="测试指定接口（home/category/detail/player/search）")
    args = parser.parse_args()

    if args.self_test or (not args.url):
        log.info("红尘仙", "遮天法 2.0 自检...")
        log.info("红尘仙", f"境界: {[c.realm_name for c in [LunHai_BiAn, DaoGong_ShenZang, SiJi_TongTian, HuaLong_JiuBian, XianTai_DiJiuTian, DongTian_HengYu, HongChenXian]]}")
        log.info("红尘仙", "大帝级路由引擎就绪")
        log.info("红尘仙", f"内置 UA 池: {len(JieJingBase._build_ua_pool())} 条")
        config.load()  # 触发配置加载
        log.info("红尘仙", "自检完成，可出山抓源。")

    if args.url:
        spider = create_spider_for(args.url)
        if args.test:
            method = getattr(spider, f"{args.test}Content", None)
            if method:
                result = method(tid="1", pg="1", filter=False, extend={}) if args.test == "category" else \
                         method(filter=False) if args.test == "home" else \
                         method(ids=["1"]) if args.test == "detail" else \
                         method(flag="", id="1", vipFlags="") if args.test == "player" else \
                         method(key="test", quick="1")
                print(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            data = spider.homeContent()
            print(json.dumps(data, ensure_ascii=False, indent=2))
