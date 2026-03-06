import { describe, it, expect, beforeEach } from 'bun:test';
import { SchemaManager } from '../../src/core/schema/SchemaManager.js';
import type { DatabaseSchema, StoreSchema } from '../../src/types/index.js';

describe('Core > SchemaManager', () => {
  let schemaManager: SchemaManager;

  beforeEach(() => {
    schemaManager = new SchemaManager();
  });

  describe('setSchema()', () => {
    it('debería establecer un esquema y establecerlo como activo', () => {
      const schema: DatabaseSchema = {
        name: 'testDB',
        version: 1,
        stores: [
          { name: 'users', keyPath: 'id', indexes: [] }
        ]
      };

      schemaManager.setSchema(schema);
      
      expect(schemaManager.getSchema()).toEqual(schema);
      expect(schemaManager.getSchema('testDB')).toEqual(schema);
    });

    it('debería permitir múltiples esquemas', () => {
      const schema1: DatabaseSchema = {
        name: 'db1',
        version: 1,
        stores: [{ name: 'store1', keyPath: 'id', indexes: [] }]
      };
      const schema2: DatabaseSchema = {
        name: 'db2',
        version: 1,
        stores: [{ name: 'store2', keyPath: 'id', indexes: [] }]
      };

      schemaManager.setSchema(schema1);
      schemaManager.setSchema(schema2);

      expect(schemaManager.getSchema('db1')).toEqual(schema1);
      expect(schemaManager.getSchema('db2')).toEqual(schema2);
    });
  });

  describe('getSchema()', () => {
    it('debería devolver el esquema activo si no se especifica nombre', () => {
      const schema: DatabaseSchema = {
        name: 'testDB',
        version: 1,
        stores: []
      };

      schemaManager.setSchema(schema);
      
      expect(schemaManager.getSchema()).toEqual(schema);
    });

    it('debería devolver null si no hay esquema activo ni esquemas registrados', () => {
      expect(schemaManager.getSchema()).toBeNull();
    });

    it('debería devolver null para esquema inexistente', () => {
      expect(schemaManager.getSchema('nonexistent')).toBeNull();
    });
  });

  describe('getStoreConfig()', () => {
    it('debería obtener la configuración de un store específico', () => {
      const schema: DatabaseSchema = {
        name: 'testDB',
        version: 1,
        stores: [
          { name: 'users', keyPath: 'id', indexes: [] },
          { name: 'posts', keyPath: 'id', indexes: [] }
        ]
      };

      schemaManager.setSchema(schema);
      
      const storeConfig = schemaManager.getStoreConfig('testDB', 'users');
      
      expect(storeConfig).toEqual({ name: 'users', keyPath: 'id', indexes: [] });
    });

    it('debería devolver undefined para store inexistente', () => {
      const schema: DatabaseSchema = {
        name: 'testDB',
        version: 1,
        stores: []
      };

      schemaManager.setSchema(schema);
      
      expect(schemaManager.getStoreConfig('testDB', 'nonexistent')).toBeUndefined();
    });
  });

  describe('validateStore()', () => {
    it('debería validar que un store existe', () => {
      const schema: DatabaseSchema = {
        name: 'testDB',
        version: 1,
        stores: [
          { name: 'users', keyPath: 'id', indexes: [] }
        ]
      };

      schemaManager.setSchema(schema);
      
      expect(schemaManager.validateStore('testDB', 'users')).toBe(true);
    });

    it('debería retornar false para store inexistente', () => {
      const schema: DatabaseSchema = {
        name: 'testDB',
        version: 1,
        stores: []
      };

      schemaManager.setSchema(schema);
      
      expect(schemaManager.validateStore('testDB', 'nonexistent')).toBe(false);
    });

    it('debería retornar false para esquema inexistente', () => {
      expect(schemaManager.validateStore('nonexistent', 'users')).toBe(false);
    });
  });

  describe('getRegisteredSchemas()', () => {
    it('debería devolver nombres de esquemas registrados', () => {
      schemaManager.setSchema({ name: 'db1', version: 1, stores: [] });
      schemaManager.setSchema({ name: 'db2', version: 1, stores: [] });

      const schemas = schemaManager.getRegisteredSchemas();

      expect(schemas).toContain('db1');
      expect(schemas).toContain('db2');
    });

    it('debería devolver array vacío si no hay esquemas', () => {
      expect(schemaManager.getRegisteredSchemas()).toEqual([]);
    });
  });

  describe('clear()', () => {
    it('debería limpiar todos los esquemas', () => {
      schemaManager.setSchema({ name: 'db1', version: 1, stores: [] });
      schemaManager.setSchema({ name: 'db2', version: 1, stores: [] });

      schemaManager.clear();

      expect(schemaManager.getRegisteredSchemas()).toEqual([]);
      expect(schemaManager.getSchema()).toBeNull();
    });
  });

  describe('removeSchema()', () => {
    it('debería remover un esquema específico', () => {
      schemaManager.setSchema({ name: 'db1', version: 1, stores: [] });
      schemaManager.setSchema({ name: 'db2', version: 1, stores: [] });

      const result = schemaManager.removeSchema('db1');

      expect(result).toBe(true);
      expect(schemaManager.getSchema('db1')).toBeNull();
      expect(schemaManager.getSchema('db2')).not.toBeNull();
    });

    it('debería devolver false si el esquema no existe', () => {
      const result = schemaManager.removeSchema('nonexistent');
      expect(result).toBe(false);
    });

    it('debería limpiar esquema activo si se remueve', () => {
      const schema: DatabaseSchema = {
        name: 'testDB',
        version: 1,
        stores: []
      };
      
      schemaManager.setSchema(schema);
      
      // Add another schema to make it active
      schemaManager.setSchema({ name: 'db2', version: 1, stores: [] });
      schemaManager.removeSchema('db2');
      
      // Active schema should be the first one
      expect(schemaManager.getSchema()).not.toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('debería manejar esquemas con múltiples stores', () => {
      const schema: DatabaseSchema = {
        name: 'testDB',
        version: 1,
        stores: [
          { name: 'users', keyPath: 'id', indexes: [] },
          { name: 'posts', keyPath: 'id', indexes: [] },
          { name: 'comments', keyPath: 'id', indexes: [] }
        ]
      };

      schemaManager.setSchema(schema);

      expect(schemaManager.validateStore('testDB', 'users')).toBe(true);
      expect(schemaManager.validateStore('testDB', 'posts')).toBe(true);
      expect(schemaManager.validateStore('testDB', 'comments')).toBe(true);
      expect(schemaManager.validateStore('testDB', 'nonexistent')).toBe(false);
    });

    it('debería manejar stores con índices', () => {
      const schema: DatabaseSchema = {
        name: 'testDB',
        version: 1,
        stores: [
          { 
            name: 'users', 
            keyPath: 'id', 
            indexes: [
              { name: 'email', keyPath: 'email', unique: true }
            ]
          }
        ]
      };

      schemaManager.setSchema(schema);
      
      const storeConfig = schemaManager.getStoreConfig('testDB', 'users');
      
      expect(storeConfig?.indexes).toHaveLength(1);
      expect(storeConfig?.indexes?.[0].name).toBe('email');
    });
  });
});
