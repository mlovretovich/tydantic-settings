import { normalizeKey, isObject, deepFreeze } from './utils';

describe('utils', () => {
  describe('normalizeKey', () => {
    it('should convert snake_case to camelCase', () => {
      expect(normalizeKey('SOME_KEY_VALUE')).toBe('someKeyValue');
    });

    it('should convert kebab-case to camelCase', () => {
      expect(normalizeKey('some-key-value')).toBe('someKeyValue');
    });

    it('should handle single words', () => {
      expect(normalizeKey('KEY')).toBe('key');
    });

    it('should handle already camelCased strings', () => {
      expect(normalizeKey('someKeyValue')).toBe('someKeyValue');
    });
  });

  describe('isObject', () => {
    it('should return true for plain objects', () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ a: 1 })).toBe(true);
    });

    it('should return false for non-objects', () => {
      expect(isObject(null)).toBe(false);
      expect(isObject(undefined)).toBe(false);
      expect(isObject('string')).toBe(false);
      expect(isObject(123)).toBe(false);
      expect(isObject([])).toBe(false);
      expect(isObject(() => {})).toBe(false);
    });
  });

  describe('deepFreeze', () => {
    it('should freeze the top-level object', () => {
      const obj = { a: 1, b: 'hello' };
      deepFreeze(obj);
      expect(Object.isFrozen(obj)).toBe(true);
      expect(() => { (obj as any).a = 2; }).toThrow(TypeError);
    });

    it('should recursively freeze nested objects', () => {
      const obj = { a: { b: { c: 3 } } };
      deepFreeze(obj);
      expect(Object.isFrozen(obj)).toBe(true);
      expect(Object.isFrozen(obj.a)).toBe(true);
      expect(Object.isFrozen(obj.a.b)).toBe(true);
      expect(() => { (obj as any).a.b.c = 99; }).toThrow(TypeError);
    });

    it('should skip getter properties', () => {
      const obj: any = { value: 42 };
      Object.defineProperty(obj, 'computed', {
        get: () => obj.value * 2,
        enumerable: true,
        configurable: false
      });
      deepFreeze(obj);
      expect(Object.isFrozen(obj)).toBe(true);
      expect(obj.computed).toBe(84);
    });

    it('should return the same object reference', () => {
      const obj = { a: 1 };
      const result = deepFreeze(obj);
      expect(result).toBe(obj);
    });
  });
});
