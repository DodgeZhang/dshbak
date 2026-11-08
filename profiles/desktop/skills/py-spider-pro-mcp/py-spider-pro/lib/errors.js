/**
 * py-spider-pro 统一错误处理模块
 * 定义项目中所有错误类型，提供统一的错误响应格式
 */

import { logger } from './config.js';

/**
 * 基础错误类
 */
export class SpiderError extends Error {
  constructor (message, code = 'SPIDER_ERROR', details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toResponse () {
    return {
      content: [ {
        type: 'text',
        text: `❌ [${this.code}] ${this.message}`
      } ]
    };
  }
}

/**
 * 参数验证错误
 */
export class ValidationError extends SpiderError {
  constructor (message, field = null) {
    super(message, 'VALIDATION_ERROR', { field });
  }
}

/**
 * 网络请求错误
 */
export class NetworkError extends SpiderError {
  constructor (message, url = null) {
    super(message, 'NETWORK_ERROR', { url });
  }
}

/**
 * Cloudflare 挑战错误
 */
export class CloudflareError extends SpiderError {
  constructor (message, url = null) {
    super(message, 'CLOUDFLARE_ERROR', { url });
  }

  toResponse () {
    return {
      content: [ {
        type: 'text',
        text: `❌ [${this.code}] ${this.message}\n💡 提示: 使用 visit_web 工具访问目标网站后，传入 html 和 cf_cookie 参数`
      } ]
    };
  }
}

/**
 * 超时错误
 */
export class TimeoutError extends SpiderError {
  constructor (message, operation = null) {
    super(message, 'TIMEOUT_ERROR', { operation });
  }

  toResponse () {
    return {
      content: [ {
        type: 'text',
        text: `⏰ [${this.code}] ${this.message}\n💡 提示: 网络超时可能是由于目标网站响应慢，请稍后重试或提供预获取的 HTML`
      } ]
    };
  }
}

/**
 * 解析错误
 */
export class ParseError extends SpiderError {
  constructor (message, source = null) {
    super(message, 'PARSE_ERROR', { source });
  }
}

/**
 * 文件操作错误
 */
export class FileError extends SpiderError {
  constructor (message, filePath = null) {
    super(message, 'FILE_ERROR', { filePath });
  }
}

/**
 * 缓存错误
 */
export class CacheError extends SpiderError {
  constructor (message) {
    super(message, 'CACHE_ERROR');
  }
}

/**
 * 分析错误
 */
export class AnalysisError extends SpiderError {
  constructor (message, url = null, stage = null) {
    super(message, 'ANALYSIS_ERROR', { url, stage });
  }
}

/**
 * 代码生成错误
 */
export class GenerationError extends SpiderError {
  constructor (message, cmsType = null) {
    super(message, 'GENERATION_ERROR', { cmsType });
  }
}

/**
 * 验证码错误
 */
export class CaptchaError extends SpiderError {
  constructor (message) {
    super(message, 'CAPTCHA_ERROR');
  }

  toResponse () {
    return {
      content: [ {
        type: 'text',
        text: `❌ [${this.code}] ${this.message}\n\n💡 解决方案:\n  1. 手动访问目标网站完成验证\n  2. 等待一段时间后重试（IP可能被封禁）\n  3. 使用代理池更换IP地址\n  4. 降低请求频率，避免触发验证码\n  5. 如使用云服务商IP，考虑切换到住宅IP`
      } ]
    };
  }
}

/**
 * 限流错误
 */
export class RateLimitError extends SpiderError {
  constructor (message) {
    super(message, 'RATE_LIMIT_ERROR');
  }

  toResponse () {
    return {
      content: [ {
        type: 'text',
        text: `❌ [${this.code}] ${this.message}\n💡 提示: 请降低请求频率或使用代理`
      } ]
    };
  }
}

/**
 * 创建错误响应（兼容旧代码）
 * @param {string|Error} error - 错误信息或错误对象
 * @returns {object} MCP 响应格式
 */
export function createErrorResponse (error) {
  if (error instanceof SpiderError) {
    return error.toResponse();
  }

  if (error instanceof Error) {
    // 检测 Cloudflare 错误
    if (error.message.includes('Cloudflare') ||
        error.message.includes('cf_clearance') ||
        error.message.includes('503')) {
      return new CloudflareError(error.message).toResponse();
    }

    // 检测超时错误
    if (error.message.includes('timeout') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('ECONNRESET')) {
      return new TimeoutError(error.message).toResponse();
    }

    return {
      content: [ {
        type: 'text',
        text: `❌ 执行失败: ${error.message}`
      } ]
    };
  }

  return {
    content: [ {
      type: 'text',
      text: `❌ ${error}`
    } ]
  };
}

/**
 * 错误处理器装饰器
 * @param {Function} handler - 工具处理函数
 * @returns {Function} 包装后的处理函数
 */
export function withErrorHandling (handler) {
  return async function wrappedHandler (args, cache) {
    try {
      return await handler(args, cache);
    } catch (error) {
      logger.error(`[ERROR] ${handler.name || 'Unknown'}:`, error.message);
      return createErrorResponse(error);
    }
  };
}
