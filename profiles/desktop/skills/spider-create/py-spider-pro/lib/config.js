/**
 * py-spider-pro 集中配置管理 v3.0.1
 * 支持环境变量覆盖配置
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 尝试加载 .env 文件
function loadEnv () {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const [ key, value ] = line.split('=');
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    });
  }
}

loadEnv();

export const VERSION = '3.0.1';
export const ROOT = process.env.SPIDER_ROOT || process.cwd();

const SELECTORS = JSON.parse(fs.readFileSync(path.join(__dirname, 'selectors.json'), 'utf-8'));

export { SELECTORS };
export const FETCH_VIDEO_LIST_SELECTORS = SELECTORS.fetchVideoList;
export const FETCH_PLAY_AREA_SELECTORS = SELECTORS.fetchPlayArea;

// 支持环境变量覆盖的配置项
export const HTTP_TIMEOUT = parseInt(process.env.HTTP_TIMEOUT) || 15000;
export const HTTP_TIMEOUT_SHORT = parseInt(process.env.HTTP_TIMEOUT_SHORT) || 5000;
export const REQUEST_DELAY = parseInt(process.env.REQUEST_DELAY) || 500;
export const MAX_RETRIES = parseInt(process.env.MAX_RETRIES) || 3;
export const RETRY_BASE_DELAY = parseInt(process.env.RETRY_BASE_DELAY) || 500;
export const MAX_REDIRECTS = parseInt(process.env.MAX_REDIRECTS) || 5;

export const UA = process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 30 * 60 * 1000;
export const CACHE_MAX_ENTRIES = parseInt(process.env.CACHE_MAX_ENTRIES) || 100;
export const CACHE_SAVE_DEBOUNCE = parseInt(process.env.CACHE_SAVE_DEBOUNCE) || 2000;
export const HTTP_CACHE_TTL = parseInt(process.env.HTTP_CACHE_TTL) || 5 * 60 * 1000;
export const HTTP_CACHE_MAX_ENTRIES = parseInt(process.env.HTTP_CACHE_MAX_ENTRIES) || 50;

export const REGEX_MAX_LENGTH = parseInt(process.env.REGEX_MAX_LENGTH) || 500;
export const REGEX_EXEC_TIMEOUT = parseInt(process.env.REGEX_EXEC_TIMEOUT) || 3000;

export const TRUNC_LIMIT = parseInt(process.env.TRUNC_LIMIT) || 2000;
export const FETCH_TRUNC_LIMIT = parseInt(process.env.FETCH_TRUNC_LIMIT) || 5000;
export const FETCH_FULL_LIMIT = parseInt(process.env.FETCH_FULL_LIMIT) || 8000;

export const ANALYSIS_TOTAL_TIMEOUT = parseInt(process.env.ANALYSIS_TOTAL_TIMEOUT) || 60000;

export const DEBUG_DISPLAY_COUNT = parseInt(process.env.DEBUG_DISPLAY_COUNT) || 3;
export const DEBUG_RESULT_SLICE = parseInt(process.env.DEBUG_RESULT_SLICE) || 150;
export const MAX_IFRAME_DEPTH = parseInt(process.env.MAX_IFRAME_DEPTH) || 3;

export const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT) || 3;

export const XPATH_EXACT_CLASS_PATTERN = /\[@class\s*=\s*["'][^"']+["']\]/;

const LOG_LEVEL = process.env.LOG_LEVEL || 'warn';
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };
const _logLevel = LOG_LEVELS[LOG_LEVEL] ?? LOG_LEVELS.warn;

export const logger = {
  debug: (...a) => { if (_logLevel <= 0) console.log('[DEBUG]', ...a); },
  info: (...a) => { if (_logLevel <= 1) console.log('[INFO]', ...a); },
  warn: (...a) => { if (_logLevel <= 2) console.error('[WARN]', ...a); },
  error: (...a) => { if (_logLevel <= 3) console.error('[ERROR]', ...a); }
};

export function validateConfig () {
  const errors = [];
  if (HTTP_TIMEOUT < 1000) errors.push('HTTP_TIMEOUT 不能小于 1000ms');
  if (MAX_RETRIES < 0 || MAX_RETRIES > 10) errors.push('MAX_RETRIES 必须在 0-10 之间');
  if (CACHE_MAX_ENTRIES < 1 || CACHE_MAX_ENTRIES > 1000) errors.push('CACHE_MAX_ENTRIES 必须在 1-1000 之间');
  if (errors.length > 0) {
    console.error('[CONFIG] 配置校验失败:');
    errors.forEach(err => console.error(`  - ${err}`));
    return false;
  }
  return true;
}

export function getConfigInfo () {
  return {
    version: VERSION,
    httpTimeout: HTTP_TIMEOUT,
    maxRetries: MAX_RETRIES,
    cacheTtl: CACHE_TTL,
    cacheMaxEntries: CACHE_MAX_ENTRIES,
    truncLimit: TRUNC_LIMIT,
    analysisTimeout: ANALYSIS_TOTAL_TIMEOUT,
    maxConcurrent: MAX_CONCURRENT,
    logLevel: LOG_LEVEL
  };
}

/**
 * 获取当前配置的完整环境变量列表
 * @returns {object} 环境变量映射
 */
export function getEnvConfig () {
  return {
    SPIDER_ROOT: process.env.SPIDER_ROOT || '未设置',
    HTTP_TIMEOUT: process.env.HTTP_TIMEOUT || '未设置',
    MAX_RETRIES: process.env.MAX_RETRIES || '未设置',
    CACHE_TTL: process.env.CACHE_TTL || '未设置',
    LOG_LEVEL: process.env.LOG_LEVEL || '未设置',
    MAX_CONCURRENT: process.env.MAX_CONCURRENT || '未设置',
    USER_AGENT: process.env.USER_AGENT || '未设置'
  };
}
