import { describe, it, expect } from 'bun:test';
import { validateDatabaseConfig } from '../../src/utils/helpers.js';
import type { DatabaseConfig } from '../../src/types/index.js';

describe('Helpers > Validación', () => {
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
});
