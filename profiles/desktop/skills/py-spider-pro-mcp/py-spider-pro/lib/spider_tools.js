/**
 * py-spider-pro 爬虫核心工具 v3.0
 * 功能：网站分析、历史记录管理
 * 设计原则：
 * - 变量命名清晰有意义
 * - 函数职责单一
 * - 添加完整注释
 * - 错误处理统一
 */
import { load } from 'cheerio';

// 导入外部依赖
import { inputSchemas, validateInput, createErrorResponse } from './validation.js';
import { getHost } from './url_utils.js';
import { getCacheEntry } from './cache.js';
import { DEBUG_DISPLAY_COUNT, DEBUG_RESULT_SLICE, logger } from './config.js';
import { formatAnalysisReport } from './analyze_orchestrator.js';
import { addHistory, getHistory, clearHistory } from './history_manager.js';
import { parsePythonStructure } from './python_parser.js';
import { generateSpiderCode, validateSpiderCode, writeSpiderFile } from './generate.js';
import { coreAnalyzeWebsite } from './analyze.js';

/**
 * 工具函数集 - 网站分析、爬虫生成、调试工具
 * 本模块作为工具聚合器，统一导出所有核心功能
 */

/**
 * 工具1: analyze_website - 网站分析（入口）
 * @param {object} args - 输入参数
 * @param {string} args.url - 目标网站 URL
 * @param {string} [args.html] - 预获取的 HTML 内容
 * @param {string} [args.cf_cookie] - Cloudflare Cookie
 * @param {object} cache - 缓存对象
 * @returns {object} MCP 响应格式
 */
export async function handleAnalyzeWebsite (args, cache) {

  // 验证 URL 参数
  const urlValidation = validateInput(inputSchemas.url, args.url);
  if (!urlValidation.success) {
    return createErrorResponse(urlValidation.error);
  }

  const url = urlValidation.data;
  const host = getHost(url);

  logger.info('开始网站分析:', url);

  try {
    const { result, progress } = await coreAnalyzeWebsite(url, cache, {
      html: args.html,
      cf_cookie: args.cf_cookie
    });

    // 生成分析报告
    const report = formatAnalysisReport(url, result, progress);

    return {
      content: [ {
        type: 'text',
        text: report
      } ]
    };

  } catch (error) {
    addHistory({
      type: 'analysis',
      url,
      host,
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });

    return createErrorResponse(error.message);
  }
}

/**
 * 工具2: batch_analyze - 批量分析多个网站
 * @param {object} args - 输入参数
 * @param {string[]} args.urls - 目标网站 URL 列表
 * @param {object} cache - 缓存对象
 * @returns {object} MCP 响应格式
 */
export async function handleBatchAnalyze (args, cache) {
  const { urls } = args;

  if (!Array.isArray(urls) || urls.length === 0) {
    return createErrorResponse('URL列表不能为空');
  }

  const results = [];
  const startTime = Date.now();

  logger.info(`开始批量分析 ${urls.length} 个网站...`);

  for (const url of urls) {
    try {
      const urlValidation = validateInput(inputSchemas.url, url);
      if (!urlValidation.success) {
        results.push({ url, status: 'error', message: urlValidation.error });
        continue;
      }

      const { result } = await coreAnalyzeWebsite(url, cache, {});
      results.push({
        url,
        status: 'success',
        cms: result.cms_type,
        selectors: result.selectors.video_list ? '✅' : '❌',
        features: Object.keys(result.features).length,
        warnings: result.warnings.length
      });

      logger.info(`  ✅ ${url} -> ${result.cms_type}`);
    } catch (error) {
      results.push({ url, status: 'error', message: error.message });
      logger.warn(`  ❌ ${url} -> ${error.message}`);
    }
  }

  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

  // 生成批量报告
  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  const reportLines = [
    `📊 批量分析完成 | ${elapsedTime}秒`,
    `成功: ${successCount} | 失败: ${errorCount}`,
    '─'.repeat(80)
  ];

  for (const result of results) {
    if (result.status === 'success') {
      reportLines.push(`✅ ${result.url.slice(0, 50)}${result.url.length > 50 ? '...' : ''}`);
      reportLines.push(`   CMS: ${result.cms} | 选择器: ${result.selectors} | 特征: ${result.features} | 警告: ${result.warnings}`);
    } else {
      reportLines.push(`❌ ${result.url.slice(0, 50)}${result.url.length > 50 ? '...' : ''}`);
      reportLines.push(`   错误: ${result.message}`);
    }
  }

  return {
    content: [ {
      type: 'text',
      text: reportLines.join('\n')
    } ]
  };
}

/**
 * 工具3: one_click_spider - 一键分析+生成爬虫源码
 * @param {object} args - 输入参数
 * @param {string} args.url - 网站 URL
 * @param {string} [args.content_type] - 内容类型（默认 video）
 * @param {string} [args.html] - 预获取的 HTML
 * @param {string} [args.cf_cookie] - Cloudflare Cookie
 * @param {boolean} [args.write_file] - 是否写入文件
 * @param {string} [args.file_name] - 自定义文件名
 * @param {object} cache - 缓存对象
 * @returns {object} MCP 响应格式
 */
export async function handleOneClickSpider (args, cache) {
  const startTime = Date.now();

  // 验证 URL 参数
  const urlValidation = validateInput(inputSchemas.url, args.url);
  if (!urlValidation.success) {
    return createErrorResponse(urlValidation.error);
  }

  const url = urlValidation.data;
  const host = getHost(url);

  // 验证内容类型
  const contentTypeInput = args.content_type || 'video';

  logger.info('开始一键爬虫生成:', url);
  logger.info('内容类型:', contentTypeInput);

  let analysis;

  // Step 1: 分析网站（优先使用缓存）
  try {
    analysis = getCacheEntry(cache, host);

    if (!analysis) {
      logger.info('Step 1: 网站分析中...');

      const analysisOptions = {};
      if (args.html) {
        analysisOptions.html = args.html;
      }
      if (args.cf_cookie) {
        analysisOptions.cf_cookie = args.cf_cookie;
      }

      const { result, progress } = await coreAnalyzeWebsite(url, cache, analysisOptions);

      progress.forEach((step, index) => {
        logger.info(`  ${index + 1}. ${step}`);
      });

      analysis = result;
      logger.info('✅ 分析完成');
    } else {
      logger.info('Step 1: 使用缓存分析结果');
    }
  } catch (error) {
    addHistory({
      type: 'spider_generation',
      url,
      contentType: contentTypeInput,
      status: 'error',
      error: '分析失败: ' + error.message,
      timestamp: new Date().toISOString()
    });
    return createErrorResponse('分析失败: ' + error.message);
  }

  // Step 2: 生成爬虫源码
  logger.info('Step 2: 生成爬虫源码...');
  let code;
  try {
    code = generateSpiderCode(analysis, contentTypeInput, host);
  } catch (error) {
    addHistory({
      type: 'spider_generation',
      url,
      contentType: contentTypeInput,
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
    return createErrorResponse(error.message);
  }

  // Step 3: 验证代码结构
  logger.info('Step 3: 验证爬虫代码结构...');
  const validation = validateSpiderCode(code);
  const { methods, missing } = validation;

  logger.info(`  方法检查: ${methods.length}/${5} 个方法`);
  if (missing.length > 0) {
    logger.warn(`  缺失方法: ${missing.join(', ')}`);
  }

  // Step 4: 写入文件（可选）
  let writeResult = '';
  if (args.write_file) {
    logger.info('Step 4: 写入文件...');
    const fileResult = writeSpiderFile(code, host, args.file_name);
    writeResult = `\n${fileResult.success ? '✅' : '❌'} ${fileResult.message}`;
    logger.info(`  ${fileResult.success ? '✅' : '❌'} ${fileResult.message}`);
  }

  // 计算耗时
  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
  logger.info(`✅ 一键爬虫生成完成 | ${elapsedTime}秒`);

  // 添加成功历史记录
  addHistory({
    type: 'spider_generation',
    url,
    host,
    contentType: contentTypeInput,
    cms: analysis.cms_type,
    status: 'success',
    methods: methods.length,
    missing: missing.length,
    elapsed: elapsedTime,
    timestamp: new Date().toISOString()
  });

  // 构建响应
  const videoSelector = analysis.selectors?.video_list?.selector || '';
  const detailFormat = analysis.features?.detail_format || '';

  return {
    content: [ {
      type: 'text',
      text: `✅ 一键源码生成完成 | ${elapsedTime}秒
CMS: ${analysis.cms_type} | 模板: ${analysis.features?.template || '通用'} | 类型: ${contentTypeInput}
选择器: 视频=${videoSelector ? '✅' : '⚠️需要手动配置'} 播放源=${analysis.selectors?.play_source ? '✅' : '⚠️'} 搜索=${analysis.features?.search_method || '⚠️'}
${analysis.features?.encryption ? `🔒 加密类型: ${analysis.features.encryption_type}\n` : ''}
${detailFormat ? `📋 详情格式: ${detailFormat}(已注入安全解析)\n` : ''}
方法状态: ${methods.join(', ')} | 缺失: ${missing.length ? missing.join(', ') : '无'}
${writeResult}

\`\`\`python
${code}
\`\`\``
    } ]
  };
}

/**
 * 工具4: spider_test - 爬虫代码测试
 * @param {object} args - 输入参数
 * @param {string} args.source_code - Python 爬虫源代码
 * @returns {object} MCP 响应格式
 */
export function handleSpiderTest (args) {
  const { source_code: sourceCode } = args;

  if (!sourceCode) {
    return createErrorResponse('请提供要测试的爬虫源代码');
  }

  try {
    const structure = parsePythonStructure(sourceCode);

    // 查找 Spider 类
    const spiderClass = structure.classes.find(cls =>
      cls.methods.some(method =>
        [ 'homeContent', 'categoryContent', 'detailContent', 'searchContent', 'playerContent' ].includes(method.name)
      )
    );

    if (!spiderClass) {
      return {
        content: [ {
          type: 'text',
          text: '❌ 未找到 Spider 类（包含必要方法的类）'
        } ]
      };
    }

    // 检查方法完整性
    const definedMethods = spiderClass.methods.map(m => m.name);
    const requiredMethods = [ 'homeContent', 'categoryContent', 'detailContent', 'searchContent', 'playerContent' ];
    const missingMethods = requiredMethods.filter(m => !definedMethods.includes(m));

    // 分析方法特征
    const methodAnalysis = spiderClass.methods.map(method => ({
      name: method.name,
      hasReturn: method.hasReturn,
      hasExcept: method.hasExcept,
      lineCount: method.lineCount
    }));

    // 生成报告
    const reportLines = [
      '📊 爬虫代码分析结果',
      `类名: ${spiderClass.name}${spiderClass.parent ? ` (继承: ${spiderClass.parent})` : ''}`,
      `定义方法: ${definedMethods.length}/${requiredMethods.length}`,
      `缺失方法: ${missingMethods.length ? missingMethods.join(', ') : '无'}`,
      '─'.repeat(60),
      '方法详情:'
    ];

    for (const method of methodAnalysis) {
      reportLines.push(`  • ${method.name} (${method.lineCount}行)`);
      reportLines.push(`    ├─ 返回值: ${method.hasReturn ? '✅' : '❌'}`);
      reportLines.push(`    └─ 异常处理: ${method.hasExcept ? '✅' : '❌'}`);
    }

    // 添加建议
    if (missingMethods.length > 0) {
      reportLines.push('─'.repeat(60));
      reportLines.push('💡 建议: 需要实现以下方法:');
      reportLines.push(...missingMethods.map(m => `  • ${m}`));
    }

    // 检查全局函数
    if (structure.globalMethods.length > 0) {
      reportLines.push('─'.repeat(60));
      reportLines.push('全局函数:');
      reportLines.push(...structure.globalMethods.map(m => `  • ${m.name}`));
    }

    return {
      content: [ {
        type: 'text',
        text: reportLines.join('\n')
      } ]
    };

  } catch (error) {
    return createErrorResponse('代码分析失败: ' + error.message);
  }
}

/**
 * 工具5: extract_links - 从HTML提取链接
 * @param {object} args - 输入参数
 * @param {string} args.html - HTML内容
 * @param {string} [args.base_url] - 基础URL（用于解析相对路径）
 * @returns {object} MCP 响应格式
 */
export function handleExtractLinks (args) {
  const { html } = args;

  if (!html) {
    return createErrorResponse('请提供HTML内容');
  }

  try {
    const $ = load(html);
    const links = [];

    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      const text = $(element).text().trim();

      if (href && href.startsWith('http')) {
        links.push({ href, text: text.slice(0, DEBUG_RESULT_SLICE) });
      }
    });

    const displayLinks = links.slice(0, DEBUG_DISPLAY_COUNT);

    return {
      content: [ {
        type: 'text',
        text: `🔗 提取到 ${links.length} 个链接（显示前${displayLinks.length}个）\n${'─'.repeat(80)}\n${displayLinks.map((link, index) => `[${index + 1}] ${link.text || '(无文本)'}: ${link.href}`).join('\n')}`
      } ]
    };

  } catch (error) {
    return createErrorResponse('链接提取失败: ' + error.message);
  }
}

/**
 * 工具6: show_history - 显示分析和生成的历史记录
 * @param {object} args - 输入参数
 * @param {number} [args.limit] - 显示数量（默认 20）
 * @returns {object} MCP 响应格式
 */
export function handleShowHistory (args) {
  const limit = args.limit || 20;
  const history = getHistory(limit);

  if (history.length === 0) {
    return { content: [ { type: 'text', text: '📋 历史记录为空' } ] };
  }

  const formattedHistory = history.map((item, index) => {
    const time = new Date(item.timestamp).toLocaleString();

    if (item.type === 'analysis') {
      return `${index + 1}. 📊 分析 | ${time} | ${item.status === 'success' ? '✅' : '❌'} | ${item.url.slice(0, 40)} | ${item.cms || '未知'} | ${item.elapsed ? item.elapsed + '秒' : '-'}`;
    } else if (item.type === 'spider_generation') {
      return `${index + 1}. 🕷️ 生成 | ${time} | ${item.status === 'success' ? '✅' : '❌'} | ${item.url.slice(0, 40)} | ${item.contentType} | ${item.cms || '未知'} | ${item.methods || 0} 方法 | ${item.elapsed ? item.elapsed + '秒' : '-'}`;
    }

    return `${index + 1}. ${item.type} | ${time} | ${item.status}`;
  }).join('\n');

  return {
    content: [ {
      type: 'text',
      text: `📋 历史记录 (最近 ${history.length} 条)\n${'─'.repeat(120)}\n${formattedHistory}\n\n💡 清除历史记录: 使用 clear_history 工具`
    } ]
  };
}

/**
 * 工具7: clear_history - 清除所有历史记录
 * @returns {object} MCP 响应格式
 */
export function handleClearHistory () {
  clearHistory();
  return { content: [ { type: 'text', text: '✅ 历史记录已清除' } ] };
}
