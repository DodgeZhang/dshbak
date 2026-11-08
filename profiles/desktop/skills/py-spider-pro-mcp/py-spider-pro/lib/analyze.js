/**
 * py-spider-pro 网站分析模块
 * 功能：网站深度分析、批量分析
 */
import { load } from 'cheerio';

import {
  inputSchemas,
  validateInput,
  createErrorResponse
} from './validation.js';
import { fetchPage } from './http_client.js';
import { getHost, getBase } from './url_utils.js';
import { setCacheEntry } from './cache.js';
import { HTTP_TIMEOUT, ANALYSIS_TOTAL_TIMEOUT, logger } from './config.js';
import { TimeoutError, NetworkError, CloudflareError } from './errors.js';
import {
  detectCmsByPath,
  detectTemplateFeatures,
  extractCategoryNav,
  detectVideoListSelector,
  buildCategoryUrl,
  analyzeCategoryPage,
  buildParallelTasks,
  mergeParallelResults,
  formatAnalysisReport
} from './analyze_orchestrator.js';
import { addHistory } from './history_manager.js';

/**
 * 核心网站分析函数
 * @param {string} url - 目标网站 URL
 * @param {object} analysisCache - 分析缓存对象
 * @param {object} options - 分析选项
 * @param {string} [options.html] - 预获取的 HTML 内容
 * @param {string} [options.cf_cookie] - Cloudflare 验证 Cookie
 * @returns {{result: object, progress: string[]}} 分析结果和进度
 */
export async function coreAnalyzeWebsite (url, analysisCache, options = {}) {
  const { html: providedHtml, cf_cookie: cfCookie } = options;
  const host = getHost(url);
  const base = getBase(url);
  const startTime = Date.now();

  logger.info(`开始网站分析: ${url}`, { host, base });

  const analysisResult = {
    url,
    host,
    base,
    cms_type: 'unknown',
    features: {},
    selectors: {},
    filters: {},
    sample_data: {},
    warnings: []
  };

  const progressSteps = [];

  const checkTimeout = () => {
    if (Date.now() - startTime > ANALYSIS_TOTAL_TIMEOUT) {
      throw new TimeoutError('分析超时', 'coreAnalyzeWebsite');
    }
  };

  progressSteps.push('① 首页获取...');
  let homeHtml;

  if (providedHtml) {
    homeHtml = providedHtml;
    progressSteps.push('✅ 使用预提供的 HTML');
    logger.debug('使用预提供的 HTML 内容');
  } else {
    try {
      const fetchOptions = {
        timeout: HTTP_TIMEOUT,
        extraHeaders: cfCookie ? { Cookie: cfCookie } : {}
      };
      logger.debug('开始获取首页', { url, timeout: HTTP_TIMEOUT });
      homeHtml = await fetchPage(url, fetchOptions);
      logger.debug('首页获取成功', { length: homeHtml.length });
    } catch (err) {
      logger.error('fetchPage error:', err.message, { url });
      if (err instanceof CloudflareError) {
        throw err;
      }
      throw new NetworkError('首页不可达: ' + err.message, url);
    }
  }

  const $home = load(homeHtml);
  progressSteps.push('✅ 首页获取成功');
  checkTimeout();

  const cmsType = await detectCmsByPath(homeHtml);
  if (cmsType) {
    analysisResult.cms_type = cmsType;
  }

  const templateFeatures = await detectTemplateFeatures($home, homeHtml);
  Object.assign(analysisResult.features, templateFeatures.features);
  if (templateFeatures.cms_type && analysisResult.cms_type === 'unknown') {
    analysisResult.cms_type = templateFeatures.cms_type;
  }

  progressSteps.push('② 分类导航提取...');
  const categoryLinks = await extractCategoryNav($home, host);
  analysisResult.sample_data.categories = categoryLinks;

  progressSteps.push('③ 视频选择器检测...');
  const videoResult = detectVideoListSelector($home, host);
  if (videoResult) {
    analysisResult.selectors.video_list = videoResult.video_list;
    analysisResult.selectors.detail_url_pattern = videoResult.detail_url_pattern;
    analysisResult.selectors.pic_attr = videoResult.pic_attr;
  }

  progressSteps.push('④ 分类页验证...');
  checkTimeout();
  const categoryUrl = buildCategoryUrl(analysisResult.cms_type, categoryLinks, base, homeHtml);
  let detailUrl = '';

  if (categoryUrl) {
    const categoryResult = await analyzeCategoryPage(categoryUrl, host, !!videoResult, cfCookie);
    if (categoryResult.warning) {
      analysisResult.warnings.push(categoryResult.warning);
    }
    if (categoryResult.videoResult) {
      analysisResult.selectors.video_list = categoryResult.videoResult.video_list;
      analysisResult.selectors.detail_url_pattern = categoryResult.videoResult.detail_url_pattern;
      analysisResult.selectors.pic_attr = categoryResult.videoResult.pic_attr;
    }
    if (categoryResult.pagination.length) {
      analysisResult.selectors.pagination = categoryResult.pagination;
    }
    if (categoryResult.detailUrl) {
      detailUrl = categoryResult.detailUrl;
    }
  }

  progressSteps.push('⑤ 并行分析...');
  checkTimeout();
  const { tasks } = buildParallelTasks(detailUrl, $home, homeHtml, analysisResult.cms_type, base, cfCookie);
  const parallelResults = await Promise.allSettled(tasks);
  mergeParallelResults(analysisResult, parallelResults);

  if (analysisResult.cms_type === 'unknown') {
    analysisResult.warnings.push('未识别CMS类型，将使用非标模板');
  }

  setCacheEntry(analysisCache, host, analysisResult);

  return { result: analysisResult, progress: progressSteps };
}

/**
 * 工具: analyze_website - 深度分析网站结构
 * @param {object} args - 输入参数
 * @param {string} args.url - 网站 URL
 * @param {string} [args.html] - 预获取的 HTML
 * @param {string} [args.cf_cookie] - Cloudflare Cookie
 * @param {object} cache - 缓存对象
 * @returns {object} MCP 响应格式
 */
export async function handleAnalyzeWebsite (args, cache) {
  const startTime = Date.now();

  const urlValidation = validateInput(inputSchemas.url, args.url);
  if (!urlValidation.success) {
    return createErrorResponse(urlValidation.error);
  }

  try {
    const analysisOptions = {};
    if (args.html) {
      analysisOptions.html = args.html;
    }
    if (args.cf_cookie) {
      analysisOptions.cf_cookie = args.cf_cookie;
    }

    logger.info('开始分析网站:', urlValidation.data);
    logger.info('分析进度:');

    const { result, progress } = await coreAnalyzeWebsite(urlValidation.data, cache, analysisOptions);

    progress.forEach((step, index) => {
      logger.info(`${index + 1}. ${step}`);
    });

    const report = formatAnalysisReport(urlValidation.data, result, progress);
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

    addHistory({
      type: 'analysis',
      url: urlValidation.data,
      host: result.host,
      cms: result.cms_type,
      status: 'success',
      elapsed: elapsedTime,
      timestamp: new Date().toISOString()
    });

    return {
      content: [ {
        type: 'text',
        text: report + `\n⏱️ 耗时: ${elapsedTime}秒`
      } ]
    };

  } catch (error) {
    addHistory({
      type: 'analysis',
      url: urlValidation.data,
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });

    return createErrorResponse(error);
  }
}

/**
 * 工具: batch_analyze - 批量并行分析多个网站
 * @param {object} args - 输入参数
 * @param {string} args.urls - URL 数组的 JSON 字符串
 * @param {number} [args.max_concurrent] - 最大并发数（默认 3）
 * @param {object} cache - 缓存对象
 * @returns {object} MCP 响应格式
 */
export async function handleBatchAnalyze (args, cache) {
  let urls;
  try {
    urls = JSON.parse(args.urls);
    if (!Array.isArray(urls) || !urls.length) {
      return createErrorResponse('urls 必须是非空 JSON 数组');
    }
  } catch (error) {
    return createErrorResponse('urls 格式错误: ' + error.message);
  }

  const maxConcurrentInput = args.max_concurrent || 3;
  const maxConcurrentValidation = validateInput(inputSchemas.maxConcurrent, maxConcurrentInput);
  if (!maxConcurrentValidation.success) {
    return createErrorResponse(maxConcurrentValidation.error);
  }
  const maxConcurrent = maxConcurrentValidation.data;

  const allResults = [];

  for (let i = 0; i < urls.length; i += maxConcurrent) {
    const batch = urls.slice(i, i + maxConcurrent);

    const batchResults = await Promise.all(batch.map(async (url) => {
      try {
        const { result } = await coreAnalyzeWebsite(url, cache);
        return {
          url,
          status: '✅',
          cms: result.cms_type,
          selector: result.selectors.video_list?.selector || '-',
          search: result.features.search_method || '-'
        };
      } catch (error) {
        return {
          url,
          status: '❌',
          cms: error.message
        };
      }
    }));

    allResults.push(...batchResults);
  }

  const successCount = allResults.filter(result => result.status === '✅').length;

  const formattedResults = allResults.map(result => {
    if (result.status === '✅') {
      return `${result.status} ${result.url.slice(0, 35)} | ${result.cms} | ${result.selector.slice(0, 20)} | ${result.search}`;
    }
    return `${result.status} ${result.url.slice(0, 35)} | ${result.cms}`;
  }).join('\n');

  return {
    content: [ {
      type: 'text',
      text: `📊 批量分析完成 | ${successCount}/${allResults.length} 成功\n${'─'.repeat(80)}\n${formattedResults}\n\n💡 如需查看单站详细分析，请使用 analyze_website 工具`
    } ]
  };
}
