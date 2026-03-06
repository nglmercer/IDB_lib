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

describe('IndexedDBManager > Eventos', () => {
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

  it('debería emitir evento al agregar elemento', async () => {
    let eventFired = false;
    let eventData: any | null = null;
    
    manager.on('add', (data) => {
      eventFired = true;
      eventData = data;
    });
    
    const testItem = { id: 1, name: 'Test Item', value: 100 };
    await manager.add(testItem);
    await waitForAsync(100);
    
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
