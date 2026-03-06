import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import '../setup.js';
import { IndexedDBManager } from '../../src/core/IndexedDBManager.js';
import type { DatabaseConfig } from '../../src/types/index.js';
import { waitForAsync } from '../setup.js';
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

describe('IndexedDBManager > Búsqueda y filtrado', () => {
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

    // Add test data
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

  afterEach(async () => {
    try {
      await manager.clearDatabase();
      manager.close();
      adapter.clearAll();
    } catch (e) {
      console.error('Cleanup error:', e);
    }
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
