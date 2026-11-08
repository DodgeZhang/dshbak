/**
 * py-spider-pro HTTP 客户端 v2.0
 * 功能：增强版 HTTP 客户端，支持动态UA池、代理、智能限流和反爬策略
 */
import axios from 'axios';
import http2 from 'node:http2';
import zlib from 'node:zlib';
import { getHost } from './url_utils.js';
import {
  HTTP_TIMEOUT,
  REQUEST_DELAY,
  MAX_RETRIES,
  RETRY_BASE_DELAY,
  HTTP_CACHE_TTL,
  HTTP_CACHE_MAX_ENTRIES,
  MAX_REDIRECTS,
  logger
} from './config.js';
import {
  CloudflareError,
  NetworkError,
  TimeoutError,
  RateLimitError,
  CaptchaError
} from './errors.js';

/**
 * 动态 User-Agent 池
 * 包含多种浏览器和设备类型，模拟真实用户访问
 */
const USER_AGENT_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-G998U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; SM-G991U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
];

/**
 * 获取随机 User-Agent
 * @returns {string} 随机选择的 User-Agent
 */
function getRandomUserAgent () {
  return USER_AGENT_POOL[Math.floor(Math.random() * USER_AGENT_POOL.length)];
}

/**
 * 浏览器指纹头信息
 * 模拟真实浏览器的请求头
 */
const BROWSER_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Sec-Ch-Ua': '"Chromium";v="131", "Google Chrome";v="131"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1'
};

// 导出统一错误类（保持向后兼容）
export { CloudflareError as CloudflareChallengeError, NetworkError, TimeoutError, RateLimitError, CaptchaError };

/**
 * 检测 Cloudflare 挑战
 * @param {string} html - 响应 HTML 内容
 * @param {number} status - HTTP 状态码
 * @param {object} headers - 响应头
 * @returns {boolean} 是否检测到 Cloudflare 挑战
 */
function isCloudflareChallenge (html, status, headers) {
  if (typeof html !== 'string' || html.length < 200) {
    return false;
  }
  if (html.includes('Just a moment') && html.includes('challenges.cloudflare.com')) {
    return true;
  }
  if (status === 403 && headers?.['cf-mitigated'] === 'challenge') {
    return true;
  }
  return false;
}

/**
 * 通过 HTTP/2 协议获取页面（用于绕过 Cloudflare）
 * @param {string} url - 请求的 URL
 * @param {object} requestHeaders - 请求头
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {string} 页面内容
 */
async function fetchViaHttp2 (url, requestHeaders, timeout) {
  const parsedUrl = new URL(url);
  const origin = `${parsedUrl.protocol}//${parsedUrl.host}`;
  const path = parsedUrl.pathname + parsedUrl.search || '/';

  return new Promise((resolve, reject) => {
    const client = http2.connect(origin);

    // 设置超时
    const timeoutTimer = setTimeout(() => {
      client.destroy();
      reject(new Error(`HTTP/2 超时 (${timeout}ms)`));
    }, timeout);

    // 客户端错误处理
    client.on('error', (error) => {
      clearTimeout(timeoutTimer);
      client.destroy();
      reject(new Error(`HTTP/2 错误: ${error.message}`));
    });

    // 构建 HTTP/2 请求头
    const http2Headers = {
      ':method': 'GET',
      ':path': path,
      ':scheme': parsedUrl.protocol.replace(':', ''),
      ':authority': parsedUrl.host
    };

    // 过滤不允许的头信息
    const forbiddenHeaders = new Set([
      'host', 'connection', 'transfer-encoding', 'upgrade', 'keep-alive'
    ]);
    for (const [ key, value ] of Object.entries(requestHeaders)) {
      const lowerKey = key.toLowerCase();
      if (!forbiddenHeaders.has(lowerKey) && !lowerKey.startsWith(':')) {
        http2Headers[lowerKey] = value;
      }
    }

    // 发送请求
    const request = client.request(http2Headers);
    let responseHeaders = {};
    let responseChunks = [];

    // 响应头处理
    request.on('response', (headers) => {
      responseHeaders = headers;
      // 检测 Cloudflare 挑战
      if (headers[':status'] === 403 && headers['cf-mitigated'] === 'challenge') {
        clearTimeout(timeoutTimer);
        request.destroy();
        client.destroy();
        reject(new CloudflareError(url));
      }
    });

    // 数据接收
    request.on('data', (chunk) => {
      responseChunks.push(chunk);
    });

    // 请求结束
    request.on('end', () => {
      clearTimeout(timeoutTimer);
      const status = responseHeaders[':status'];
      const rawData = Buffer.concat(responseChunks);

      // 处理错误状态码
      if (status >= 400) {
        client.destroy();
        reject(new Error(`HTTP/2 错误状态码: ${status}`));
        return;
      }

      try {
        // 解压响应内容
        const encoding = (responseHeaders['content-encoding'] || '').toLowerCase();
        let body;

        if (encoding === 'br') {
          body = zlib.brotliDecompressSync(rawData).toString('utf-8');
        } else if (encoding === 'gzip') {
          body = zlib.gunzipSync(rawData).toString('utf-8');
        } else if (encoding === 'deflate') {
          body = zlib.inflateSync(rawData).toString('utf-8');
        } else {
          body = rawData.toString('utf-8');
        }

        // 再次检测 Cloudflare 挑战
        if (isCloudflareChallenge(body, status, responseHeaders)) {
          client.destroy();
          reject(new CloudflareError(url));
          return;
        }

        client.destroy();
        resolve(body);
      } catch (_) {
        // 解压失败时尝试直接返回原始内容
        try {
          client.destroy();
          resolve(rawData.toString('utf-8'));
        } catch (e) {
          reject(e);
        }
      }
    });

    // 请求错误处理
    request.on('error', (error) => {
      clearTimeout(timeoutTimer);
      client.destroy();
      reject(error);
    });

    request.end();
  });
}

/**
 * 异步信号量（用于控制并发）
 */
class AsyncSemaphore {
  /**
   * 创建信号量
   * @param {number} max - 最大并发数
   */
  constructor (max) {
    this._max = max;
    this._active = 0;
    this._queue = [];
  }

  /**
   * 获取信号量（阻塞等待）
   */
  async acquire () {
    if (this._active < this._max) {
      this._active++;
      return;
    }
    await new Promise((resolve) => this._queue.push(resolve));
  }

  /**
   * 释放信号量
   */
  release () {
    if (this._queue.length > 0) {
      this._queue.shift()();
    } else if (this._active > 0) {
      this._active--;
    }
  }
}

/**
 * LRU 缓存实现
 */
export class LRUCache {
  /**
   * 创建 LRU 缓存
   * @param {number} maxSize - 最大缓存条目数
   */
  constructor (maxSize) {
    this._maxSize = maxSize;
    this._map = new Map();

    // 双向链表实现
    this._head = { key: null, prev: null, next: null };
    this._tail = { key: null, prev: null, next: null };
    this._head.next = this._tail;
    this._tail.prev = this._head;
  }

  /**
   * 从链表中删除节点
   * @param {object} node - 要删除的节点
   */
  _deleteNode (node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }

  /**
   * 将节点添加到链表尾部
   * @param {object} node - 要添加的节点
   */
  _addNode (node) {
    node.prev = this._tail.prev;
    node.next = this._tail;
    this._tail.prev.next = node;
    this._tail.prev = node;
  }

  /**
   * 获取缓存值
   * @param {string} key - 缓存键
   * @returns {any} 缓存值（不存在返回 null）
   */
  get (key) {
    const node = this._map.get(key);
    if (!node) {
      return null;
    }
    // 移动到尾部表示最近使用
    this._deleteNode(node);
    this._addNode(node);
    return node.value;
  }

  /**
   * 设置缓存值
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   */
  set (key, value) {
    const existingNode = this._map.get(key);
    if (existingNode) {
      // 更新现有值并移动到尾部
      existingNode.value = value;
      this._deleteNode(existingNode);
      this._addNode(existingNode);
      return;
    }

    // 创建新节点
    const newNode = { key, value, prev: null, next: null };
    this._map.set(key, newNode);
    this._addNode(newNode);

    // 如果超过最大容量，删除头部节点（最久未使用）
    while (this._map.size > this._maxSize) {
      const oldestNode = this._head.next;
      this._deleteNode(oldestNode);
      this._map.delete(oldestNode.key);
    }
  }

  /**
   * 删除缓存项
   * @param {string} key - 缓存键
   * @returns {boolean} 是否删除成功
   */
  delete (key) {
    const node = this._map.get(key);
    if (!node) {
      return false;
    }
    this._deleteNode(node);
    this._map.delete(key);
    return true;
  }

  /**
   * 清空缓存
   */
  clear () {
    this._map.clear();
    this._head.next = this._tail;
    this._tail.prev = this._head;
  }

  /**
   * 获取缓存大小
   * @returns {number} 缓存条目数
   */
  get size () {
    return this._map.size;
  }
}

// 全局信号量（限制并发请求数）
const domainSemaphore = new AsyncSemaphore(10);

// 域名请求时间记录（用于限流）
const domainLastRequest = new Map();

// HTTP 缓存
const httpCache = new LRUCache(HTTP_CACHE_MAX_ENTRIES);

// 域名状态管理（用于智能限流）
const domainStatus = new Map();

/**
 * 检查错误是否可重试
 * @param {Error} error - 错误对象
 * @returns {boolean} 是否可重试
 */
function isRetryable (error) {
  // 网络层错误
  if (error.code && [ 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'EPIPE' ].includes(error.code)) {
    return true;
  }
  // HTTP 状态码错误
  if (error.response && [ 408, 429, 500, 502, 503, 504 ].includes(error.response.status)) {
    return true;
  }
  // 超时错误
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return true;
  }
  return false;
}

/**
 * 安全重定向跟随
 * @param {string} url - 初始 URL
 * @param {object} config - 请求配置
 * @param {number} maxRedirects - 最大重定向次数
 * @returns {object} 最终响应
 */
async function safeRedirect (url, config, maxRedirects, signal = null) {
  let currentUrl = url;
  let redirectCount = 0;

  while (true) {
    const requestConfig = {
      ...config,
      url: currentUrl,
      maxRedirects: 0,
      validateStatus: null
    };

    if (signal) {
      requestConfig.signal = signal;
    }

    const response = await axios(requestConfig);

    if (response.status < 300 || response.status >= 400) {
      return response;
    }

    redirectCount++;
    if (redirectCount > maxRedirects) {
      throw new NetworkError(`重定向次数超限(${maxRedirects})`, currentUrl);
    }

    const location = response.headers.location;
    if (!location) {
      throw new NetworkError(`${response.status} 响应缺少 Location 头`, currentUrl);
    }

    currentUrl = new URL(location, currentUrl).href;
  }
}

/**
 * 智能请求间隔控制
 * 根据域名状态动态调整请求间隔
 * @param {string} url - 请求的 URL
 * @returns {number} 应用的延迟时间（毫秒）
 */
async function smartThrottle (url) {
  const host = getHost(url);
  const now = Date.now();
  const lastRequestTime = domainLastRequest.get(host) || 0;

  // 获取或初始化域名状态
  const status = domainStatus.get(host) || {
    lastDelay: REQUEST_DELAY,
    errorCount: 0,
    successCount: 0
  };

  // 计算动态延迟
  let delay = status.lastDelay;
  if (status.errorCount > 2) {
    // 错误过多，增加延迟
    delay = Math.min(5000, delay * 1.5);
  } else if (status.successCount > 5) {
    // 成功较多，减少延迟
    delay = Math.max(200, delay * 0.8);
  }

  // 应用延迟
  if (now - lastRequestTime < delay) {
    await new Promise((resolve) => setTimeout(resolve, delay - (now - lastRequestTime)));
  }

  // 更新状态
  domainLastRequest.set(host, Date.now());
  domainStatus.set(host, { ...status, lastDelay: delay });

  return delay;
}

/**
 * 反爬策略库
 * 包含多种反爬检测和处理策略
 */
const antiCrawlStrategies = {
  cloudflare: {
    /**
     * 检测 Cloudflare 挑战
     * @param {string} html - 响应内容
     * @param {number} status - HTTP 状态码
     * @param {object} headers - 响应头
     * @returns {boolean} 是否检测到
     */
    detect: (html, status, headers) => isCloudflareChallenge(html, status, headers),

    /**
     * 处理 Cloudflare 挑战
     * @param {string} url - 请求的 URL
     * @param {object} headers - 请求头
     * @param {number} timeout - 超时时间
     * @returns {string} 处理后的页面内容
     */
    handle: async (url, headers, timeout) => {
      try {
        const html = await fetchViaHttp2(url, headers, timeout);
        return html;
      } catch {
        throw new CloudflareError(url);
      }
    }
  },

  rateLimit: {
    /**
     * 检测限流
     * @param {string} html - 响应内容
     * @param {number} status - HTTP 状态码
     * @param {object} headers - 响应头
     * @returns {boolean} 是否检测到
     */
    detect: (html, status, _headers) => status === 429,

    /**
     * 处理限流
     * @param {string} url - 请求的 URL
     * @param {object} headers - 响应头
     * @throws {RateLimitError} 抛出限流错误
     */
    handle: async (url, headers) => {
      const retryAfter = headers?.['retry-after'];
      throw new RateLimitError(`请求被限流: ${url}${retryAfter ? `，建议 ${retryAfter} 秒后重试` : ''}`);
    }
  },

  captcha: {
    /**
     * 验证码类型检测
     */
    detectType: (html) => {
      const types = [];
      if (html.includes('captcha') || html.includes('Captcha')) types.push('普通验证码');
      if (html.includes('滑动') || html.includes('拼图') || html.includes('验证滑动')) types.push('滑动验证码');
      if (html.includes('点选') || html.includes('点击') || html.includes('验证点选')) types.push('点选验证码');
      if (html.includes('短信验证') || html.includes('手机验证')) types.push('短信验证码');
      if (html.includes('邮箱验证') || html.includes('邮件验证')) types.push('邮箱验证码');
      if (html.includes('cf-captcha') || html.includes('Cloudflare')) types.push('Cloudflare验证码');
      if (html.includes('hcaptcha') || html.includes('hCaptcha')) types.push('hCaptcha');
      if (html.includes('reCaptcha') || html.includes('g-recaptcha')) types.push('Google reCAPTCHA');
      return types.length > 0 ? types : null;
    },

    /**
     * 检测验证码
     * @param {string} html - 响应内容
     * @returns {boolean} 是否检测到
     */
    detect: (html) => {
      const patterns = [
        /captcha/i, /验证码/, /验证滑动/, /验证点选/,
        /cf-captcha/i, /hcaptcha/i, /recaptcha/i,
        /短信验证/, /邮箱验证/, /安全验证/
      ];
      return patterns.some(p => p.test(html));
    },

    /**
     * 处理验证码
     * @param {string} url - 请求的 URL
     * @param {string} html - 响应内容（用于检测类型）
     * @throws {CaptchaError} 抛出验证码错误
     */
    handle: async function (url, html) {
      const types = this.detectType(html);
      const typeInfo = types ? ` (类型: ${types.join(', ')})` : '';
      throw new CaptchaError(`需要验证码: ${url}${typeInfo}`);
    }
  }
};

/**
 * 构建请求配置
 * @param {string} method - HTTP 方法
 * @param {number} timeout - 超时时间（毫秒）
 * @param {object} headers - 请求头
 * @param {object} proxy - 代理配置
 * @param {string} body - 请求体
 * @returns {object} axios 配置对象
 */
function buildRequestConfig (method, timeout, headers, proxy, body) {
  const config = {
    method,
    timeout,
    headers,
    maxRedirects: 0,
    validateStatus: null
  };

  if (body) {
    config.data = body;
  }

  if (proxy) {
    config.proxy = {
      host: proxy.host,
      port: proxy.port,
      auth: proxy.auth ? {
        username: proxy.auth.username,
        password: proxy.auth.password
      } : undefined
    };
  }

  return config;
}

/**
 * 执行反爬策略处理
 * @param {string} url - 请求的 URL
 * @param {object} headers - 请求头
 * @param {number} timeout - 超时时间
 * @param {object} response - axios 响应对象
 * @returns {{handled: boolean, data?: string}} 处理结果
 */
async function handleAntiCrawl (url, headers, timeout, response) {
  for (const [ strategyName, strategy ] of Object.entries(antiCrawlStrategies)) {
    if (strategy.detect(response.data, response.status, response.headers)) {
      logger.info(`[反爬] 检测到 ${strategyName}，执行处理策略`);
      const result = await strategy.handle(url, headers, timeout);
      if (result) {
        return { handled: true, data: result };
      }
    }
  }
  return { handled: false };
}

/**
 * 更新域名状态
 * @param {string} url - 请求的 URL
 * @param {number} delay - 应用的延迟时间
 * @param {boolean} isSuccess - 请求是否成功
 */
function updateDomainStatus (url, delay, isSuccess) {
  const host = getHost(url);
  const status = domainStatus.get(host) || {
    lastDelay: delay,
    errorCount: 0,
    successCount: 0
  };

  if (isSuccess) {
    domainStatus.set(host, {
      ...status,
      successCount: status.successCount + 1,
      errorCount: 0
    });
  } else {
    domainStatus.set(host, {
      ...status,
      errorCount: status.errorCount + 1
    });
  }
}

/**
 * 核心请求逻辑
 * @param {string} url - 请求的 URL
 * @param {string} method - HTTP 方法
 * @param {object} options - 请求选项
 * @param {number} [options.timeout] - 超时时间
 * @param {object} [options.extraHeaders] - 额外请求头
 * @param {boolean} [options.useCache] - 是否使用缓存
 * @param {object} [options.proxy] - 代理配置
 * @param {string} [options.body] - 请求体
 * @param {AbortSignal} [options.signal] - 请求取消信号
 * @returns {string} 响应内容
 */
async function fetchCore (url, method, options = {}) {
  const {
    timeout = HTTP_TIMEOUT,
    extraHeaders = {},
    useCache = false,
    proxy = null,
    body = '',
    signal = null
  } = options;

  const defaultHeaders = method === 'POST'
    ? Object.assign({}, BROWSER_HEADERS, { 'User-Agent': getRandomUserAgent(), 'Content-Type': 'application/x-www-form-urlencoded' }, extraHeaders)
    : Object.assign({}, BROWSER_HEADERS, { 'User-Agent': getRandomUserAgent() }, extraHeaders);

  const cacheKey = `${method}:${url}`;
  if (useCache && method === 'GET') {
    const cached = httpCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < HTTP_CACHE_TTL) {
      return cached.data;
    }
  }

  let lastError;
  const abortController = new AbortController();
  let timeoutId = null;

  const combinedSignal = signal
    ? (signal.aborted ? signal : signal)
    : null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await domainSemaphore.acquire();

    try {
      const delay = await smartThrottle(url);
      logger.info(`[HTTP] ${method} 请求 ${url} (延迟: ${delay}ms, 尝试: ${attempt + 1}/${MAX_RETRIES + 1})`);

      const config = buildRequestConfig(method, timeout, defaultHeaders, proxy, body);

      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        abortController.abort();
      }, timeout);

      const requestSignal = combinedSignal
        ? (() => { const ac = new AbortController(); combinedSignal.addEventListener('abort', () => ac.abort()); return ac.signal; })()
        : abortController.signal;

      const response = await safeRedirect(url, config, MAX_REDIRECTS, requestSignal);

      clearTimeout(timeoutId);

      const antiCrawlResult = await handleAntiCrawl(url, defaultHeaders, timeout, response);
      if (antiCrawlResult.handled) {
        if (useCache && method === 'GET') {
          httpCache.set(cacheKey, { data: antiCrawlResult.data, timestamp: Date.now() });
        }
        return antiCrawlResult.data;
      }

      updateDomainStatus(url, delay, true);

      if (useCache && method === 'GET') {
        httpCache.set(cacheKey, { data: response.data, timestamp: Date.now() });
      }

      return response.data;

    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      lastError = error;

      updateDomainStatus(url, REQUEST_DELAY, false);

      if (error.name === 'AbortError' || error.name === 'CanceledError') {
        domainSemaphore.release();
        throw new NetworkError(`请求被取消: ${url}`, url);
      }

      if (error instanceof CloudflareError) {
        domainSemaphore.release();
        throw error;
      }

      if (attempt >= MAX_RETRIES || !isRetryable(error)) {
        domainSemaphore.release();
        throw error;
      }

      const backoffDelay = RETRY_BASE_DELAY * Math.pow(2, attempt);
      logger.warn(`[HTTP] ${method} 请求失败，${backoffDelay}ms 后重试: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));

    } finally {
      domainSemaphore.release();
    }
  }

  throw lastError;
}

/**
 * 核心 GET 请求
 * @param {string} url - 请求的 URL
 * @param {object} options - 请求选项
 * @returns {string} 响应内容
 */
export async function fetchPage (url, options = {}) {
  return fetchCore(url, 'GET', options);
}

/**
 * 核心 POST 请求
 * @param {string} url - 请求的 URL
 * @param {object} options - 请求选项
 * @returns {string} 响应内容
 */
export async function fetchPagePost (url, options = {}) {
  return fetchCore(url, 'POST', options);
}
