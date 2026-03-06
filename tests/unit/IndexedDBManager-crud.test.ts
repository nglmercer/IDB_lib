import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import '../setup.js';
import { IndexedDBManager } from '../../src/core/IndexedDBManager.js';
import type { DatabaseConfig } from '../../src/types/index.js';
import { waitForAsync, createTestData } from '../setup.js';
import { NodeAdapter } from '../../src/adapters/node.js';

interface Itemtype extends import('../../src/types/index.js').DatabaseItem {
  name: string;
}

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

(globalThis as any).__mockEmitter = mockEmitter;

describe('IndexedDBManager > Operaciones CRUD', () => {
  let manager: IndexedDBManager;
  let testConfig: DatabaseConfig;
  let adapter: NodeAdapter;

  beforeEach(async () => {
    mockEmitter._events = {};
    (globalThis as any).__mockEmitter = mockEmitter;
    
    testConfig = {
      name: `TestDB_${Date.now()}`,
      version: 1,
      store: 'testStore'
    };
    
    adapter = new NodeAdapter('./test-data', { inMemory: true });
    
    manager = new IndexedDBManager({
      defaultDatabase: testConfig,
    }, { 
      debug: false, 
      adapter: adapter 
    });

    await manager.openDatabase();
    await manager.clearDatabase();
    await waitForAsync();
  });

  afterEach(async () => {
    try {
      await manager.clearDatabase();
      manager.close();
      adapter.clearAll();
    } catch (e) {
      console.error('Cleanup error:', e);
    }
  });

  it('debería agregar un elemento', async () => {
    const testItem = { id: 1, name: 'Test Item', value: 100 };
    
    const result = await manager.add(testItem);
    expect(result).toEqual(testItem);
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
    
    await manager.addMany(testData);
    await waitForAsync();
    
    const allItems = await manager.getAll();
    expect(allItems).toHaveLength(3);
  });

  it('debería contar elementos', async () => {
    const testData = createTestData(5);
    
    await manager.addMany(testData);
    await waitForAsync();
    
    const count = await manager.count();
    expect(count).toBe(5);
  });

  it('debería limpiar todos los elementos', async () => {
    const testData = createTestData(3);
    
    await manager.addMany(testData);
    await waitForAsync();
    
    await manager.clear();
    
    const count = await manager.count();
    expect(count).toBe(0);
  });
});
