/**
 * py-spider-pro Python 代码解析模块
 * 功能：Python 代码结构分析、方法提取、语法解析
 */

/**
 * Python 代码预处理：去除三引号字符串内容（用于结构分析）
 * @param {string} code - Python 源代码
 * @returns {string} 预处理后的代码
 */
function preprocessPython (code) {
  const lines = code.split('\n');
  const result = [];
  let inTripleQuote = false;
  let tripleQuoteChar = '';

  for (const line of lines) {
    if (inTripleQuote) {
      const endIndex = line.indexOf(tripleQuoteChar);
      if (endIndex !== -1) {
        inTripleQuote = false;
        result.push(line.substring(endIndex + 3) || '');
      } else {
        result.push('');
      }
      continue;
    }

    const match = line.match(/("""|''')/);
    if (match) {
      const afterFirst = line.substring(line.indexOf(match[1]) + 3);
      if (afterFirst.includes(match[1])) {
        result.push(line);
      } else {
        inTripleQuote = true;
        tripleQuoteChar = match[1];
        result.push('');
      }
      continue;
    }

    result.push(line);
  }

  return result.join('\n');
}

/**
 * 提取 Python 方法体
 * @param {string[]} lines - 代码行数组
 * @param {number} startIndex - 方法定义行索引
 * @returns {string} 方法体内容
 */
function extractMethodBody (lines, startIndex) {
  const body = [];
  let methodIndent = 0;

  for (let i = startIndex; i < lines.length; i++) {
    const match = lines[i].match(/^(\s*)(?:async\s+)?def\s+/);
    if (match) {
      methodIndent = match[1].length;
      break;
    }
  }

  let bodyStarted = false;
  for (let i = startIndex + 1; i < lines.length; i++) {
    if (!lines[i].trim()) {
      body.push(lines[i]);
      continue;
    }

    const currentIndent = lines[i].match(/^(\s*)/)[1].length;

    if (!bodyStarted) {
      if (currentIndent > methodIndent) {
        bodyStarted = true;
        body.push(lines[i]);
      }
    } else {
      if (currentIndent <= methodIndent && lines[i].trim()) {
        break;
      }
      body.push(lines[i]);
    }
  }

  return body.join('\n');
}

/**
 * 解析 Python 代码结构（类和方法）
 * @param {string} code - Python 源代码
 * @returns {{classes: Array, globalMethods: Array}} 解析结果
 */
export function parsePythonStructure (code) {
  const cleanedCode = preprocessPython(code);
  const lines = cleanedCode.split('\n');
  const classes = [];
  const globalMethods = [];
  let currentClass = null;

  for (let i = 0; i < lines.length; i++) {
    const trimmedLine = lines[i].trim();

    if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('@')) {
      continue;
    }

    const classMatch = trimmedLine.match(/^class\s+(\w+)\s*(?:\(([^)]*)\))?\s*:/);
    if (classMatch) {
      currentClass = {
        name: classMatch[1],
        parent: classMatch[2] || '',
        line: i + 1,
        methods: []
      };
      classes.push(currentClass);
      continue;
    }

    const methodMatch = trimmedLine.match(/^(?:async\s+)?def\s+(\w+)\s*\(/);
    if (methodMatch) {
      const methodBody = extractMethodBody(code.split('\n'), i);
      const methodObject = {
        name: methodMatch[1],
        line: i + 1,
        body: methodBody,
        hasReturn: /return\s+/.test(methodBody),
        hasExcept: /except\s+/.test(methodBody),
        lineCount: methodBody.split('\n').length
      };

      if (currentClass) {
        currentClass.methods.push(methodObject);
      } else {
        globalMethods.push(methodObject);
      }
      continue;
    }

    if (trimmedLine && !trimmedLine.startsWith(' ') && !trimmedLine.startsWith('\t') && currentClass && i > currentClass.line) {
      currentClass = null;
    }
  }

  return { classes, globalMethods };
}

/**
 * 替换 Python 代码中的方法
 * @param {string} code - 原始代码
 * @param {string} methodName - 要替换的方法名
 * @param {string} newMethod - 新方法内容
 * @returns {string} 修改后的代码
 */
export function replaceMethod (code, methodName, newMethod) {
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
