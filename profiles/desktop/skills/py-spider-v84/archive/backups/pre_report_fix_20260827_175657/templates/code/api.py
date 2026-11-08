#!/usr/bin/python
import json
import re
from urllib.parse import urljoin, urlparse
import requests
from base.spider import Spider

class Spider(Spider):
    def getName(self): return "API站点"
    def init(self, extend=""):
        self.name = "API站点"; self.host = "https://example.com"; self.api = self.host + "/api.php/provide/vod/"
        self.headers = {"User-Agent": "Mozilla/5.0", "Referer": self.host + "/"}
        self.session = requests.Session(); self.session.headers.update(self.headers)
    def _json(self, url, params=None):
        try: return self.session.get(url, params=params or {}, headers=self.headers, timeout=15, verify=False, proxies=self.session.proxies or None).json()
        except Exception: return {}
    def _html(self, url):
        try:
            r = self.session.get(url, headers=self.headers, timeout=15, verify=False, proxies=self.session.proxies or None); r.encoding = r.apparent_encoding or "utf-8"; return r.text
        except Exception: return ""
    def _fix(self, url): return urljoin(self.host + "/", url or "")
    def _is_media(self, url): return bool(re.search(r"\.(?:m3u8|mp4)(?:$|[?#])", urlparse(url).path, re.I))
    def _resolve_media(self, url, depth=0):
        url = self._fix(url)
        if self._is_media(url) or depth > 3: return url
        body = self._html(url)
        m = re.search(r'player_data\s*=\s*(\{.*?\})', body, re.S)
        if m:
            try:
                value = json.loads(m.group(1)).get("url", "")
                if value: return self._resolve_media(urljoin(url, value), depth + 1)
            except Exception: pass
        m = re.search(r'(?:var\s+now|var\s+playurl)\s*=\s*["\']([^"\']+)', body) or re.search(r'https?://[^"\' ]+\.(?:m3u8|mp4)[^"\' ]*', body)
        if m:
            value = m.group(1) if m.lastindex else m.group(0)
            return self._resolve_media(urljoin(url, value.replace("&amp;", "&")), depth + 1)
        frame = re.search(r'<iframe[^>]+src=["\']([^"\']+)', body, re.I)
        return self._resolve_media(urljoin(url, frame.group(1)), depth + 1) if frame else url
    def _item(self, v): return {"vod_id": str(v.get("vod_id", "")), "vod_name": v.get("vod_name", ""), "vod_pic": self._fix(v.get("vod_pic", ""))}
    def homeContent(self, filter):
        d = self._json(self.api, {"ac": "list"}); return {"class": d.get("class", []), "list": [], "filters": {}}
    def homeVideoContent(self):
        d = self._json(self.api, {"ac": "detail", "pg": 1}); items = d.get("list", [])
        return {"list": [self._item(v) for v in items]}
    def categoryContent(self, tid, pg, filter, extend):
        pg = int(pg) if str(pg).isdigit() else 1; d = self._json(self.api, {"ac": "list", "tid": tid, "pg": pg})
        return {"page": pg, "pagecount": int(d.get("pagecount", 1) or 1), "limit": int(d.get("limit", 20) or 20), "total": int(d.get("total", 0) or 0), "list": [self._item(v) for v in d.get("list", [])]}
    def detailContent(self, ids):
        d = self._json(self.api, {"ac": "detail", "ids": ids[0] if isinstance(ids, list) else ids}); out = []
        for v in d.get("list", []): out.append({**self._item(v), "vod_play_from": v.get("vod_play_from", ""), "vod_play_url": v.get("vod_play_url", "")})
        return {"list": out}
    def searchContent(self, key, quick, pg="1"):
        pg = int(pg) if str(pg).isdigit() else 1; d = self._json(self.api, {"ac": "detail", "wd": key, "pg": pg}); items = d.get("list", [])
        if not items: items = self._json(self.api, {"ac": "list", "wd": key, "pg": pg}).get("list", [])
        return {"page": pg, "list": [self._item(v) for v in items]}
    def playerContent(self, flag, id, vipFlags):
        url = self._resolve_media(id)
        return {"parse": 0 if self._is_media(url) else 1, "url": url, "header": json.dumps(self.headers)}
