import { describe, it, expect } from 'bun:test';
import {
  normalizeId,
  isValidId,
  findMissingIds,
  generateNextId,
  validateDatabaseConfig,
  createTimestamp,
  debounce,
  throttle,
  convertToCSV
} from '../../src/utils/helpers.js';
import type { DatabaseConfig } from '../../src/types/index.js';
import { waitForAsync } from '../setup.js';

describe('Helpers', () => {
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

    it('debería manejar valores null/undefined', () => {
      expect(normalizeId(null)).toBeNull();
      expect(normalizeId(undefined)).toBeUndefined();
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

  describe('validateDatabaseConfig', () => {
    it('debería validar configuración correcta', () => {
      const config: DatabaseConfig = {
        name: 'TestDB',
        version: 1,
        store: 'testStore'
      };
      expect(validateDatabaseConfig(config)).toBe(true);
    });

    it('debería rechazar configuración sin nombre', () => {
      const config = {
        version: 1,
        store: 'testStore'
      } as DatabaseConfig;
      expect(validateDatabaseConfig(config)).toBe(false);
    });

    it('debería rechazar configuración sin versión', () => {
      const config = {
        name: 'TestDB',
        store: 'testStore'
      } as DatabaseConfig;
      expect(validateDatabaseConfig(config)).toBe(false);
    });

    it('debería rechazar configuración sin store', () => {
      const config = {
        name: 'TestDB',
        version: 1
      } as DatabaseConfig;
      expect(validateDatabaseConfig(config)).toBe(false);
    });

    it('debería rechazar versión inválida', () => {
      const config: DatabaseConfig = {
        name: 'TestDB',
        version: 0,
        store: 'testStore'
      };
      expect(validateDatabaseConfig(config)).toBe(false);
    });

    it('debería rechazar nombre vacío', () => {
      const config: DatabaseConfig = {
        name: '',
        version: 1,
        store: 'testStore'
      };
      expect(validateDatabaseConfig(config)).toBe(false);
    });

    it('debería rechazar store vacío', () => {
      const config: DatabaseConfig = {
        name: 'TestDB',
        version: 1,
        store: ''
      };
      expect(validateDatabaseConfig(config)).toBe(false);
    });
  });

  describe('createTimestamp', () => {
    it('debería crear timestamp en formato ISO', () => {
      const timestamp = createTimestamp();
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('debería crear timestamp para fecha específica', () => {
      const date = new Date('2023-01-01T12:00:00.000Z');
      const timestamp = createTimestamp(date);
      expect(timestamp).toBe('2023-01-01T12:00:00.000Z');
    });
  });

  describe('debounce', () => {
    it('debería retrasar la ejecución de la función', async () => {
      let callCount = 0;
      const fn = () => callCount++;
      const debouncedFn = debounce(fn, 50);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(callCount).toBe(0);

      await waitForAsync(60);
      expect(callCount).toBe(1);
    });

    it('debería pasar argumentos correctamente', async () => {
      let lastArgs: any[] = [];
      const fn = (...args: any[]) => {
        lastArgs = args;
      };
      const debouncedFn = debounce(fn, 50);

      debouncedFn('a', 'b', 'c');
      await waitForAsync(60);

      expect(lastArgs).toEqual(['a', 'b', 'c']);
    });

    it('debería cancelar ejecuciones previas', async () => {
      let callCount = 0;
      const fn = () => callCount++;
      const debouncedFn = debounce(fn, 50);

      debouncedFn();
      await waitForAsync(25);
      debouncedFn();
      await waitForAsync(25);
      debouncedFn();
      await waitForAsync(60);

      expect(callCount).toBe(1);
    });
  });

  describe('throttle', () => {
    it('debería limitar la frecuencia de ejecución', async () => {
      let callCount = 0;
      const fn = () => callCount++;
      const throttledFn = throttle(fn, 50);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(callCount).toBe(1);

      await waitForAsync(60);
      throttledFn();
      expect(callCount).toBe(2);
    });

    it('debería ejecutar inmediatamente la primera llamada', () => {
      let callCount = 0;
      const fn = () => callCount++;
      const throttledFn = throttle(fn, 50);

      throttledFn();
      expect(callCount).toBe(1);
    });

    it('debería pasar argumentos de la primera llamada', async () => {
      let lastArgs: any[] = [];
      const fn = (...args: any[]) => {
        lastArgs = args;
      };
      const throttledFn = throttle(fn, 50);

      throttledFn('first');
      throttledFn('second');
      throttledFn('third');

      expect(lastArgs).toEqual(['first']);
    });
  });

  describe('convertToCSV', () => {
    it('debería convertir array de objetos a CSV', () => {
      const data = [
        { id: 1, name: 'John', age: 30 },
        { id: 2, name: 'Jane', age: 25 },
        { id: 3, name: 'Bob', age: 35 }
      ];

      const csv = convertToCSV(data);
      const lines = csv.split('\n');

      expect(lines[0]).toBe('id,name,age');
      expect(lines[1]).toBe('1,John,30');
      expect(lines[2]).toBe('2,Jane,25');
      expect(lines[3]).toBe('3,Bob,35');
    });

    it('debería manejar valores con comas', () => {
      const data = [
        { id: 1, description: 'Item with, comma' }
      ];

      const csv = convertToCSV(data);
      expect(csv).toContain('"Item with, comma"');
    });

    it('debería manejar valores con comillas', () => {
      const data = [
        { id: 1, description: 'Item with "quotes"' }
      ];

      const csv = convertToCSV(data);
      expect(csv).toContain('"Item with ""quotes"""');
    });

    it('debería manejar arrays vacíos', () => {
      const csv = convertToCSV([]);
      expect(csv).toBe('');
    });

    it('debería manejar objetos con propiedades diferentes', () => {
      const data = [
        { id: 1, name: 'John' },
        { id: 2, age: 25 },
        { id: 3, name: 'Bob', age: 35, city: 'NYC' }
      ];

      const csv = convertToCSV(data);
      const lines = csv.split('\n');

      expect(lines[0]).toBe('id,name,age,city');
      expect(lines[1]).toBe('1,John,,');
      expect(lines[2]).toBe('2,,25,');
      expect(lines[3]).toBe('3,Bob,35,NYC');
    });

    it('debería manejar valores null y undefined', () => {
      const data = [
        { id: 1, name: null, age: undefined, active: true }
      ];

      const csv = convertToCSV(data);
      expect(csv).toContain('1,,,true');
    });
  });
});