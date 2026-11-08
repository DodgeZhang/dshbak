#!/usr/bin/python
import json
import re
from urllib.parse import urljoin, urlparse
import requests
from lxml import etree
from base.spider import Spider

class Spider(Spider):
    def getName(self): return "站点名"
    def init(self, extend=""):
        self.name = "站点名"
        self.host = "https://example.com"
        self.headers = {"User-Agent": "Mozilla/5.0", "Referer": self.host + "/"}
        self.categories = []
        self.session = requests.Session(); self.session.headers.update(self.headers)
    def _get(self, url):
        try:
            r = self.session.get(url, headers=self.headers, timeout=15, verify=False, proxies=self.session.proxies or None); r.encoding = r.apparent_encoding or "utf-8"; return r.text
        except Exception: return ""
    def _fix(self, url): return urljoin(self.host + "/", url or "")
    def _is_media(self, url): return bool(re.search(r"\.(?:m3u8|mp4)(?:$|[?#])", urlparse(url).path, re.I))
    def _resolve_media(self, url, depth=0):
        url = self._fix(url)
        if self._is_media(url) or depth > 3: return url
        body = self._get(url)
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
    def _text(self, node): return " ".join("".join(node.xpath(".//text()")).split()) if node is not None else ""
    def _pagecount(self, html, pg):
        tree = etree.HTML(html or ""); nums = []
        nodes = tree.xpath('//*[contains(@class,"page") or contains(@class,"pagination") or contains(@class,"pager")]//a')
        for a in nodes:
            href = a.get("href", ""); text = "".join(a.xpath(".//text()")).strip()
            m = re.search(r"(?:[?&]page=|/page/)(\d+)", href, re.I)
            if m: nums.append(int(m.group(1)))
            elif text.isdigit(): nums.append(int(text))
        nxt = tree.xpath('//a[@rel="next" or contains(@class,"next") or contains(normalize-space(.),"下一页")]')
        return max(nums + [pg + 1 if nxt else pg])
    def _list(self, html):
        tree = etree.HTML(html or ""); out = []; seen = set()
        items = tree.xpath('//a[contains(@class,"videopic")]') or tree.xpath('//div[contains(@class,"item")]//a[.//img]') or tree.xpath('//a[contains(@href,"/movie/") and .//img]')
        for a in items:
            try:
                href = self._fix(a.get("href")); m = re.search(r"(?:index|detail)?(\d+)\.html", href)
                if not m or m.group(1) in seen: continue
                seen.add(m.group(1)); img = a.xpath('.//img')[0] if a.xpath('.//img') else None
                pic = self._fix((img.get("data-original") or img.get("data-src") or img.get("src")) if img is not None else "")
                name = a.get("title") or (img.get("alt") if img is not None else "") or self._text(a)
                out.append({"vod_id": m.group(1), "vod_name": name, "vod_pic": pic})
            except Exception: continue
        return out
    def homeContent(self, filter): return {"class": self.categories, "list": self._list(self._get(self.host)), "filters": {}}
    def homeVideoContent(self): return {"list": self._list(self._get(self.host))}
    def categoryContent(self, tid, pg, filter, extend):
        pg = int(pg) if str(pg).isdigit() else 1; html = self._get(f"{self.host}/search.php?searchtype=5&tid={tid}&page={pg}"); items = self._list(html); limit = len(items) or 20; pagecount = self._pagecount(html, pg)
        return {"page": pg, "pagecount": pagecount, "limit": limit, "total": 0, "list": items}
    def detailContent(self, ids):
        out = []
        for vid in ids:
            try:
                tree = etree.HTML(self._get(f"{self.host}/movie/index{vid}.html")); name = self._text(tree.xpath("//h1 | //h2")[0]) if tree.xpath("//h1 | //h2") else str(vid)
                pic = self._fix((tree.xpath('//div[contains(@class,"pic")]//img/@src') or tree.xpath('//img/@data-original') or [""])[0])
                fs = []; us = []
                for panel in tree.xpath('//div[contains(@class,"panel")]') or tree.xpath('//div[contains(@class,"playlist")]'):
                    opt = panel.xpath('.//a[contains(@class,"option")]'); source = (opt[0].get("title") or self._text(opt[0])) if opt else f"线路{len(fs)+1}"
                    eps = panel.xpath('.//ul[contains(@class,"playlistlink")]//a') or panel.xpath('.//ul//a[contains(@href,"/play/")]')
                    links = [self._text(a) + "$" + self._fix(a.get("href")) for a in eps if a.get("href")]
                    if links: fs.append(source); us.append("#".join(links))
                out.append({"vod_id": str(vid), "vod_name": name, "vod_pic": pic, "vod_play_from": "$$$".join(fs), "vod_play_url": "$$$".join(us)})
            except Exception: continue
        return {"list": out}
    def searchContent(self, key, quick, pg="1"):
        try: r = self.session.post(self.host + "/search.php", data={"searchword": key}, headers=self.headers, timeout=15, verify=False, proxies=self.session.proxies or None); r.encoding = r.apparent_encoding or "utf-8"; return {"list": self._list(r.text), "page": int(pg)}
        except Exception: return {"list": [], "page": int(pg)}
    def playerContent(self, flag, id, vipFlags):
        url = self._resolve_media(id)
        return {"parse": 0 if self._is_media(url) else 1, "url": url, "header": json.dumps(self.headers)}
