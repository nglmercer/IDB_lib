import { describe, it, expect, beforeEach } from 'bun:test';
import '../setup.js'; // Importar setup para configurar mocks
import { IndexedDBManager } from '../../src/core/IndexedDBManager.js';
import type { DatabaseConfig } from '../../src/types/index.js';
import { waitForAsync, createTestData, MockIDBFactory } from '../setup.js';

// Mock the emitter module
const mockEmitter = {
  on: (event: string, callback: Function) => {
    if (!mockEmitter._events) mockEmitter._events = {};
    if (!mockEmitter._events[event]) mockEmitter._events[event] = [];
    mockEmitter._events[event].push(callback);
  },
  off: (event: string, callback?: Function) => {
    if (!mockEmitter._events || !mockEmitter._events[event]) return;
    if (callback) {
      mockEmitter._events[event] = mockEmitter._events[event].filter((cb: Function) => cb !== callback);
    } else {
      delete mockEmitter._events[event];
    }
  },
  emit: (event: string, data?: any) => {
    if (!mockEmitter._events || !mockEmitter._events[event]) return;
    mockEmitter._events[event].forEach((callback: Function) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for '${event}':`, error);
      }
    });
  },
  _events: {} as { [key: string]: Function[] }
};

// Override the global emitter
(globalThis as any).__mockEmitter = mockEmitter;

describe('IndexedDBManager', () => {
  let manager: IndexedDBManager;
  let testConfig: DatabaseConfig;

  beforeEach(() => {
    // Asegurar que los mocks estén configurados
    if (!(globalThis as any).indexedDB) {
      (globalThis as any).indexedDB = new MockIDBFactory();
    }
    
    // Reset mock emitter state first
    mockEmitter._events = {};
    (globalThis as any).__mockEmitter = mockEmitter;
    
    testConfig = {
      name: 'TestDB',
      version: 1,
      store: 'testStore'
    };
    
    manager = new IndexedDBManager({
      defaultDatabase: testConfig,
      
    },{debug: false});
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
    });

    it('debería agregar un elemento', async () => {
      const testItem = { id: 1, name: 'Test Item', value: 100 };
      
      try {
        const result = await manager.add(testItem);
        expect(result).toEqual(testItem);
      } catch (error) {
        console.error('Error en test add:', error);
        throw error;
      }
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
      expect(result).toEqual(updatedItem);
      
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
      expect(retrieved).toBeNull();
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
      
      await manager.clear();
      // clear() returns void, so no result to check
      
      const count = await manager.count();
      expect(count).toBe(0);
    });
  });

  describe('Operaciones por lotes', () => {
    beforeEach(async () => {
      manager.refreshEmitterInstance();
      
      await manager.setDatabase(testConfig);
      await manager.openDatabase();
      await manager.clear(); // Clear database to ensure clean state
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
      const searchResult = await manager.searchData({}, {
        limit: 2,
        offset: 1
      });
      expect(searchResult.items).toHaveLength(2);
      expect(searchResult.total).toBe(5);
    });
  });

  describe('Eventos', () => {
    beforeEach(async () => {
      manager.refreshEmitterInstance();
      
      await manager.setDatabase(testConfig);
      await manager.openDatabase();
      await manager.clear(); // Clear database to ensure clean state
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
      await waitForAsync(100); // Increase wait time
      
      expect(eventFired).toBe(true);
      expect(eventData.data).toEqual(testItem);
      expect(eventData.config).toEqual(testConfig);
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
    it('debería manejar errores de configuración inválida', async () => {
      await expect(manager.setDatabase(null as any)).rejects.toThrow('Invalid database configuration provided');
    });

    it('debería manejar errores al agregar elementos inválidos', async () => {
      await manager.setDatabase(testConfig);
      
      await expect(manager.add(null as any)).rejects.toThrow('Invalid data: must be an object.');
    });

    it('debería manejar errores al obtener elementos inexistentes', async () => {
      await manager.setDatabase(testConfig);
      
      const result = await manager.get(999);
      expect(result).toBeNull();
    });
  });
});