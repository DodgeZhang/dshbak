/**
 * py-spider-pro 调试模块
 * 功能：选择器调试、播放链接解析
 */
import { load } from 'cheerio';
import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';

import { fetchPage } from './http_client.js';
import { getHost } from './url_utils.js';
import { DEBUG_DISPLAY_COUNT, DEBUG_RESULT_SLICE, MAX_IFRAME_DEPTH, XPATH_EXACT_CLASS_PATTERN, logger } from './config.js';
import { createErrorResponse } from './validation.js';
import { validateRegexSafety, safeRegexExec } from './regex_safe.js';

/**
 * 工具: debug_selector - 调试 CSS/XPath 选择器
 * @param {object} args - 输入参数
 * @param {string} args.url - 页面 URL
 * @param {string} args.selector - CSS 或 XPath 选择器
 * @param {string} [args.extract] - 提取属性（text/html/attr:name）
 * @returns {object} MCP 响应格式
 */
export async function handleDebugSelector (args) {
  const { url, selector, extract = 'text' } = args;

  try {
    const html = await fetchPage(url);

    // 判断选择器类型
    const isXPath = selector.startsWith('//') || selector.startsWith('/@') || selector.startsWith('./');

    if (isXPath) {
      // XPath 选择器处理
      const $x = load(html, { xmlMode: false });
      const doc = new DOMParser({
        errorHandler: {
          warning: () => {},
          error: () => {},
          fatalError: (error) => { throw error; }
        }
      }).parseFromString($x.html(), 'text/html');

      const nodes = xpath.select(selector, doc);
      const results = nodes.slice(0, DEBUG_DISPLAY_COUNT).map(node =>
        node.nodeType === 2 ? node.value : (node.textContent || '').trim().slice(0, DEBUG_RESULT_SLICE)
      );

      // XPath 精确类选择器警告
      const warnings = XPATH_EXACT_CLASS_PATTERN.test(selector)
        ? [ "⚠️ 建议使用 contains(@class, 'xxx') 替代精确匹配" ]
        : [];

      return {
        content: [ {
          type: 'text',
          text: `📊 XPath 调试结果 | ${url}\n匹配数量: ${nodes.length}\n${results.map((result, index) => `[${index + 1}] ${result || '(空)'}`).join('\n')}${warnings.length ? '\n' + warnings.join('\n') : ''}`
        } ]
      };
    }

    // CSS 选择器处理
    const $ = load(html);
    const elements = $(selector);

    const results = elements.slice(0, DEBUG_DISPLAY_COUNT).map((_, element) => {
      if (extract === 'html') {
        return $(element).html()?.slice(0, 300);
      }
      if (extract.startsWith('attr:')) {
        const attrName = extract.split(':')[1];
        return $(element).attr(attrName);
      }
      return $(element).text().trim().slice(0, DEBUG_RESULT_SLICE);
    }).get();

    return {
      content: [ {
        type: 'text',
        text: `📊 CSS 选择器调试结果 | ${url}\n匹配数量: ${elements.length}\n${results.map((result, index) => `[${index + 1}] ${result || '(空)'}`).join('\n')}`
      } ]
    };

  } catch (error) {
    return createErrorResponse('调试失败: ' + error.message);
  }
}

/**
 * 提取播放链接（递归解析）
 * @param {string} url - 播放页 URL 或疑似直链
 * @param {string} pageUrl - 上级页面 URL（用于 Referer）
 * @param {number} depth - 当前递归深度
 * @returns {{direct: boolean, type?: string, url?: string, methods?: Array, warning?: string}} 解析结果
 */
async function extractPlayLinks (url, pageUrl, depth = 0) {
  const host = getHost(url);

  /**
   * 修复 URL（处理相对路径和协议相对路径）
   * @param {string} url - 待修复的 URL
   * @returns {string} 修复后的完整 URL
   */
  const fixUrlHelper = (url) => {
    if (!url) return '';
    if (url.startsWith('//')) return 'https:' + url;
    if (url.startsWith('/')) return 'https://' + host + url;
    return url;
  };

  // 检测直链（使用安全正则）
  const m3u8Pattern = '\\.m3u8(\\?|$)';
  const mp4Pattern = '\\.mp4(\\?|$)';
  if ((await safeRegexExec(m3u8Pattern, url)).success ||
      (await safeRegexExec(mp4Pattern, url)).success) {
    return {
      direct: true,
      type: url.includes('.m3u8') ? 'm3u8' : 'mp4',
      url
    };
  }

  // 检查递归深度
  if (depth >= MAX_IFRAME_DEPTH) {
    return { direct: false, methods: [], warning: 'iframe 嵌套深度超限' };
  }

  try {
    const body = await fetchPage(url, {
      extraHeaders: { Referer: pageUrl || `https://${host}` }
    });

    const foundMethods = [];

    // 定义播放链接提取模式（使用字符串模式以便安全验证）
    const patterns = [
      [ "var\\s+now\\s*=\\s*[\"']([^\"']+)[\"']", 'v8(now=)' ],
      [ 'player_data\\s*=\\s*(\\{.*?\\})', 'v10(player_data)' ],
      [ "var\\s+playurl\\s*=\\s*[\"']([^\"']+)[\"']", '通用(playurl)' ],
      [ "(https?:\\/\\/[^\"']+\\.m3u8[^\"']*)", 'm3u8直链' ],
      [ "(https?:\\/\\/[^\"']+\\.mp4[^\"']*)", 'mp4直链' ]
    ];

    // 应用模式匹配（使用安全正则执行）
    for (const [ patternStr, methodName ] of patterns) {
      const safety = validateRegexSafety(patternStr);
      if (!safety.safe) {
        logger.warn(`跳过不安全正则模式: ${patternStr} (${safety.reason})`);
        continue;
      }

      const result = await safeRegexExec(patternStr, body);
      if (result.success && result.result) {
        let extractedUrl = result.result[1];
        // 处理 player_data JSON
        if (methodName.includes('player_data')) {
          try {
            const playerData = JSON.parse(result.result[1].replace(/'/g, '"'));
            extractedUrl = playerData.url || result.result[1];
          } catch {
            extractedUrl = result.result[1];
          }
        }
        foundMethods.push({ method: methodName, url: fixUrlHelper(extractedUrl) });
      }
    }

    // 处理 xgplayer 配置（使用安全正则）
    const xgplayerPattern = 'playerConfig\\s*=\\s*(\\{[^;]*?\\})\\s*;';
    if (validateRegexSafety(xgplayerPattern).safe) {
      const xgplayerResult = await safeRegexExec(xgplayerPattern, body);
      if (xgplayerResult.success && xgplayerResult.result) {
        try {
          const playerConfig = JSON.parse(
            xgplayerResult.result[1]
              .replace(/'/g, '"')
              .replace(/(\w+)\s*:/g, '"$1":')
          );
          if (playerConfig.url) {
            foundMethods.push({ method: 'xgplayer', url: fixUrlHelper(playerConfig.url) });
          }
        } catch (_) {
          // 解析失败忽略
        }
      }
    }

    // iframe 递归解析（使用安全正则）
    const iframePattern = "<iframe[^>]+src=[\"']([^\"']+)[\"']";
    if (validateRegexSafety(iframePattern).safe) {
      const iframeResult = await safeRegexExec(iframePattern, body);
      if (iframeResult.success && iframeResult.result) {
        const iframeUrl = fixUrlHelper(iframeResult.result[1]);
        if (iframeUrl) {
          const iframeParseResult = await extractPlayLinks(iframeUrl, url, depth + 1);
          if (iframeParseResult.direct) {
            foundMethods.push({ method: `iframe${depth + 1}直链`, url: iframeParseResult.url });
          } else if (iframeParseResult.methods?.length) {
            foundMethods.push(...iframeParseResult.methods);
          }
        }
      }
    }

    return { direct: false, methods: foundMethods };

  } catch (error) {
    return { direct: false, methods: [], warning: error.message };
  }
}

/**
 * 工具: debug_play_link - 调试播放链接提取
 * @param {object} args - 输入参数
 * @param {string} args.url - 播放页 URL 或疑似直链
 * @param {string} [args.page_url] - 上级页面 URL
 * @returns {object} MCP 响应格式
 */
export async function handleDebugPlayLink (args) {
  const { url, page_url: pageUrl } = args;

  try {
    const result = await extractPlayLinks(url, pageUrl);

    // 直链结果
    if (result.direct) {
      return {
        content: [ {
          type: 'text',
          text: `🎬 检测到直链 | 类型: ${result.type}\n${result.url}`
        } ]
      };
    }

    // 无结果
    if (!result.methods?.length) {
      return {
        content: [ {
          type: 'text',
          text: `❌ 未找到播放链接${result.warning ? '\n⚠️ ' + result.warning : ''}`
        } ]
      };
    }

    // 显示找到的方法
    return {
      content: [ {
        type: 'text',
        text: `🎬 播放链接调试结果 | ${url}\n${result.methods.map((methodInfo, index) => `[${index + 1}] ${methodInfo.method}: ${methodInfo.url}`).join('\n')}${result.warning ? '\n⚠️ ' + result.warning : ''}`
      } ]
    };

  } catch (error) {
    return createErrorResponse(error.message);
  }
}
