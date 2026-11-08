/**
 * py-spider-pro 预定义安全正则模式
 * 这些模式都经过验证，不会造成 ReDoS 攻击
 * 当使用这些模式时，可以跳过 validateRegexSafety 检查
 *
 * 性能优化：
 * - 预编译正则表达式为 RegExp 对象
 * - 使用 Set 存储模式字符串，实现 O(1) 查找
 * - 避免运行时重复编译
 */

// 模式字符串集合，用于快速 O(1) 查找
const _safePatternSet = new Set();

// 预编译正则表达式映射
const _compiledPatterns = new Map();

function _registerPatterns (patterns) {
  for (const pattern of patterns) {
    _safePatternSet.add(pattern);
    try {
      _compiledPatterns.set(pattern, new RegExp(pattern));
    } catch {
      // 无效正则，静默跳过
    }
  }
}

export const SAFE_PATTERNS = {
  cmsDetection: [
    '\\/frim\\/|search\\.php\\?searchtype=5|\\/movie\\/index\\d+\\.html',
    '\\/index\\.php\\/vod\\/',
    '\\/api\\.php\\/provide|\\/api\\.php\\/provid',
    'WordPress|wordpress|wp-content|wp-includes',
    'Drupal|drupal',
    'Joomla|joomla',
    'Magento|magento'
  ],
  templateDetection: [
    'stui-header__menu.*stui-pannel.*stui-vodlist',
    'hy-video-list.*hy-play-list',
    'module-items.*module-item',
    'myui-vodlist.*myui-vodlist',
    'mac流失.* vod.*detail',
    'wp-content.*themes|wp-includes.*plugins',
    'drupal-sidebar|drupal-toolbar',
    'joomla-container|joomla-menu'
  ],
  searchPattern: [
    "search.*\\.php.*q=|<input[^>]*name=[\"']wd[\"']",
    ' vod\\/search\\/|\\/search\\/index\\.php',
    'index\\/search\\?q=|\\/search\\.html',
    '\\/search\\/|\\?s=',
    '\\/search\\/\\?|\\/search\\.php'
  ],
  pagination: [
    '\\/index\\.php\\/vod\\/show\\/id\\/\\w+',
    '\\/vod\\/type\\/id\\/\\d+',
    '\\/movie\\/type\\/\\d+',
    '\\/list\\/\\d+\\.html',
    'page=\\d+',
    '\\/\\d+\\/\\d+\\.html',
    '\\/page\\/\\d+|\\/paged\\/',
    '\\/\\d+\\/\\d+\\.html'
  ],
  videoList: [
    '\\.stui-vodlist|\\.hy-video-list|\\.module-items',
    '\\.myui-vodlist|\\.vod-list|\\.video-list',
    '\\.video-grid|\\.video-item|\\.media-item',
    '\\.wp-block-video|\\.video-wrapper',
    '\\.content-video|\\.video-container'
  ],
  detailUrl: [
    '\\/vod\\/detail\\/id\\/|\\/movie\\/.+\\.html',
    '\\/show\\/[a-zA-Z0-9]+|\\/video\\/.+',
    '\\/detail\\/\\d+|\\/info\\/\\d+',
    '\\/watch\\/\\d+|\\/player\\/',
    '\\/video\\/\\d+|\\/embed\\/',
    '\\/article\\/\\d+|\\/post\\/\\d+'
  ],
  playerSource: [
    'player\\.|player_|play\\.|play_',
    'MacPlayer|Player|IPlayer',
    'DPlayer|dp\\.play',
    'flv\\.js|FLVPlayer',
    'hls\\.js|HLSPlayer'
  ],
  iframePattern: [
    "<iframe[^>]+src=[\"'][^\"']+[\"'][^>]*>",
    "<iframe.+?src=[\"'](.+?)[\"'].*?>"
  ],
  xgplayerPattern: [
    'xgplayer|player.config|playerInit',
    'videos:\\s*\\[|sources:\\s*\\[',
    "url:\\s*[\"']https?://[^\"']+[\"']"
  ],
  encryption: [
    'base64decode|base64_decode|atob',
    '\\$\\.parseHTML|\\.html\\(\\)|innerHTML',
    '\\/\\w+\\.js\\?'
  ],
  videoPlatform: [
    'youtube\\.com\\/embed|youtu\\.be',
    'vimeo\\.com\\/\\d+',
    'dailymotion\\.com\\/embed',
    'bilibili\\.com\\/player',
    'iqiyi\\.com\\/player',
    'qq\\.com\\/video'
  ]
};

// 初始化注册所有模式
for (const patterns of Object.values(SAFE_PATTERNS)) {
  _registerPatterns(patterns);
}

/**
 * 快速检查模式是否已知安全
 * 使用 Set 实现 O(1) 查找
 * @param {string} pattern - 正则表达式模式
 * @returns {boolean} 是否为已知安全模式
 */
export function isKnownSafePattern (pattern) {
  return _safePatternSet.has(pattern);
}

/**
 * 获取预编译的正则表达式
 * @param {string} pattern - 正则表达式模式
 * @returns {RegExp|null} 预编译的正则表达式，如果不存在则返回 null
 */
export function getCompiledPattern (pattern) {
  return _compiledPatterns.get(pattern) || null;
}

/**
 * 使用预编译正则执行匹配（如果可用）
 * @param {string} pattern - 正则表达式模式
 * @param {string} text - 要匹配的文本
 * @returns {{success: boolean, result: Array|null, error: string|null}} 匹配结果
 */
export function safeMatch (pattern, text) {
  const regex = _compiledPatterns.get(pattern);
  if (regex) {
    try {
      const result = regex.exec(text);
      return { success: true, result, error: null };
    } catch (e) {
      return { success: false, result: null, error: e.message };
    }
  }
  return { success: false, result: null, error: 'Pattern not pre-compiled' };
}
