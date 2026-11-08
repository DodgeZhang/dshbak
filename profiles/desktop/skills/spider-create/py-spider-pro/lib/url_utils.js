/**
 * URL 纯函数工具
 */
export function fixUrl (href, host) {
  if (!href) return '';
  if (href.startsWith('//')) return 'https:' + href;
  if (href.startsWith('/')) return 'https://' + host + href;
  if (!href.startsWith('http')) return 'https://' + host + '/' + href;
  return href;
}

export function getHost (url) {
  try { return new URL(url).host; } catch { return ''; }
}

export function getBase (url) {
  try { const u = new URL(url); return u.protocol + '//' + u.host; } catch { return url; }
}

export function escapeRegExp (str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
