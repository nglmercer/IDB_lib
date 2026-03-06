import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import '../setup.js';
import { IndexedDBManager } from '../../src/core/IndexedDBManager.js';
import type { DatabaseConfig, DatabaseItem } from '../../src/types/index.js';
import { waitForAsync, createTestData } from '../setup.js';
import { NodeAdapter } from '../../src/adapters/node.js';

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

describe('IndexedDBManager > Operaciones por lotes', () => {
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
    expect(allItems.every((item: DatabaseItem) => (item as any).name.startsWith('Updated'))).toBe(true);
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
