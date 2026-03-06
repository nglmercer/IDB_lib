import { describe, it, expect } from 'bun:test';
import {
  normalizeId,
  isValidId,
  findMissingIds,
  generateNextId
} from '../../src/utils/helpers.js';

describe('Helpers > ID', () => {
  describe('normalizeId', () => {
    it('debería convertir string a número', () => {
      expect(normalizeId('123')).toBe(123);
      expect(normalizeId('0')).toBe(0);
    });

    it('debería mantener números como números', () => {
      expect(normalizeId(123)).toBe(123);
      expect(normalizeId(0)).toBe(0);
    });

    it('debería manejar strings no numéricos', () => {
      expect(normalizeId('abc')).toBe('abc');
      expect(normalizeId('123abc')).toBe('123abc');
    });

    it('debería lanzar error al recibir valores null/undefined', () => {
      expect(() => normalizeId(null)).toThrow('ID no puede ser null o undefined');
      expect(() => normalizeId(undefined)).toThrow('ID no puede ser null o undefined');
    });
  });

  describe('isValidId', () => {
    it('debería validar IDs válidos', () => {
      expect(isValidId(1)).toBe(true);
      expect(isValidId('abc')).toBe(true);
      expect(isValidId(0)).toBe(true);
    });

    it('debería rechazar IDs inválidos', () => {
      expect(isValidId(null)).toBe(false);
      expect(isValidId(undefined)).toBe(false);
      expect(isValidId('')).toBe(false);
      expect(isValidId(NaN)).toBe(false);
    });
  });

  describe('findMissingIds', () => {
    it('debería encontrar IDs faltantes en secuencia', () => {
      const existing = [1, 2, 4, 5, 7];
      const missing = findMissingIds(existing, 1, 7);
      expect(missing).toEqual([3, 6]);
    });

    it('debería manejar secuencias completas', () => {
      const existing = [1, 2, 3, 4, 5];
      const missing = findMissingIds(existing, 1, 5);
      expect(missing).toEqual([]);
    });

    it('debería manejar rangos vacíos', () => {
      const existing: number[] = [];
      const missing = findMissingIds(existing, 1, 3);
      expect(missing).toEqual([1, 2, 3]);
    });

    it('debería manejar IDs string', () => {
      const existing = ['a', 'c', 'e'];
      const missing = findMissingIds(existing, 'a', 'e');
      expect(missing).toEqual(['b', 'd']);
    });
  });

  describe('generateNextId', () => {
    it('debería generar el siguiente ID numérico', () => {
      const existing = [1, 2, 3];
      expect(generateNextId(existing)).toBe(4);
    });

    it('debería manejar arrays vacíos', () => {
      expect(generateNextId([])).toBe(1);
    });

    it('debería manejar IDs no secuenciales', () => {
      const existing = [5, 2, 8, 1];
      expect(generateNextId(existing)).toBe(9);
    });

    it('debería manejar IDs string', () => {
      const existing = ['item1', 'item2', 'item3'];
      const nextId = generateNextId(existing);
      expect(typeof nextId).toBe('string');
      expect(nextId).toMatch(/^[a-f0-9-]{36}$/);
    });
  });
});
