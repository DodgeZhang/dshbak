# -*- coding: utf-8 -*-
# tvbox hipy py 源骨架模板 —— 复制本文件改名后按 TODO 填充
import sys
import math
import urllib.parse

sys.path.append('..')
try:
    from base.spider import Spider
except ImportError:
    class Spider:
        def fetch(self, url, headers=None, **kw):
            import requests as rq
            kw.pop('timeout', None)
            r = rq.get(url, headers=headers, timeout=15, **kw)
            r.encoding = 'utf-8'
            return r

import requests

# TODO: 改成目标站点
HOST = "https://example.com"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
HEADERS = {"User-Agent": UA, "Referer": HOST + "/"}

# TODO: 分类映射 type_id -> 名称；HTML 站用站点真实分类 id
CATEGORIES = {"1": "电影", "2": "电视剧", "3": "综艺", "4": "动漫"}


class Spider(Spider):
    def init(self, extend=""):
        return ""

    def getName(self):
        return "示例源"

    def isVideoFormat(self, url):
        pass

    def manualVideoCheck(self):
        pass

    def _vod(self, item):
        # TODO: 按站点字段映射
        return {
            "vod_id": item.get("id", ""),
            "vod_name": item.get("title", ""),
            "vod_pic": item.get("cover", ""),
            "vod_remarks": item.get("remark", ""),
        }

    def homeContent(self, filter=False):
        cls = [{"type_id": k, "type_name": v} for k, v in CATEGORIES.items()]
        return {"class": cls, "list": []}

    def homeVideoContent(self):
        # TODO: 首页推荐
        return {"list": []}

    def categoryContent(self, tid, pg=1, filter=False, extend=""):
        try:
            page = max(int(str(pg)), 1)
        except Exception:
            page = 1
        # TODO: 拼分类页 URL 或 API
        url = "%s/list/%s-%d.html" % (HOST, tid, page)
        # data = requests.get(url, headers=HEADERS, timeout=10).json()
        return {
            "page": page, "pagecount": 1, "limit": 40, "total": 0,
            "list": [],
        }

    def detailContent(self, ids):
        vid = ids[0] if isinstance(ids, list) and ids else str(ids or "")
        if not vid:
            return {"list": []}
        # TODO: 详情 + 剧集
        # 单线路: play_from="线路名", play_url="第1集$id1#第2集$id2"
        # 多线路: 用 $$$ 连接, 段数与 play_from 一一对应
        return {"list": [{
            "vod_id": vid, "vod_name": "", "vod_pic": "",
            "vod_actor": "", "vod_director": "", "vod_content": "",
            "vod_remarks": "", "vod_play_from": "", "vod_play_url": "",
        }]}

    def searchContent(self, key, quick=False, pg="1"):
        k = urllib.parse.quote(str(key or "").strip())
        # TODO: 搜索 URL
        return {"list": []}

    def playerContent(self, flag, id, vipFlags=None):
        # id = 剧集段 $ 后面的部分；flag = 线路名
        # TODO: 直链返回 parse 0；需嗅探的播放页返回 parse 1 + url=播放页
        url = ""
        if not url:
            return {"parse": 1, "playUrl": "", "url": "", "header": HEADERS}
        direct = any(x in url for x in (".m3u8", ".mp4", ".mkv", ".flv", ".ts"))
        return {"parse": 0 if direct else 1, "playUrl": "", "url": url, "header": HEADERS}

    def localProxy(self, param):
        return None
