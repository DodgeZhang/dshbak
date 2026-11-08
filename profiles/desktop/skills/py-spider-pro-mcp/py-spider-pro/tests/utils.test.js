/**
 * 公共工具函数单元测试 v3.0
 */
import { describe, it, expect } from 'vitest';
import { escPy, truncStr, formatSize } from '../lib/utils.js';
import { TRUNC_LIMIT } from '../lib/config.js';

describe('utils', () => {
  describe('escPy', () => {
    it('转义双引号', () => {
      expect(escPy('hello "world"')).toBe('hello \\"world\\"');
    });

    it('转义单引号', () => {
      expect(escPy("hello 'world'")).toBe("hello \\'world\\'");
    });

    it('转义反斜杠', () => {
      expect(escPy('path\\to\\file')).toBe('path\\\\to\\\\file');
    });

    it('转义换行符', () => {
      expect(escPy('line1\nline2')).toBe('line1\\nline2');
    });

    it('处理null', () => {
      expect(escPy(null)).toBe('');
    });

    it('处理undefined', () => {
      expect(escPy(undefined)).toBe('');
    });
  });

  describe('truncStr', () => {
    it('不截断短字符串', () => {
      expect(truncStr('short text', 100)).toBe('short text');
    });

    it('截断过长字符串', () => {
      const longText = 'a'.repeat(200);
      expect(truncStr(longText, 100)).toBe('a'.repeat(100) + '\n...[截断]');
    });

    it('处理空字符串', () => {
      expect(truncStr('', 100)).toBe('');
    });

    it('处理null', () => {
      expect(truncStr(null, 100)).toBe('');
    });

    it('使用默认截断长度', () => {
      const longText = 'a'.repeat(TRUNC_LIMIT + 100);
      expect(truncStr(longText)).toBe('a'.repeat(TRUNC_LIMIT) + '\n...[截断]');
    });
  });

  describe('formatSize', () => {
    it('格式化0字节', () => {
      expect(formatSize(0)).toBe('0 B');
    });

    it('格式化KB', () => {
      expect(formatSize(1024)).toBe('1 KB');
    });

    it('格式化MB', () => {
      expect(formatSize(1024 * 1024)).toBe('1 MB');
    });

    it('格式化GB', () => {
      expect(formatSize(1024 * 1024 * 1024)).toBe('1 GB');
    });
  });
});