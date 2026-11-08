/**
 * py-spider-pro 分析编排模块
 * 功能：网站分析核心逻辑、选择器检测、CMS识别
 */
import { load } from 'cheerio';

import { fetchPage } from './http_client.js';
import { fixUrl } from './url_utils.js';
import { logger } from './config.js';

/**
 * 检测CMS类型（通过路径特征）
 * @param {string} html - HTML内容
 * @returns {string|null} CMS类型
 */
export async function detectCmsByPath (html) {
  const patterns = {
    maccms: /(mac_cms|maccms|mac\/admin)/i,
    wordpress: /wp-content|wp-includes|wordpress/i,
    drupal: /sites\/all\/themes|drupal/i,
    joomla: /\/joomla|\/templates\/joomla/i,
    typecho: /typecho/i,
    emlog: /emlog/i
  };

  for (const [ cms, pattern ] of Object.entries(patterns)) {
    if (pattern.test(html)) {
      logger.info(`检测到CMS类型: ${cms}`);
      return cms;
    }
  }
  return null;
}

/**
 * 检测模板特征
 * @param {object} $ - cheerio对象
 * @param {string} html - HTML内容
 * @returns {object} 特征对象
 */
export async function detectTemplateFeatures ($, html) {
  const features = {
    template: null,
    tech_stack: { frontend: [], backend: [], cms: [] },
    signature_type: null,
    encryption: false,
    encryption_type: null,
    player_type: null,
    detail_format: null,
    dynamic_content: false,
    dynamic_types: [],
    has_iframe: false,
    api_discovery: []
  };

  // 检测iframe
  if ($('iframe').length > 0) {
    features.has_iframe = true;
  }

  // 检测技术栈
  if (html.includes('jQuery')) features.tech_stack.frontend.push('jQuery');
  if (html.includes('Vue') || html.includes('vue')) features.tech_stack.frontend.push('Vue');
  if (html.includes('React') || html.includes('react')) features.tech_stack.frontend.push('React');
  if (html.includes('Webpack')) features.tech_stack.frontend.push('Webpack');
  if (html.includes('axios')) features.tech_stack.frontend.push('axios');
  if (html.includes('fetch')) features.tech_stack.frontend.push('fetch');

  // 检测播放器类型
  const playerPatterns = {
    ckplayer: /ckplayer/i,
    tencent: /txplayer|qqplayer/i,
    baidu: /baiduplayer/i,
    m3u8: /\.m3u8/i,
    mp4: /\.mp4/i
  };

  for (const [ player, pattern ] of Object.entries(playerPatterns)) {
    if (pattern.test(html)) {
      features.player_type = player;
      break;
    }
  }

  // 检测加密特征
  if (html.includes('encrypt') || html.includes('Encrypt')) {
    features.encryption = true;
    features.encryption_type = '通用加密';
  }
  if (html.includes('sign=')) {
    features.signature_type = 'URL签名';
  }

  // 检测动态内容
  if (html.includes('window.__NUXT__') || html.includes('__nuxt')) {
    features.dynamic_content = true;
    features.dynamic_types.push('Nuxt');
  }
  if (html.includes('window.__INITIAL_STATE__') || html.includes('__NEXT_DATA__')) {
    features.dynamic_content = true;
    features.dynamic_types.push('Next.js');
  }
  if (html.includes('hydration')) {
    features.dynamic_content = true;
    features.dynamic_types.push('SSR');
  }

  return { features, cms_type: null };
}

/**
 * 提取分类导航链接
 * @param {object} $ - cheerio对象
 * @param {string} host - 主机名
 * @returns {array} 分类链接数组
 */
export async function extractCategoryNav ($, host) {
  const categories = [];
  const navSelectors = [
    'nav a',
    '.nav a',
    '.category a',
    '.menu a',
    '.nav-menu a',
    '.header-nav a',
    '.main-nav a',
    '.top-nav a',
    'ul.nav li a',
    'ul.menu li a',
    '.nav-list li a',
    '.category-list li a'
  ];

  for (const selector of navSelectors) {
    $(selector).each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href && text && text.length > 0 && text.length < 50) {
        const normalizedHref = fixUrl(href, host);
        if (normalizedHref && !categories.some(c => c.url === normalizedHref)) {
          categories.push({
            name: text,
            url: normalizedHref,
            tid: categories.length + 1
          });
        }
      }
    });
  }

  return categories.slice(0, 10);
}

/**
 * 检测视频列表选择器
 * @param {object} $ - cheerio对象
 * @param {string} host - 主机名
 * @returns {object|null} 选择器结果
 */
export function detectVideoListSelector ($, _host) {
  const videoPatterns = [
    { selector: '.video-list li', name: 'video-list' },
    { selector: '.list li', name: 'list' },
    { selector: '.film-list li', name: 'film-list' },
    { selector: '.movie-list li', name: 'movie-list' },
    { selector: '.content li', name: 'content' },
    { selector: 'ul.video-list li', name: 'ul-video-list' },
    { selector: '.grid li', name: 'grid' },
    { selector: '.box li', name: 'box' }
  ];

  for (const { selector } of videoPatterns) {
    const elements = $(selector);
    if (elements.length >= 3 && elements.length <= 100) {
      logger.info(`检测到视频列表选择器: ${selector} (${elements.length}个元素)`);
      return {
        video_list: {
          selector,
          count: elements.length,
          stability: 'high'
        },
        detail_url_pattern: null,
        pic_attr: 'src'
      };
    }
  }

  return null;
}

/**
 * 构建分类页面URL
 * @param {string} cmsType - CMS类型
 * @param {array} categoryLinks - 分类链接数组
 * @param {string} base - 基础URL
 * @param {string} html - HTML内容
 * @returns {string|null} 分类页面URL
 */
export function buildCategoryUrl (cmsType, categoryLinks, base, _html) {
  // 如果有分类链接，优先使用第一个
  if (categoryLinks.length > 0) {
    return categoryLinks[0].url;
  }

  // 根据CMS类型生成默认分类URL
  const defaultUrls = {
    maccms: `${base}/vodshow/1--------.html`,
    wordpress: `${base}/category/video/`,
    drupal: `${base}/videos`,
    joomla: `${base}/videos`
  };

  return defaultUrls[cmsType] || null;
}

/**
 * 分析分类页面
 * @param {string} url - 分类页面URL
 * @param {string} host - 主机名
 * @param {boolean} hasVideoSelector - 是否已有视频选择器
 * @param {string} cfCookie - Cloudflare Cookie
 * @returns {object} 分析结果
 */
export async function analyzeCategoryPage (url, host, hasVideoSelector, cfCookie) {
  const result = {
    warning: null,
    videoResult: null,
    pagination: [],
    detailUrl: null
  };

  try {
    const response = await fetchPage(url, { cf_cookie: cfCookie });
    const $ = load(response);

    // 如果还没有视频选择器，尝试在分类页检测
    if (!hasVideoSelector) {
      const videoResult = detectVideoListSelector($, host);
      if (videoResult) {
        result.videoResult = videoResult;
      }
    }

    // 提取分页信息
    const paginationSelectors = [
      '.pagination a',
      '.page a',
      '.paging a',
      '.pages a',
      '.page-nav a'
    ];

    for (const selector of paginationSelectors) {
      const links = $(selector);
      if (links.length > 1) {
        result.pagination.push({ selector, count: links.length });
        break;
      }
    }

    // 尝试提取一个详情页URL
    const detailLink = $("a[href*='vodplay'], a[href*='detail'], a[href*='play']").first();
    if (detailLink.length > 0) {
      result.detailUrl = fixUrl(detailLink.attr('href'), host);
    }

  } catch (error) {
    result.warning = `分类页访问失败: ${error.message}`;
    logger.warn(result.warning);
  }

  return result;
}

/**
 * 构建并行分析任务
 * @param {string} detailUrl - 详情页URL
 * @param {object} $home - 首页cheerio对象
 * @param {string} homeHtml - 首页HTML
 * @param {string} cmsType - CMS类型
 * @param {string} base - 基础URL
 * @param {string} cfCookie - Cloudflare Cookie
 * @returns {object} 任务对象
 */
export function buildParallelTasks (detailUrl, $home, homeHtml, cmsType, base, cfCookie) {
  const tasks = [];

  // 如果有详情页URL，添加详情页分析任务
  if (detailUrl) {
    tasks.push(
      fetchPage(detailUrl, { cf_cookie: cfCookie })
        .then(html => ({ type: 'detail', data: html }))
        .catch(() => ({ type: 'detail', error: '详情页获取失败' }))
    );
  }

  // API发现任务
  tasks.push(
    Promise.resolve().then(() => {
      const apis = [];
      // 从HTML中提取API端点
      const apiPatterns = [
        /https?:\/\/[^\s"'<>]+\/api\/[^\s"'<>]*/gi,
        /https?:\/\/[^\s"'<>]+\/json\/[^\s"'<>]*/gi
      ];

      for (const pattern of apiPatterns) {
        const matches = homeHtml.match(pattern);
        if (matches) {
          matches.forEach(url => {
            if (!apis.some(a => a.url === url)) {
              apis.push({ url, type: 'api', confidence: 0.8 });
            }
          });
        }
      }
      return { type: 'api_discovery', data: apis.slice(0, 5) };
    })
  );

  return { tasks };
}

/**
 * 合并并行分析结果
 * @param {object} analysisResult - 分析结果对象
 * @param {array} parallelResults - 并行任务结果数组
 */
export function mergeParallelResults (analysisResult, parallelResults) {
  parallelResults.forEach(result => {
    if (result.status === 'fulfilled') {
      const { type, data } = result.value;

      if (type === 'detail') {
        // 分析详情页内容
        const $ = load(data);
        // 检测播放源选择器
        const playSourceSelectors = [
          '.play-list',
          '.source-list',
          '.player-source',
          '.video-source',
          '.play-source'
        ];

        for (const selector of playSourceSelectors) {
          const elements = $(selector);
          if (elements.length > 0) {
            analysisResult.selectors.play_source = {
              selector,
              count: elements.length
            };
            break;
          }
        }

        // 检测剧集列表
        const episodeSelectors = [
          '.episode-list',
          '.play-list li',
          '.ep-list',
          '.vod-list'
        ];

        for (const selector of episodeSelectors) {
          const elements = $(selector);
          if (elements.length > 0) {
            analysisResult.selectors.episode_list = {
              selector,
              count: elements.length
            };
            break;
          }
        }
      }

      if (type === 'api_discovery') {
        analysisResult.features.api_discovery = data;
      }
    }
  });
}

/**
 * 格式化分析报告
 * @param {string} url - 分析的URL
 * @param {object} result - 分析结果对象
 * @param {string[]} progress - 分析进度信息（可选）
 * @param {boolean} detailed - 是否输出详细报告（默认 false）
 * @returns {string} 格式化的分析报告
 */
export function formatAnalysisReport (url, result, progress, detailed = false) {
  // 格式化视频选择器信息
  const videoSelectorInfo = result.selectors.video_list
    ? `✅ ${result.selectors.video_list.selector} (${result.selectors.video_list.count}个)`
    : '❌';

  // 格式化播放源信息
  const playSourceInfo = result.selectors.play_source
    ? `✅ (${result.selectors.play_source.count}个)`
    : '❌';

  // 格式化剧集信息
  const episodeInfo = result.selectors.episode_list
    ? `✅ (${result.selectors.episode_list.count}集)`
    : '❌';

  // 构建特征标签（紧凑横向显示）
  let featureTags = [];
  if (result.features.signature_type) {
    featureTags.push(`🔑${result.features.signature_type}`);
  }
  if (result.features.encryption) {
    featureTags.push('🔒加密');
  }
  if (result.features.player_type) {
    featureTags.push(`📺${result.features.player_type}`);
  }
  if (result.features.dynamic_content) {
    featureTags.push('⚡动态');
  }
  if (result.features.has_iframe) {
    featureTags.push('🖼️iframe');
  }

  // 构建基本报告
  let report = `📊 网站分析报告
URL: ${url}
Host: ${result.host}
CMS: ${result.cms_type} | 模板: ${result.features.template || '未识别'}

📋 选择器状态:
  - 视频列表: ${videoSelectorInfo}
  - 播放源: ${playSourceInfo}
  - 剧集列表: ${episodeInfo}
  - 详情URL: ${result.selectors.detail_url_pattern ? '✅' : '❌'}

🏷️ 特征标签: ${featureTags.join(' ') || '无'}

⚠️ 警告: ${result.warnings.length > 0 ? result.warnings.join('; ') : '无'}

📈 分析完成`;

  // 如果需要详细报告，添加完整 JSON
  if (detailed) {
    report += `\n\n📄 详细JSON:\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
  }

  return report;
}
