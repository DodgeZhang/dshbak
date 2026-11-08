import { describe, it, expect } from 'vitest';
import { safeRegexExec, validateRegexSafety } from '../lib/regex_safe.js';

describe('regex_safe', () => {
  describe('validateRegexSafety', () => {
    it('should return safe true for safe patterns', () => {
      expect(validateRegexSafety('^abc$').safe).toBe(true);
      expect(validateRegexSafety('test').safe).toBe(true);
    });

    it('should return safe false for invalid patterns', () => {
      expect(validateRegexSafety('').safe).toBe(false);
      expect(validateRegexSafety('[invalid').safe).toBe(false);
    });
  });

  describe('safeRegexExec', () => {
    it('should execute safe regex patterns', async () => {
      const result = await safeRegexExec('test', 'this is a test');
      expect(result.success).toBe(true);
      expect(result.result[0]).toBe('test');
    });

    it('should handle text exceeding max length', () => {
      const longText = 'a'.repeat(10001);
      const result = safeRegexExec('a+', longText);
      expect(result.success).toBe(false);
      expect(result.error).toContain('超过最大限制');
    });
  });
});