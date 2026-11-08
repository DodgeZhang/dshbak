/**
 * py-spider-pro 正则安全工具
 * 功能：防止 ReDoS (正则表达式拒绝服务攻击)
 */
import { REGEX_MAX_LENGTH, REGEX_EXEC_TIMEOUT } from './config.js';
import { isKnownSafePattern, getCompiledPattern } from './safe_patterns.js';

/**
 * 带超时保护的正则执行
 * @param {string} pattern - 正则表达式模式
 * @param {string} text - 要匹配的文本
 * @param {object} options - 选项
 * @param {number} options.timeout - 超时时间(ms)，默认使用配置值
 * @param {number} options.maxLength - 最大文本长度，默认使用配置值
 * @returns {{success: boolean, result: RegExpExecArray|null, error: string|null}} 执行结果
 */
export function safeRegexExec (pattern, text, options = {}) {
  const timeout = options.timeout || REGEX_EXEC_TIMEOUT;
  const maxLength = options.maxLength || REGEX_MAX_LENGTH;

  if (text.length > maxLength) {
    return {
      success: false,
      result: null,
      error: `文本长度(${text.length})超过最大限制(${maxLength})`
    };
  }

  // 已知安全模式：使用预编译正则，直接执行
  const precompiled = getCompiledPattern(pattern);
  if (precompiled) {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve({
          success: false,
          result: null,
          error: `正则执行超时(>${timeout}ms)`
        });
      }, timeout);

      try {
        const result = precompiled.exec(text);
        clearTimeout(timeoutId);
        resolve({
          success: true,
          result,
          error: null
        });
      } catch (e) {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          result: null,
          error: `正则解析错误: ${e.message}`
        });
      }
    });
  }

  // 未知模式：先验证安全性
  const dangerousPatterns = [
    /\([^)]*\){5,}/,
    /(\([^)]+\)){3,}/,
    /\([^)]*\+[^)]*\)\+/,
    /\([^)]*\|\|[^)]*\)\+/,
    /\.\*\?\{10,}/,
    /\.\{10,}/
  ];

  for (const dangerous of dangerousPatterns) {
    if (dangerous.test(pattern)) {
      return {
        success: false,
        result: null,
        error: `检测到潜在危险正则模式: ${pattern}`
      };
    }
  }

  // 使用 Promise.race 实现超时
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve({
        success: false,
        result: null,
        error: `正则执行超时(>${timeout}ms)`
      });
    }, timeout);

    try {
      const regex = new RegExp(pattern);
      const result = regex.exec(text);
      clearTimeout(timeoutId);
      resolve({
        success: true,
        result,
        error: null
      });
    } catch (e) {
      clearTimeout(timeoutId);
      resolve({
        success: false,
        result: null,
        error: `正则解析错误: ${e.message}`
      });
    }
  });
}

/**
 * 验证正则表达式安全性
 * @param {string} pattern - 正则表达式模式
 * @returns {{safe: boolean, reason: string}} 验证结果
 */
export function validateRegexSafety (pattern) {
  if (!pattern || typeof pattern !== 'string') {
    return { safe: false, reason: '正则表达式不能为空' };
  }

  // 快速检查：如果已知安全模式，直接通过
  if (isKnownSafePattern(pattern)) {
    return { safe: true, reason: '预定义安全模式' };
  }

  // 长度检查
  if (pattern.length > 1000) {
    return { safe: false, reason: '正则表达式过长' };
  }

  // 危险模式检测 - 使用更精确的模式避免误报
  const dangerousPatterns = [
    { pattern: /\([^)]*\){5,}/, reason: '嵌套括号过多' },
    { pattern: /\([^)]*\+[^)]*\)\+/, reason: '经典ReDoS模式' },
    { pattern: /\([^)]*\|\|[^)]*\)\+/, reason: '交替ReDoS模式' },
    { pattern: /\.\*\?\{10,}/, reason: '非贪婪过度重复' },
    { pattern: /\.\{10,}/, reason: '过度重复' },
    { pattern: /\([^)]+\)\+\{3,}/, reason: '分组重复加贪婪匹配' }
  ];

  for (const { pattern: dangerous, reason } of dangerousPatterns) {
    if (dangerous.test(pattern)) {
      return { safe: false, reason };
    }
  }

  // 尝试解析验证
  try {
    new RegExp(pattern);
  } catch (e) {
    return { safe: false, reason: `无效正则表达式: ${e.message}` };
  }

  return { safe: true, reason: '安全' };
}
