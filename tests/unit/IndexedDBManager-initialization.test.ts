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

describe('IndexedDBManager > Inicialización', () => {
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
