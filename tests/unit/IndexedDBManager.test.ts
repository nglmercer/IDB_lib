import { describe, it, expect, beforeEach } from 'bun:test';
import { IndexedDBManager } from '../../src/core/IndexedDBManager.js';
import type { DatabaseConfig } from '../../src/types/index.js';
import { waitForAsync, createTestData } from '../setup.js';

describe('IndexedDBManager', () => {
  let manager: IndexedDBManager;
  let testConfig: DatabaseConfig;

  beforeEach(() => {
    testConfig = {
      name: 'TestDB',
      version: 1,
      store: 'testStore'
    };
    
    manager = new IndexedDBManager({
      defaultDatabase: testConfig,
      debug: false
    });
  });

  describe('Inicialización', () => {
    it('debería crear una instancia correctamente', () => {
      expect(manager).toBeInstanceOf(IndexedDBManager);
    });

    it('debería configurar la base de datos por defecto', () => {
      expect(manager.getCurrentDatabase()).toEqual(testConfig);
    });

    it('debería permitir cambiar la configuración de la base de datos', () => {
      const newConfig: DatabaseConfig = {
        name: 'NewDB',
        version: 2,
        store: 'newStore'
      };
      
      manager.setDatabase(newConfig);
      expect(manager.getCurrentDatabase()).toEqual(newConfig);
    });
  });

  describe('Operaciones CRUD', () => {
    beforeEach(async () => {
      await manager.setDatabase(testConfig);
      await waitForAsync();
    });

    it('debería agregar un elemento', async () => {
      const testItem = { id: 1, name: 'Test Item', value: 100 };
      
      const result = await manager.add(testItem);
      expect(result).toBe(true);
    });

    it('debería obtener un elemento por ID', async () => {
      const testItem = { id: 1, name: 'Test Item', value: 100 };
      
      await manager.add(testItem);
      await waitForAsync();
      
      const retrieved = await manager.get(1);
      expect(retrieved).toEqual(testItem);
    });

    it('debería actualizar un elemento existente', async () => {
      const testItem = { id: 1, name: 'Test Item', value: 100 };
      const updatedItem = { id: 1, name: 'Updated Item', value: 200 };
      
      await manager.add(testItem);
      await waitForAsync();
      
      const result = await manager.update(updatedItem);
      expect(result).toBe(true);
      
      const retrieved = await manager.get(1);
      expect(retrieved).toEqual(updatedItem);
    });

    it('debería eliminar un elemento', async () => {
      const testItem = { id: 1, name: 'Test Item', value: 100 };
      
      await manager.add(testItem);
      await waitForAsync();
      
      const result = await manager.delete(1);
      expect(result).toBe(true);
      
      const retrieved = await manager.get(1);
      expect(retrieved).toBeUndefined();
    });

    it('debería obtener todos los elementos', async () => {
      const testData = createTestData(3);
      
      for (const item of testData) {
        await manager.add(item);
      }
      await waitForAsync();
      
      const allItems = await manager.getAll();
      expect(allItems).toHaveLength(3);
      expect(allItems).toEqual(expect.arrayContaining(testData));
    });

    it('debería contar elementos', async () => {
      const testData = createTestData(5);
      
      for (const item of testData) {
        await manager.add(item);
      }
      await waitForAsync();
      
      const count = await manager.count();
      expect(count).toBe(5);
    });

    it('debería limpiar todos los elementos', async () => {
      const testData = createTestData(3);
      
      for (const item of testData) {
        await manager.add(item);
      }
      await waitForAsync();
      
      const result = await manager.clear();
      expect(result).toBe(true);
      
      const count = await manager.count();
      expect(count).toBe(0);
    });
  });

  describe('Operaciones por lotes', () => {
    beforeEach(async () => {
      await manager.setDatabase(testConfig);
      await waitForAsync();
    });

    it('debería agregar múltiples elementos', async () => {
      const testData = createTestData(5);
      
      const result = await manager.addMany(testData);
      expect(result).toBe(true);
      
      const count = await manager.count();
      expect(count).toBe(5);
    });

    it('debería actualizar múltiples elementos', async () => {
      const testData = createTestData(3);
      await manager.addMany(testData);
      await waitForAsync();
      
      const updatedData = testData.map(item => ({
        ...item,
        name: `Updated ${item.name}`
      }));
      
      const result = await manager.updateMany(updatedData);
      expect(result).toBe(true);
      
      const allItems = await manager.getAll();
      expect(allItems.every(item => item.name.startsWith('Updated'))).toBe(true);
    });

    it('debería eliminar múltiples elementos', async () => {
      const testData = createTestData(5);
      await manager.addMany(testData);
      await waitForAsync();
      
      const idsToDelete = [1, 3, 5];
      const result = await manager.deleteMany(idsToDelete);
      expect(result).toBe(true);
      
      const count = await manager.count();
      expect(count).toBe(2);
    });

    it('debería obtener múltiples elementos por IDs', async () => {
      const testData = createTestData(5);
      await manager.addMany(testData);
      await waitForAsync();
      
      const idsToGet = [1, 3, 5];
      const items = await manager.getMany(idsToGet);
      
      expect(items).toHaveLength(3);
      expect(items.map(item => item.id)).toEqual(expect.arrayContaining(idsToGet));
    });
  });

  describe('Búsqueda y filtrado', () => {
    beforeEach(async () => {
      await manager.setDatabase(testConfig);
      const testData = [
        { id: 1, name: 'Apple', category: 'fruit', price: 1.5 },
        { id: 2, name: 'Banana', category: 'fruit', price: 0.8 },
        { id: 3, name: 'Carrot', category: 'vegetable', price: 1.2 },
        { id: 4, name: 'Broccoli', category: 'vegetable', price: 2.0 },
        { id: 5, name: 'Orange', category: 'fruit', price: 1.8 }
      ];
      await manager.addMany(testData);
      await waitForAsync();
    });

    it('debería buscar elementos por texto', async () => {
      const results = await manager.search('apple');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Apple');
    });

    it('debería filtrar elementos por criterios', async () => {
      const results = await manager.filter({ category: 'fruit' });
      expect(results).toHaveLength(3);
      expect(results.every(item => item.category === 'fruit')).toBe(true);
    });

    it('debería buscar con opciones de consulta', async () => {
      const results = await manager.search('', {
        limit: 2,
        offset: 1
      });
      expect(results).toHaveLength(2);
    });
  });

  describe('Eventos', () => {
    beforeEach(async () => {
      await manager.setDatabase(testConfig);
      await waitForAsync();
    });

    it('debería emitir evento al agregar elemento', async () => {
      let eventFired = false;
      let eventData: any = null;
      
      manager.on('add', (data) => {
        eventFired = true;
        eventData = data;
      });
      
      const testItem = { id: 1, name: 'Test Item', value: 100 };
      await manager.add(testItem);
      await waitForAsync();
      
      expect(eventFired).toBe(true);
      expect(eventData).toEqual(testItem);
    });

    it('debería emitir evento al actualizar elemento', async () => {
      let eventFired = false;
      
      manager.on('update', () => {
        eventFired = true;
      });
      
      const testItem = { id: 1, name: 'Test Item', value: 100 };
      await manager.add(testItem);
      await manager.update({ ...testItem, name: 'Updated' });
      await waitForAsync();
      
      expect(eventFired).toBe(true);
    });

    it('debería emitir evento al eliminar elemento', async () => {
      let eventFired = false;
      
      manager.on('delete', () => {
        eventFired = true;
      });
      
      const testItem = { id: 1, name: 'Test Item', value: 100 };
      await manager.add(testItem);
      await manager.delete(1);
      await waitForAsync();
      
      expect(eventFired).toBe(true);
    });

    it('debería permitir remover listeners', async () => {
      let eventCount = 0;
      
      const listener = () => {
        eventCount++;
      };
      
      manager.on('add', listener);
      
      const testItem = { id: 1, name: 'Test Item', value: 100 };
      await manager.add(testItem);
      await waitForAsync();
      
      manager.off('add', listener);
      
      await manager.add({ id: 2, name: 'Test Item 2', value: 200 });
      await waitForAsync();
      
      expect(eventCount).toBe(1);
    });
  });

  describe('Manejo de errores', () => {
    it('debería manejar errores de configuración inválida', () => {
      expect(() => {
        manager.setDatabase(null as any);
      }).toThrow();
    });

    it('debería manejar errores al agregar elementos inválidos', async () => {
      await manager.setDatabase(testConfig);
      
      const result = await manager.add(null as any);
      expect(result).toBe(false);
    });

    it('debería manejar errores al obtener elementos inexistentes', async () => {
      await manager.setDatabase(testConfig);
      
      const result = await manager.get(999);
      expect(result).toBeUndefined();
    });
  });
});