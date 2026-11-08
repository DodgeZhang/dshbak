/**
 * py-spider-pro 公共工具函数
 * 功能：Python转义、文本处理等通用工具
 */

/**
 * Python 字符串转义
 * @param {string} s - 待转义字符串
 * @returns {string} 转义后的字符串
 */
export function escPy (s) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/"""/g, '\\"\\"\\"')
    .replace(/'''/g, "\\'\\'\\'")
    .replace(/"/g, '\\"').replace(/'/g, "\\'")
    .replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
    .replace(/\0/g, '\\0').replace(/`/g, '\\`')
    .replace(/\{/g, '\\{').replace(/\}/g, '\\}');
}

/**
 * 文本截断
 * @param {string} s - 待截断字符串
 * @param {number} max - 最大长度
 * @returns {string} 截断后的字符串
 */
export function truncStr (s, max = 2000) {
  if (!s) return '';
  return s.length > max ? s.slice(0, max) + '\n...[截断]' : s;
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小字符串
 */
export function formatSize (bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const s = [ 'B', 'KB', 'MB', 'GB' ];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + s[i];
}
