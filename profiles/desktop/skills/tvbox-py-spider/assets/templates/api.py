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
    def _is_media(self, url): return urlparse(url).scheme in ("http", "https") and bool(re.search(r"\.(?:m3u8|mp4)(?:$|[?#])", urlparse(url).path, re.I))
    def _probe_media(self, url):
        if not self._is_media(url): return ""
        try:
            r = self.session.get(url, headers={**self.headers, "Range": "bytes=0-4095"}, timeout=15, verify=False, stream=True, proxies=self.session.proxies or None); data = next(r.iter_content(4096), b""); ctype = r.headers.get("Content-Type", "").lower(); final = r.url
            if not r.ok: return ""
            if re.search(r"\.m3u8(?:$|[?#])", urlparse(final).path, re.I): return final if b"#EXTM3U" in data else ""
            return final if "video/" in ctype or data[4:12].find(b"ftyp") >= 0 else ""
        except Exception: return ""
    def _resolve_media(self, url, depth=0):
        url = self._fix(url)
        if self._is_media(url): return self._probe_media(url)
        if depth > 3: return ""
        body = self._html(url)
        m = re.search(r'player_data\s*=\s*(\{.*?\})', body, re.S)
        if m:
            try:
                value = json.loads(m.group(1)).get("url", "")
                if value: return self._resolve_media(urljoin(url, value), depth + 1)
            except Exception: pass
        m = re.search(r'(?:var\s+now|var\s+playurl)\s*=\s*["\']([^"\']+)', body)
        if m: return self._resolve_media(urljoin(url, m.group(1).replace("&amp;", "&")), depth + 1)
        frame = re.search(r'<iframe[^>]+src=["\']([^"\']+)', body, re.I)
        if frame: return self._resolve_media(urljoin(url, frame.group(1)), depth + 1)
        scopes = re.findall(r'<(?:script|video|source)[^>]*>.*?</(?:script|video|source)>|<(?:video|source)[^>]*>', body, re.I | re.S)
        haystack = "\n".join(scopes) if scopes else body
        candidates = re.findall(r'https?://[^"\'<>\s]+\.(?:m3u8|mp4)[^"\'<>\s]*', haystack, re.I)
        bad = re.compile(r'(?:^|[/_.-])(ad|ads|advert|preview|trailer|recommend|demo|sample)(?:[/_.-]|$)', re.I)
        candidates = list(dict.fromkeys(x.replace("&amp;", "&") for x in candidates if not bad.search(urlparse(x).path)))
        tokens = re.findall(r'[A-Za-z0-9]{4,}', urlparse(url).path + "?" + urlparse(url).query)
        current_ids = [x for x in tokens if any(c.isdigit() for c in x) and x.lower() not in ("html", "m3u8", "index")]
        candidates.sort(key=lambda x: (not any(i in x for i in current_ids), len(x)))
        return self._resolve_media(candidates[0], depth + 1) if candidates else url
    def _item(self, v): return {"vod_id": str(v.get("vod_id", "")), "vod_name": v.get("vod_name", ""), "vod_pic": self._fix(v.get("vod_pic", ""))}
    def homeContent(self, filter):
        d = self._json(self.api, {"ac": "list"}); return {"class": d.get("class", []), "list": [], "filters": {}}
    def homeVideoContent(self):
        d = self._json(self.api, {"ac": "detail", "pg": 1}); items = d.get("list", [])
        return {"list": [self._item(v) for v in items]}
    def categoryContent(self, tid, pg, filter, extend):
        pg = int(pg) if str(pg).isdigit() else 1; d = self._json(self.api, {"ac": "detail", "t": tid, "pg": pg})
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