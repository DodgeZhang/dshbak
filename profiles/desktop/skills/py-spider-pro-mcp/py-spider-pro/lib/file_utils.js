/**
 * py-spider-pro 文件操作工具
 * 功能：文件读写、目录管理
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * 写入文件
 * @param {string} filePath - 文件路径
 * @param {string} content - 文件内容
 * @returns {{success: boolean, message: string}} 写入结果
 */
export function writeFile (filePath, content) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true, message: `文件已写入: ${filePath}` };
  } catch (e) {
    return { success: false, message: `写入文件失败: ${e.message}` };
  }
}

/**
 * 读取文件
 * @param {string} filePath - 文件路径
 * @returns {{success: boolean, content: string, message: string}} 读取结果
 */
export function readFile (filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, content, message: '读取成功' };
  } catch (e) {
    return { success: false, content: '', message: `读取文件失败: ${e.message}` };
  }
}

/**
 * 检查文件是否存在
 * @param {string} filePath - 文件路径
 * @returns {boolean} 是否存在
 */
export function fileExists (filePath) {
  return fs.existsSync(filePath);
}

/**
 * 删除文件
 * @param {string} filePath - 文件路径
 * @returns {{success: boolean, message: string}} 删除结果
 */
export function deleteFile (filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return { success: true, message: `文件已删除: ${filePath}` };
    }
    return { success: true, message: '文件不存在' };
  } catch (e) {
    return { success: false, message: `删除文件失败: ${e.message}` };
  }
}
