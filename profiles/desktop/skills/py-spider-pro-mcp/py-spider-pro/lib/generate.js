/**
 * py-spider-pro 爬虫生成模块
 * 功能：一键生成爬虫源码、代码验证
 */
import fs from 'node:fs';
import path from 'node:path';

import { escPy } from './utils.js';
import { inputSchemas, validateInput, createErrorResponse } from './validation.js';
import { getHost } from './url_utils.js';
import { getCacheEntry } from './cache.js';
import { ROOT, logger } from './config.js';
import { writeFile } from './file_utils.js';
import { getTemplateGenerator, playerOverrides, detailOverrides } from './templates/index.js';
import { coreAnalyzeWebsite } from './analyze.js';
import { addHistory } from './history_manager.js';
import { GenerationError } from './errors.js';
import { parsePythonStructure } from './python_parser.js';

/**
 * 替换 Python 代码中的方法
 * @param {string} code - 原始代码
 * @param {string} methodName - 要替换的方法名
 * @param {string} newMethod - 新方法内容
 * @returns {string} 修改后的代码
 */
function replaceMethod (code, methodName, newMethod) {
  const lines = code.split('\n');
  const result = [];
  let insideMethod = false;
  let methodIndent = 0;
  let replaced = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmedLine = lines[i].trim();

    if (!replaced && new RegExp(`^(async\\s+)?def\\s+${methodName}\\s*\\(`).test(trimmedLine)) {
      methodIndent = lines[i].match(/^(\s*)/)[1].length;
      insideMethod = true;
      result.push(newMethod);
      continue;
    }

    if (insideMethod) {
      const currentIndent = lines[i].match(/^(\s*)/)[1].length;
      if (trimmedLine && currentIndent <= methodIndent) {
        insideMethod = false;
        replaced = true;
        result.push(lines[i]);
      }
    } else {
      result.push(lines[i]);
    }
  }

  return result.join('\n');
}

/**
 * 生成爬虫代码（从分析结果生成 Python 源码）
 * @param {object} analysis - 网站分析结果
 * @param {string} contentType - 内容类型
 * @param {string} host - 网站主机名
 * @returns {string} 生成的爬虫代码
 */
function generateSpiderCode (analysis, contentType, host) {
  const cmsType = analysis.cms_type || 'unknown';
  const templateGenerator = getTemplateGenerator(cmsType);

  if (!templateGenerator) {
    throw new GenerationError(`未找到 ${cmsType} 对应的模板`, cmsType);
  }

  // 提取选择器信息
  const videoSelector = analysis.selectors?.video_list?.selector || '';
  const categories = analysis.sample_data?.categories || [];
  const classList = categories
    .filter(category => category.tid)
    .map(category => `{ "type_name": "${escPy(category.name)}", "type_id": "${escPy(category.tid)}" }`);
  const picAttribute = analysis.selectors?.pic_attr || 'src';

  // 生成基础代码
  let code = templateGenerator({
    safeHost: escPy(host),
    safeHostPrefix: escPy(host.split('.')[0]),
    classList,
    videoSel: videoSelector,
    picAttr: picAttribute,
    hasEncryption: analysis.features?.encryption || false,
    encryptionType: analysis.features?.encryption_type || '',
    playerJs: analysis.features?.player_js || '',
    searchMethod: analysis.features?.search_method || '',
    playSourceSel: analysis.selectors?.play_source?.selector || '',
    episodeSel: analysis.selectors?.episode_list?.selector || '',
    analysis,
    p: analysis
  });

  // 应用内容类型覆盖
  if (contentType !== 'video' && playerOverrides[contentType]) {
    logger.info(`  应用 ${contentType} 内容类型覆盖`);
    code = replaceMethod(code, 'playerContent', playerOverrides[contentType]);
  }

  // 应用细分内容类型覆盖
  if (contentType === 'novel' && detailOverrides.novel_chapter) {
    logger.info('  应用小说章节覆盖');
    code = replaceMethod(code, 'detailContent', detailOverrides.novel_chapter);
  }
  if (contentType === 'manga' && detailOverrides.manga_chapter) {
    logger.info('  应用漫画章节覆盖');
    code = replaceMethod(code, 'detailContent', detailOverrides.manga_chapter);
  }
  if (contentType === 'music' && detailOverrides.music_album) {
    logger.info('  应用音乐专辑覆盖');
    code = replaceMethod(code, 'detailContent', detailOverrides.music_album);
  }

  // 应用 pp 变量安全注入覆盖
  const detailFormat = analysis.features?.detail_format || '';
  if ((detailFormat === 'pp_variable' || detailFormat === 'la_array') && detailOverrides.pp_variable) {
    logger.info('  应用 pp 变量安全注入');
    code = replaceMethod(code, 'detailContent', detailOverrides.pp_variable);
  }

  return code;
}

/**
 * 验证爬虫代码结构
 * @param {string} code - 爬虫源代码
 * @returns {{methods: string[], missing: string[], spiderClass: object}} 验证结果
 */
function validateSpiderCode (code) {
  const structure = parsePythonStructure(code);

  // 查找 Spider 类（包含必要方法的类）
  const spiderClass = structure.classes.find(cls =>
    cls.methods.some(method =>
      [ 'homeContent', 'categoryContent', 'detailContent', 'searchContent', 'playerContent' ].includes(method.name)
    )
  );

  const definedMethods = spiderClass ? spiderClass.methods.map(method => method.name) : [];
  const requiredMethods = [ 'homeContent', 'categoryContent', 'detailContent', 'searchContent', 'playerContent' ];
  const missingMethods = requiredMethods.filter(method => !definedMethods.includes(method));

  return {
    methods: definedMethods,
    missing: missingMethods,
    spiderClass
  };
}

/**
 * 写入爬虫文件
 * @param {string} code - 爬虫代码
 * @param {string} host - 主机名
 * @param {string} [fileName] - 自定义文件名
 * @returns {{success: boolean, message: string, filePath: string}} 写入结果
 */
function writeSpiderFile (code, host, fileName) {
  const baseFileName = fileName || `${host.split('.')[0]}_spider.py`;
  let filePath = path.join(ROOT, baseFileName);

  // 如果文件已存在，添加数字后缀
  if (fs.existsSync(filePath)) {
    for (let i = 1; i <= 100; i++) {
      const newFileName = `${i}_${baseFileName}`;
      const newFilePath = path.join(ROOT, newFileName);
      if (!fs.existsSync(newFilePath)) {
        filePath = newFilePath;
        break;
      }
    }
  }

  const result = writeFile(filePath, code);
  return {
    ...result,
    filePath
  };
}

/**
 * 工具: one_click_spider - 一键分析+生成爬虫源码（核心创新）
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
  const contentTypeValidation = validateInput(inputSchemas.contentType, contentTypeInput);
  if (!contentTypeValidation.success) {
    return createErrorResponse(contentTypeValidation.error);
  }
  const contentType = contentTypeValidation.data;

  logger.info('开始一键爬虫生成:', url);
  logger.info('内容类型:', contentType);

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
      contentType,
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
    code = generateSpiderCode(analysis, contentType, host);
  } catch (error) {
    addHistory({
      type: 'spider_generation',
      url,
      contentType,
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
    contentType,
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
CMS: ${analysis.cms_type} | 模板: ${analysis.features?.template || '通用'} | 类型: ${contentType}
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

export { generateSpiderCode, validateSpiderCode, writeSpiderFile };
