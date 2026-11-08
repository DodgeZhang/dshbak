/**
 * MacCMS v8 模板 v3.0
 * 生成可运行的代码，使用合理的默认选择器
 */
import { heredoc, renderTemplate } from './heredoc.js';

export default function generate_v8 (p) {
  const safeHostPrefix = p.host ? p.host.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) : 'spider';
  const safeHost = p.host || 'example.com';
  const videoSel = p.selectors?.video_list?.selector || "//div[contains(@class,'vodlist')]//a|//div[contains(@class,'stui-vodlist')]//a";
  const picAttr = p.selectors?.pic_attr || 'data-original';
  const playSourceSel = p.selectors?.play_source?.selector || "//div[contains(@class,'play_source')]//h3|//ul[contains(@class,'nav-tabs')]//a";
  const episodeListSel = p.selectors?.episode_list?.selector || "//div[contains(@class,'playlist')]//a|//div[contains(@class,'content__playlist')]//a";

  const classList = p.categories ? p.categories.map(c =>
    `{"type_id": ${c.tid || 1}, "type_name": "${c.name || '分类'}"}`
  ).join(',\n                ') : '{"type_id": 1, "type_name": "电影"}, {"type_id": 2, "type_name": "电视剧"}, {"type_id": 3, "type_name": "综艺"}, {"type_id": 4, "type_name": "动漫"}';

  const template = heredoc(function (){/*
# -*- coding: utf-8 -*-
import re, json, requests, urllib.parse
from lxml import etree
from base.spider import Spider

class Spider(Spider):
    def getName(self):
        return "${safeHostPrefix}"

    def init(self, extend=""):
        self.host = "https://${safeHost}"
        self.headers = {"User-Agent": "Mozilla/5.0"}

    def homeContent(self, filter):
        url = self.host
        res = requests.get(url, headers=self.headers, timeout=10)
        html = etree.HTML(res.text)
        classes = [${classList}]
        videos = []
        items = html.xpath('${videoSel}')
        for item in items[:30]:
            a = item if item.tag == 'a' else item.xpath('.//a')[0] if item.xpath('.//a') else None
            if not a: continue
            name = a.xpath('string(.)').strip() or a.get('title','')
            pic = a.xpath(f'.//img/@{picAttr}')[0] if a.xpath(f'.//img/@{picAttr}') else ''
            href = a.get('href','')
            vid = href
            videos.append({"vod_id": vid, "vod_name": name, "vod_pic": pic, "vod_remarks": ""})
        return {"class": classes, "list": videos}

    def categoryContent(self, tid, pg, filter, extend):
        url = self.host + f"/index.php/vod/show/id/{tid}/page/{pg}.html" if tid else self.host
        res = requests.get(url, headers=self.headers, timeout=10)
        html = etree.HTML(res.text)
        videos = []
        seen = set()
        items = html.xpath('${videoSel}')
        if not items:
            items = html.xpath('//div[contains(@class,"vodlist")]//a')
        for item in items[:30]:
            a = item if item.tag == 'a' else item.xpath('.//a')[0] if item.xpath('.//a') else None
            if not a: continue
            name = a.xpath('string(.)').strip() or a.get('title','')
            if name in seen: continue
            seen.add(name)
            pic = a.xpath(f'.//img/@{picAttr}')[0] if a.xpath(f'.//img/@{picAttr}') else ''
            href = a.get('href','')
            videos.append({"vod_id": href, "vod_name": name, "vod_pic": pic, "vod_remarks": ""})
        return {"list": videos, "page": int(pg), "pagecount": 999, "limit": 30, "total": 999}

    def detailContent(self, ids):
        url = self.host + ids[0] if not ids[0].startswith("http") else ids[0]
        res = requests.get(url, headers=self.headers, timeout=10)
        html = etree.HTML(res.text)
        title = html.xpath('string(//h1|//h2)').strip()
        pic = html.xpath('string(//img[contains(@class,"lazy")]/@data-original|//img[contains(@class,"lazy")]/@data-src|//div[@class="vodlist"]//img/@src)')
        play_sources = html.xpath('${playSourceSel}')
        play_from = [s.xpath('string(.)').strip() for s in play_sources] if play_sources else []
        episode_lists = html.xpath('${episodeListSel}')
        play_url = []
        for i, source in enumerate(play_sources if play_sources else [1]):
            eps = episode_lists[i].xpath('.//a') if i < len(episode_lists) else html.xpath('//div[contains(@class,"playlist")]//a')
            ep_list = []
            seen = set()
            for a in eps:
                txt = a.xpath('string(.)').strip()
                if txt in seen: continue
                seen.add(txt)
                href = a.get('href','')
                ep_list.append(txt + '$' + href)
            play_url.append('#'.join(ep_list))
        vod = {"vod_id": ids[0], "vod_name": title, "vod_pic": pic, "vod_play_from": "$$$".join(play_from), "vod_play_url": "$$$".join(play_url)}
        return {"list": [vod]}

    def searchContent(self, key, quick):
        url = self.host + f"/index.php/vod/search.html?wd={urllib.parse.quote(key)}"
        res = requests.get(url, headers=self.headers, timeout=10)
        html = etree.HTML(res.text)
        videos = []
        seen = set()
        items = html.xpath('//div[contains(@class,"vodlist")]//a|//div[contains(@class,"list")]//a|//li[contains(@class,"item")]//a')
        for a in items[:20]:
            name = a.xpath('string(.)').strip() or a.get('title','')
            if name in seen or not name: continue
            seen.add(name)
            pic = a.xpath(f'.//img/@{picAttr}')[0] if a.xpath(f'.//img/@{picAttr}') else ''
            videos.append({"vod_id": a.get('href',''), "vod_name": name, "vod_pic": pic, "vod_remarks": ""})
        return {"list": videos, "page": 1, "pagecount": 1, "limit": 20, "total": len(videos)}

    def playerContent(self, flag, id, vipFlags):
        url = self.host + id if not id.startswith("http") else id
        res = requests.get(url, headers=self.headers, timeout=10)
        html_text = res.text
        play_url = ""
        patterns = [
            r'var\s+now\s*=\s*["\']([^"\']+)["\']',
            r'unescape\(["\']([^"\']+)["\']\)',
            r'(https?://[^"\']+\.m3u8[^"\']*)',
            r'(https?://[^"\']+\.mp4[^"\']*)',
        ]
        for pattern in patterns:
            m = re.search(pattern, html_text)
            if m:
                play_url = m.group(1)
                if 'unescape' in pattern:
                    play_url = urllib.parse.unquote(play_url)
                break
        if play_url and not play_url.startswith("http"):
            play_url = "https://" + self.host + play_url if play_url.startswith("/") else "https:" + play_url
        return {"parse": 0, "play": play_url, "url": play_url, "header": {"User-Agent": "Mozilla/5.0"}}
*/});
  return renderTemplate(template, { ...p, safeHostPrefix, safeHost, videoSel, picAttr, playSourceSel, episodeListSel, classList });
}
