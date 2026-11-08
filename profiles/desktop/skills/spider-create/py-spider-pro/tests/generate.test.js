/**
 * generate 模块单元测试
 */
import { describe, it, expect, vi } from 'vitest';
import { parsePythonStructure } from '../lib/python_parser.js';

describe('generate', () => {
  describe('parsePythonStructure', () => {
    it('解析简单 Python 类', () => {
      const code = `class Spider:\n    def homeContent(self):\n        pass\n    def categoryContent(self):\n        pass`;
      const result = parsePythonStructure(code);
      expect(result.classes.length).toBe(1);
      expect(result.classes[0].name).toBe('Spider');
    });

    it('解析带继承的类', () => {
      const code = `class MySpider(BaseSpider):\n    def detailContent(self):\n        return "test"`;
      const result = parsePythonStructure(code);
      expect(result.classes[0].name).toBe('MySpider');
      expect(result.classes[0].parent).toBe('BaseSpider');
    });

    it('解析全局函数', () => {
      const code = `def helper():\n    pass\nclass Spider:\n    def homeContent(self):\n        pass`;
      const result = parsePythonStructure(code);
      expect(result.globalMethods.length).toBe(1);
      expect(result.globalMethods[0].name).toBe('helper');
    });
  });
});