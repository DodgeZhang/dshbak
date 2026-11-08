/**
 * API 采集模板 v3.0
 */
import { heredoc } from './heredoc.js';

export default function generate_api (p) {
  const safeHostPrefix = p.host ? p.host.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) : 'spider';
  const safeHost = p.host || 'example.com';
  const apiPath = p.analysis?.features?.api_path || '/api.php/provide/vod/';

  const code = heredoc(function (){/*
# -*- coding: utf-8 -*-
import json, requests
from base.spider import Spider

class Spider(Spider):
    def getName(self):
        return "${safeHostPrefix}"

    def init(self, extend=""):
        self.host = "https://${safeHost}"
        self.api = self.host + "${apiPath}"

    def homeContent(self, filter):
        res = requests.get(self.api, headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
        data = res.json() if isinstance(res.text, str) else res.json()
        classes = [{"type_name": c["type_name"], "type_id": str(c["type_id"])} for c in data.get("class", [])]
        videos = [{"vod_id": str(v["vod_id"]), "vod_name": v["vod_name"], "vod_pic": v.get("vod_pic",""), "vod_remarks": v.get("vod_remarks","")} for v in data.get("list", [])[:30]]
        return {"class": classes, "list": videos}

    def categoryContent(self, tid, pg, filter, extend):
        res = requests.get(f"{self.api}?tid={tid}&pg={pg}", headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
        data = res.json()
        videos = [{"vod_id": str(v["vod_id"]), "vod_name": v["vod_name"], "vod_pic": v.get("vod_pic","")} for v in data.get("list", [])]
        return {"list": videos, "page": int(pg), "pagecount": data.get("pagecount",1), "limit": data.get("limit",30), "total": data.get("total",0)}

    def detailContent(self, ids):
        res = requests.get(f"{self.api}?ids={ids[0]}", headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
        data = res.json()
        vlist = data.get("list", [])
        if not vlist: return {"list": []}
        return {"list": vlist}

    def searchContent(self, key, quick):
        res = requests.get(f"{self.api}?wd={key}", headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
        data = res.json()
        videos = [{"vod_id": str(v["vod_id"]), "vod_name": v["vod_name"], "vod_pic": v.get("vod_pic","")} for v in data.get("list", [])]
        return {"list": videos, "page": 1, "pagecount": 1, "limit": 20, "total": len(videos)}

    def playerContent(self, flag, id, vipFlags):
        res = requests.get(f"{self.api}?play={id}", headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
        data = res.json()
        url = ""
        for v in data.get("list", []):
            for s in v.get("vod_play_url","").split("#"):
                if "$" in s and s.split("$")[0] == id:
                    url = s.split("$",1)[1]
                    break
        return {"parse": 0, "play": url, "url": url, "header": {"User-Agent": "Mozilla/5.0"}}
*/});
  return code.replace(/\${safeHostPrefix}/g, safeHostPrefix).replace(/\${safeHost}/g, safeHost).replace(/\${apiPath}/g, apiPath);
}
