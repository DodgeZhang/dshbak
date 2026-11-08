/**
 * py-spider-pro 输入验证模块
 * 功能：统一的输入验证和错误响应生成
 */
import { z } from 'zod';

// 支持的内容类型
export const CONTENT_TYPES = [ 'video', 'novel', 'image', 'manga', 'music', 'live', 'short' ];

// 输入验证 Schema
export const inputSchemas = {
  url: z.string().url('无效URL'),
  nonEmptyString: z.string().min(1, '不能为空'),
  sourceCode: z.string().min(1, '源码不能为空'),
  selector: z.string().min(1, '选择器不能为空'),
  contentType: z.enum(CONTENT_TYPES, 'content_type必须是: ' + CONTENT_TYPES.join('/')),
  maxConcurrent: z.number().int().min(1, 'max_concurrent最小为1').max(10, 'max_concurrent最大为10'),
  outputFormat: z.enum([ 'text', 'json' ], 'output_format必须是 text 或 json')
};

/**
 * 验证输入数据
 * @param {z.ZodType} schema - Zod 验证模式
 * @param {any} data - 待验证数据
 * @returns {{success: boolean, data?: any, error?: string}} 验证结果
 */
export function validateInput (schema, data) {
  try {
    return { success: true, data: schema.parse(data) };
  } catch (e) {
    return {
      success: false,
      error: e.errors.map(err => err.path.join('.') + ': ' + err.message).join(', ')
    };
  }
}

/**
 * 创建错误响应
 * @param {string|Error} msg - 错误信息或错误对象
 * @param {string} [format="text"] - 输出格式
 * @returns {object} MCP 响应格式
 */
export function createErrorResponse (msg, format = 'text') {
  const message = msg instanceof Error ? msg.message : String(msg);

  if (format === 'json') {
    return {
      content: [ {
        type: 'json',
        json: {
          success: false,
          error: message,
          timestamp: new Date().toISOString()
        }
      } ]
    };
  }

  return {
    content: [ { type: 'text', text: '❌ ' + message } ]
  };
}

/**
 * 创建成功响应
 * @param {string|object} data - 响应数据
 * @param {string} [format="text"] - 输出格式
 * @returns {object} MCP 响应格式
 */
export function createSuccessResponse (data, format = 'text') {
  if (format === 'json') {
    return {
      content: [ {
        type: 'json',
        json: {
          success: true,
          data,
          timestamp: new Date().toISOString()
        }
      } ]
    };
  }

  return {
    content: [ { type: 'text', text: data } ]
  };
}
