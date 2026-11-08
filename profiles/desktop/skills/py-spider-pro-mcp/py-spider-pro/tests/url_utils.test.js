/**
 * URL工具函数单元测试 v3.0
 */
import { describe, it, expect } from 'vitest';
import { fixUrl, getHost, getBase, escapeRegExp } from '../lib/url_utils.js';

describe('url_utils', () => {
  describe('fixUrl', () => {
    it('处理相对路径(以/开头)', () => {
      expect(fixUrl('/path/to/page', 'example.com')).toBe('https://example.com/path/to/page');
    });

    it('处理协议相对路径(以//开头)', () => {
      expect(fixUrl('//example.com/path', 'other.com')).toBe('https://example.com/path');
    });

    it('处理绝对URL', () => {
      expect(fixUrl('https://example.com/page', 'other.com')).toBe('https://example.com/page');
    });

    it('处理没有协议的相对路径', () => {
      expect(fixUrl('path/to/page', 'example.com')).toBe('https://example.com/path/to/page');
    });

    it('处理空字符串', () => {
      expect(fixUrl('', 'example.com')).toBe('');
    });

    it('处理null', () => {
      expect(fixUrl(null, 'example.com')).toBe('');
    });
  });

  describe('getHost', () => {
    it('从完整URL提取主机名', () => {
      expect(getHost('https://example.com/path')).toBe('example.com');
    });

    it('从带端口的URL提取主机名', () => {
      expect(getHost('https://example.com:8080/path')).toBe('example.com:8080');
    });

    it('处理无效URL', () => {
      expect(getHost('invalid-url')).toBe('');
    });
  });

  describe('getBase', () => {
    it('从完整URL提取基础URL', () => {
      expect(getBase('https://example.com/path/to/page')).toBe('https://example.com');
    });

    it('从带端口的URL提取基础URL', () => {
      expect(getBase('https://example.com:8080/path')).toBe('https://example.com:8080');
    });
  });

  describe('escapeRegExp', () => {
    it('转义特殊字符', () => {
      const result = escapeRegExp('.*+?^${}()|[]\\');
      expect(result).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
    });

    it('处理普通字符串', () => {
      expect(escapeRegExp('hello')).toBe('hello');
    });
  });
});