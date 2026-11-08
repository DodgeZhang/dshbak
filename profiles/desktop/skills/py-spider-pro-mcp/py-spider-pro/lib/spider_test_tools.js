/**
 * py-spider-pro 测试/评估/抓取工具 v1.0
 * 工具：test_interface, evaluate_source, fetch_url
 */
import { load } from 'cheerio';
import { inputSchemas, validateInput, createErrorResponse } from './validation.js';
import { fetchPage, fetchPagePost } from './http_client.js';
import { truncStr } from './utils.js';
import { FETCH_TRUNC_LIMIT, FETCH_FULL_LIMIT, FETCH_VIDEO_LIST_SELECTORS, FETCH_PLAY_AREA_SELECTORS } from './config.js';
import { parsePythonStructure } from './python_parser.js';

// ─── test_interface ────
export async function handleTestInterface (args) {
  const v = validateInput(inputSchemas.sourceCode, args.source_code);
  if (!v.success) return createErrorResponse('source_code: ' + v.error);
  const { source_code, interface: iface } = args;
  const results = [];
  const structure = parsePythonStructure(source_code);
  const spider = structure.classes.find(c => c.methods.some(m => [ 'homeContent','categoryContent','detailContent','searchContent','playerContent' ].includes(m.name)));
  const mm = {};
  if (spider) for (const m of spider.methods) mm[m.name] = m;
  const checks = {
    home: [
      { n: '方法已定义', t: !!mm.homeContent, s: 'critical' },
      { n: '返回JSON', t: /"class"/.test(source_code) || /'class'/.test(source_code), s: 'major' },
      { n: '异常处理', t: mm.homeContent ? mm.homeContent.hasExcept : /except/.test(source_code), s: 'major' }
    ],
    category: [
      { n: '方法已定义', t: !!mm.categoryContent, s: 'critical' },
      { n: 'contains匹配', t: /contains\(@class/.test(source_code), s: 'major' },
      { n: '去重(seen)', t: /seen/.test(source_code), s: 'major' },
      { n: 'URL补全(fix_url)', t: /fix_url/.test(source_code), s: 'major' }
    ],
    detail: [
      { n: '方法已定义', t: !!mm.detailContent, s: 'critical' },
      { n: '播放源(play_from)', t: /play_from/.test(source_code), s: 'critical' },
      { n: '$$$分隔', t: /\$\$\$/.test(source_code), s: 'major' },
      { n: '#剧集分隔', t: /"#"\.join/.test(source_code), s: 'major' },
      { n: 'pp变量安全', t: !(/if\s+item\s*\[\s*3\s*\]/.test(source_code) && /\b(?:pp|la)\s*=/.test(source_code) && !/len\(item\)/.test(source_code)), s: 'major' }
    ],
    search: [
      { n: '方法已定义', t: !!mm.searchContent, s: 'critical' },
      { n: '搜索URL', t: /search|wd/.test(source_code), s: 'major' },
      { n: '去重(seen)', t: /seen/.test(source_code), s: 'major' }
    ],
    play: [
      { n: '方法已定义', t: !!mm.playerContent, s: 'critical' },
      { n: '直链检测', t: /\.m3u8|\.mp4/.test(source_code), s: 'major' },
      { n: 'JS变量提取', t: /var\s+now|player_data/.test(source_code), s: 'major' }
    ]
  };
  const targets = iface === 'all' ? Object.keys(checks) : [ iface ];
  for (const t of targets) { if (checks[t]) for (const c of checks[t]) results.push({ interface: t, check: c.n, pass: c.t, severity: c.s }); }
  const passed = results.filter(r => r.pass).length;
  const critFail = results.filter(r => !r.pass && r.severity === 'critical').length;
  const majFail = results.filter(r => !r.pass && r.severity === 'major').length;
  const score = Math.round((passed / results.length) * 100);

  let info = '\n⚠️ 未检测到Spider类';
  if (spider) {
    const defined = spider.methods
      .map(m => m.name)
      .filter(n => [ 'homeContent','categoryContent','detailContent','searchContent','playerContent' ].includes(n));
    const missing = [ 'homeContent','categoryContent','detailContent','searchContent','playerContent' ]
      .filter(n => !defined.includes(n));
    info = `\n🔬 ${spider.name}${spider.parent ? ` extends ${spider.parent}` : ''}`
      + ` | 已定义: ${defined.join(',') || '无'} | 缺失: ${missing.join(',') || '无'}`;
  }

  const resultText = `🧪 接口测试(${iface}) ${passed}/${results.length}(${score}%)`
    + `\n严重❌:${critFail} 主要❌:${majFail}`
    + `\n${results.map(r => `${r.pass ? '✅' : '❌'}[${r.severity}][${r.interface}]${r.check}`).join('\n')}${info}`;

  return { content: [ { type: 'text', text: resultText } ] };
}

// ─── evaluate_source ────
export async function handleEvaluateSource (args) {
  const v = validateInput(inputSchemas.sourceCode, args.source_code);
  if (!v.success) return createErrorResponse('source_code: ' + v.error);
  const { source_code } = args;
  const rules = [
    { n: 'lxml+etree', t: /from lxml import/.test(source_code), w: 10 },
    { n: 'contains匹配', t: /contains\(@class/.test(source_code), w: 15 },
    { n: '禁止@class=', t: !/\/\*\[@class="[^"]*"\]/.test(source_code) || /contains/.test(source_code), w: 15 },
    { n: '多级兜底', t: /if not items/.test(source_code), w: 10 },
    { n: '去重(seen)', t: /seen/.test(source_code), w: 10 },
    { n: 'URL补全', t: /fix_url/.test(source_code), w: 10 },
    { n: '异常处理', t: (source_code.match(/except/g) || []).length >= 3, w: 5 },
    { n: '$$$/#分隔', t: /\$\$\$/.test(source_code) && /"#"\.join/.test(source_code), w: 10 },
    { n: 'pp变量安全', t: !(/\b(?:pp|la)\s*=/.test(source_code) && /if\s+item\s*\[\s*\d+\s*\]/.test(source_code) && !/len\(item\)/.test(source_code)), w: 15 }
  ];
  const results = rules.map(r => ({ ...r, pass: r.t }));
  const totalW = rules.reduce((s, r) => s + r.w, 0);
  const passW = results.filter(r => r.pass).reduce((s, r) => s + r.w, 0);
  const score = Math.round((passW / totalW) * 100);
  const grade = score >= 90 ? 'S' : score >= 80 ? 'A' : score >= 60 ? 'B' : 'C';
  return { content: [ { type: 'text', text: `📊 规范评估 ${grade}(${score}分) ${passW}/${totalW}\n${results.map(r => `${r.pass ? '✅' : '❌'}[${r.w}分]${r.n}`).join('\n')}\n${results.filter(r => !r.pass).map(r => `⚠️${r.n}`).join('\n') || '🎉全通过'}` } ] };
}

// ─── fetch_url ────
export async function handleFetchUrl (args) {
  const v = validateInput(inputSchemas.url, args.url); if (!v.success) return createErrorResponse(v.error);
  const { url, region = 'video_list' } = args;
  const method = (args.method || 'GET').toUpperCase();
  let headers = {};
  if (args.headers) { try { headers = JSON.parse(args.headers); } catch (_) { return createErrorResponse('headers JSON错误'); } }
  if (args.cf_cookie) headers['Cookie'] = (headers['Cookie'] ? headers['Cookie'] + '; ' : '') + 'cf_clearance=' + args.cf_cookie;
  try {
    let html;
    if (args.html) html = args.html;
    else if (method === 'POST') html = await fetchPagePost(url, { body: args.body || '', extraHeaders: headers });
    else html = await fetchPage(url, { extraHeaders: headers, useCache: args.use_cache === true });
    const $ = load(html); let result = '';
    if (region === 'video_list') {
      const sels = FETCH_VIDEO_LIST_SELECTORS;
      for (const s of sels) { if ($(s).length > 0) { result = $(s).first().html(); break; } }
      if (!result) result = $('body').html()?.slice(0, FETCH_TRUNC_LIMIT) || '';
    } else if (region === 'play_area') {
      const sels = FETCH_PLAY_AREA_SELECTORS;
      for (const s of sels) { if ($(s).length > 0) { result = $(s).first().parent().html(); break; } }
      if (!result) result = $('body').html()?.slice(0, FETCH_TRUNC_LIMIT) || '';
    } else result = (typeof html === 'string' ? html : JSON.stringify(html)).slice(0, FETCH_FULL_LIMIT);
    return { content: [ { type: 'text', text: truncStr(result, FETCH_TRUNC_LIMIT) } ] };
  } catch (e) { return createErrorResponse('抓取失败: ' + e.message); }
}
