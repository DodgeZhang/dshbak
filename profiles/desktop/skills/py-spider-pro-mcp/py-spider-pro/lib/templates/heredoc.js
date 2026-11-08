/**
 * Heredoc 模板辅助
 */
export function heredoc (fn) {
  const str = fn.toString().replace(/^[^/]*\/\*/,'').replace(/\*\/[^*/]*$/,'');
  return str.trim();
}

/**
 * 模板变量替换
 */
export function renderTemplate (template, data) {
  let result = template;
  // 替换简单变量 ${var}
  result = result.replace(/\$\{([^}]+)\}/g, (match, expr) => {
    try {
      // 尝试直接获取变量
      if (data[expr]) {
        return data[expr];
      }
      // 尝试执行表达式（如 array.join()）
      const fn = new Function('data', `return data.${expr}`);
      return fn(data);
    } catch (_) {
      return match; // 替换失败时保持原样
    }
  });
  return result;
}
