import { describe, it, expect } from '@jest/globals';
import { isPlaceholderValue, isRealValue } from '../placeholders.js';

describe('placeholders', () => {
  describe('isPlaceholderValue', () => {
    it('should treat the .env.example sentinels as placeholders', () => {
      expect(isPlaceholderValue('your_email@gmail.com')).toBe(true);
      expect(isPlaceholderValue('your_app_password')).toBe(true);
      expect(isPlaceholderValue('your_kindle_email@kindle.com')).toBe(true);
    });

    it('should treat blank values as placeholders', () => {
      expect(isPlaceholderValue('')).toBe(true);
      expect(isPlaceholderValue('   ')).toBe(true);
      expect(isPlaceholderValue(undefined)).toBe(true);
      expect(isPlaceholderValue(null)).toBe(true);
    });

    it('should ignore surrounding whitespace and case', () => {
      expect(isPlaceholderValue('  Your_App_Password ')).toBe(true);
    });

    it('should accept real-looking values', () => {
      expect(isPlaceholderValue('benoit@gmail.com')).toBe(false);
      expect(isPlaceholderValue('abcdefghijklmnop')).toBe(false);
    });

    it('should not reject a value that merely starts with "your"', () => {
      expect(isPlaceholderValue('yourname@gmail.com')).toBe(false);
      expect(isRealValue('yourname@gmail.com')).toBe(true);
    });
  });

  describe('isRealValue', () => {
    it('should reject non-strings', () => {
      expect(isRealValue(123)).toBe(false);
      expect(isRealValue({})).toBe(false);
    });

    it('should accept a non-placeholder string', () => {
      expect(isRealValue('smtp.gmail.com')).toBe(true);
    });
  });
});
