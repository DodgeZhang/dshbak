/**
 * 历史记录管理器
 * 用于保存和管理分析和生成的历史记录
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, logger } from './config.js';

// 历史记录文件路径
const HISTORY_FILE = path.join(ROOT, 'spider_history.json');

/**
 * 加载历史记录
 */
export function loadHistory () {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    logger.error('加载历史记录失败:', e);
  }
  return [];
}

/**
 * 保存历史记录
 */
export function saveHistory (history) {
  try {
    // 限制历史记录数量为100条
    const limitedHistory = history.slice(-100);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(limitedHistory, null, 2));
  } catch (e) {
    logger.error('保存历史记录失败:', e);
  }
}

/**
 * 添加历史记录
 */
export function addHistory (record) {
  const history = loadHistory();
  const newRecord = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    ...record
  };
  history.push(newRecord);
  saveHistory(history);
  return newRecord;
}

/**
 * 获取历史记录
 */
export function getHistory (limit = 20) {
  const history = loadHistory();
  return history.slice(-limit).reverse();
}

/**
 * 清除历史记录
 */
export function clearHistory () {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      fs.unlinkSync(HISTORY_FILE);
    }
  } catch (e) {
    logger.error('清除历史记录失败:', e);
  }
}

/**
 * 显示历史记录（MCP 接口包装）
 */
export function handleShowHistory (args) {
  const limit = args?.limit || 20;
  const history = getHistory(limit);
  return { content: [{ type: 'json', data: history }] };
}

/**
 * 清除历史记录（MCP 接口包装）
 */
export function handleClearHistory () {
  clearHistory();
  return { content: [{ type: 'text', text: '✅ 历史记录已清除' }] };
}
