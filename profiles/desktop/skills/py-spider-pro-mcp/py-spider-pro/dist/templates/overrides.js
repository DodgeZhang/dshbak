/**
 * 播放器覆盖模板（非video内容类型）
 * 注意：模板字符串内的${需转义为\${避免JS模板插值
 */
export const playerOverrides = {
  novel: `
    def playerContent(self, flag, id, vipFlags):
        url = self.host + id if not id.startswith("http") else id
        res = requests.get(url, headers=self.headers, timeout=10)
        html = etree.HTML(res.text)
        content = ""
        for sel in ['//div[contains(@class,"content")]//text()', '//div[contains(@class,"read")]//text()', '//div[@id="content"]//text()']:
            texts = html.xpath(sel)
            if texts:
                content = "\n".join(t.strip() for t in texts if t.strip())
                break
        return {"parse": 0, "play": content, "url": content, "header": {"User-Agent": "Mozilla/5.0"}}`,
  manga: `
    def playerContent(self, flag, id, vipFlags):
        url = self.host + id if not id.startswith("http") else id
        res = requests.get(url, headers=self.headers, timeout=10)
        html = etree.HTML(res.text)
        imgs = html.xpath('//div[contains(@class,"comic")]//img/@src|//div[contains(@class,"reader")]//img/@src')
        pages = "###".join(imgs) if imgs else ""
        return {"parse": 0, "play": pages, "url": pages, "header": {"User-Agent": "Mozilla/5.0"}}`,
  music: `
    def playerContent(self, flag, id, vipFlags):
        url = self.host + id if not id.startswith("http") else id
        res = requests.get(url, headers=self.headers, timeout=10)
        html = etree.HTML(res.text)
        # 提取音频链接
        audio_links = html.xpath('//audio[@src]/@src|//source[@src]/@src')
        if not audio_links:
            # 尝试从脚本中提取
            import re
            match = re.search(r'"(https?://[^"]+.mp3[^"]*)"', res.text)
            if match:
                audio_links = [match.group(1)]
        audio_url = audio_links[0] if audio_links else ""
        return {"parse": 0, "play": audio_url, "url": audio_url, "header": {"User-Agent": "Mozilla/5.0"}}`,
  image: `
    def playerContent(self, flag, id, vipFlags):
        url = self.host + id if not id.startswith("http") else id
        res = requests.get(url, headers=self.headers, timeout=10)
        html = etree.HTML(res.text)
        imgs = html.xpath('//div[contains(@class,"gallery")]//img/@src|//div[contains(@class,"photos")]//img/@src')
        pages = "###".join(imgs) if imgs else ""
        return {"parse": 0, "play": pages, "url": pages, "header": {"User-Agent": "Mozilla/5.0"}}`,
  short: `
    def playerContent(self, flag, id, vipFlags):
        url = self.host + id if not id.startswith("http") else id
        res = requests.get(url, headers=self.headers, timeout=10)
        html = etree.HTML(res.text)
        # 提取短视频链接
        video_links = html.xpath('//video[@src]/@src')
        if not video_links:
            # 尝试从iframe中提取
            iframe = html.xpath('//iframe[@src]')
            if iframe:
                iframe_url = iframe[0].get('src')
                if iframe_url:
                    if not iframe_url.startswith('http'):
                        iframe_url = self.host + iframe_url
                    iframe_res = requests.get(iframe_url, headers=self.headers, timeout=10)
                    iframe_html = etree.HTML(iframe_res.text)
                    video_links = iframe_html.xpath('//video[@src]/@src')
        video_url = video_links[0] if video_links else ""
        return {"parse": 0, "play": video_url, "url": video_url, "header": {"User-Agent": "Mozilla/5.0"}}`,
  live: `
    def playerContent(self, flag, id, vipFlags):
        url = self.host + id if not id.startswith("http") else id
        res = requests.get(url, headers=self.headers, timeout=10)
        html = etree.HTML(res.text)
        # 提取直播链接
        live_links = html.xpath('//iframe[@src]/@src|//video[@src]/@src')
        live_url = live_links[0] if live_links else ""
        return {"parse": 0, "play": live_url, "url": live_url, "header": {"User-Agent": "Mozilla/5.0"}}`,
  epub: `
    def playerContent(self, flag, id, vipFlags):
        url = self.host + id if not id.startswith("http") else id
        # 直接返回EPUB下载链接
        return {"parse": 0, "play": url, "url": url, "header": {"User-Agent": "Mozilla/5.0", "Accept": "application/epub+zip"}}`,
  pdf: `
    def playerContent(self, flag, id, vipFlags):
        url = self.host + id if not id.startswith("http") else id
        # 直接返回PDF下载链接
        return {"parse": 0, "play": url, "url": url, "header": {"User-Agent": "Mozilla/5.0", "Accept": "application/pdf"}}`
};

export const detailOverrides = {
  pp_variable: `
    def detailContent(self, ids):
        url = self.host + ids[0] if not ids[0].startswith("http") else ids[0]
        res = requests.get(url, headers=self.headers, timeout=10)
        html = etree.HTML(res.text)
        title = html.xpath('string(//h1|//h2)').strip()
        pic = html.xpath('string(//img/@data-original|//img/@data-src|//img/@src)')
        play_from, play_url = [], []
        # pp/la变量安全解析
        import re as _re, json as _json
        detail = _re.search(r'pp\\s*=\\s*"(.*?)";', res.text)
        if detail:
            try:
                la = _json.loads(detail.group(1).replace('\\\\/', '/'))
                groups = {}
                for item in la:
                    if len(item) < 5: continue
                    sid = item[0]
                    if sid not in groups: groups[sid] = {'name': item[1], 'eps': []}
                    groups[sid]['eps'].append({'index': item[2], 'url': item[4]})
                for sid, g in groups.items():
                    play_from.append(g['name'])
                    eps = sorted(g['eps'], key=lambda x: x['index'])
                    play_url.append('#'.join(f'第{e["index"]}集\\${'{e["url"]}' }' for e in eps))
            except: pass
        vod = {"vod_id": ids[0], "vod_name": title, "vod_pic": pic, "vod_play_from": "$$$ ".join(play_from), "vod_play_url": "$$$ ".join(play_url)}
        return {"list": [vod]}`,
  novel_chapter: `
    def detailContent(self, ids):
        url = self.host + ids[0] if not ids[0].startswith("http") else ids[0]
        res = requests.get(url, headers=self.headers, timeout=10)
        html = etree.HTML(res.text)
        title = html.xpath('string(//h1|//h2)').strip()
        pic = html.xpath('string(//img/@data-original|//img/@data-src|//img/@src)')
        # 提取章节列表
        chapters = html.xpath('//div[contains(@class,"chapter")]//a|//ul[contains(@class,"chapter")]//a')
        play_from, play_url = ["章节"], []
        chapter_list = []
        for i, chapter in enumerate(chapters):
            chapter_title = chapter.xpath('string(.)').strip()
            chapter_url = chapter.get('href')
            if chapter_url:
                if not chapter_url.startswith('http'):
                    chapter_url = self.host + chapter_url
                chapter_list.append(f'第{i+1}章 {chapter_title}\\${'{chapter_url}' }')
        play_url.append('#'.join(chapter_list))
        vod = {"vod_id": ids[0], "vod_name": title, "vod_pic": pic, "vod_play_from": "$$$ ".join(play_from), "vod_play_url": "$$$ ".join(play_url)}
        return {"list": [vod]}`,
  manga_chapter: `
    def detailContent(self, ids):
        url = self.host + ids[0] if not ids[0].startswith("http") else ids[0]
        res = requests.get(url, headers=self.headers, timeout=10)
        html = etree.HTML(res.text)
        title = html.xpath('string(//h1|//h2)').strip()
        pic = html.xpath('string(//img/@data-original|//img/@data-src|//img/@src)')
        # 提取章节列表
        chapters = html.xpath('//div[contains(@class,"chapter")]//a|//ul[contains(@class,"chapter")]//a')
        play_from, play_url = ["章节"], []
        chapter_list = []
        for i, chapter in enumerate(chapters):
            chapter_title = chapter.xpath('string(.)').strip()
            chapter_url = chapter.get('href')
            if chapter_url:
                if not chapter_url.startswith('http'):
                    chapter_url = self.host + chapter_url
                chapter_list.append(f'第{i+1}话 {chapter_title}\\${'{chapter_url}' }')
        play_url.append('#'.join(chapter_list))
        vod = {"vod_id": ids[0], "vod_name": title, "vod_pic": pic, "vod_play_from": "$$$ ".join(play_from), "vod_play_url": "$$$ ".join(play_url)}
        return {"list": [vod]}`,
  music_album: `
    def detailContent(self, ids):
        url = self.host + ids[0] if not ids[0].startswith("http") else ids[0]
        res = requests.get(url, headers=self.headers, timeout=10)
        html = etree.HTML(res.text)
        title = html.xpath('string(//h1|//h2)').strip()
        pic = html.xpath('string(//img/@data-original|//img/@data-src|//img/@src)')
        # 提取专辑歌曲
        songs = html.xpath('//div[contains(@class,"song")]//a|//ul[contains(@class,"song")]//a')
        play_from, play_url = ["歌曲"], []
        song_list = []
        for i, song in enumerate(songs):
            song_title = song.xpath('string(.)').strip()
            song_url = song.get('href')
            if song_url:
                if not song_url.startswith('http'):
                    song_url = self.host + song_url
                song_list.append(f'第{i+1}首 {song_title}\\${'{song_url}' }')
        play_url.append('#'.join(song_list))
        vod = {"vod_id": ids[0], "vod_name": title, "vod_pic": pic, "vod_play_from": "$$$ ".join(play_from), "vod_play_url": "$$$ ".join(play_url)}
        return {"list": [vod]}`
};
