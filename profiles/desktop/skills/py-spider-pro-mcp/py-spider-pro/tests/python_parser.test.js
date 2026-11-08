import { describe, it, expect } from 'vitest';
import { parsePythonStructure, replaceMethod } from '../lib/python_parser.js';

describe('python_parser', () => {
  describe('parsePythonStructure', () => {
    it('should parse class structure', () => {
      const code = `class Spider:
    def run(self):
        pass`;
      const result = parsePythonStructure(code);
      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].name).toBe('Spider');
    });

    it('should parse multiple classes', () => {
      const code = `class Spider:
    def run(self):
        pass

class Parser:
    def parse(self):
        pass`;
      const result = parsePythonStructure(code);
      expect(result.classes).toHaveLength(2);
      expect(result.classes[0].name).toBe('Spider');
      expect(result.classes[1].name).toBe('Parser');
    });
  });

  describe('replaceMethod', () => {
    it('should replace method content', () => {
      const code = `class Spider:
    def test(self):
        return 1`;
      const newBody = '        return 2';
      const result = replaceMethod(code, 'test', newBody);
      expect(result).toContain('return 2');
    });
  });
});