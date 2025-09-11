import { beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';

// Mock IndexedDB para el entorno de testing
class MockIDBRequest {
  result: any = null;
  error: any = null;
  onsuccess: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  readyState: string = 'pending';
  private transaction?: MockIDBTransaction;

  constructor(result?: any, error?: any, transaction?: MockIDBTransaction) {
    this.transaction = transaction;
    setTimeout(() => {
      if (error) {
        this.error = error;
        this.readyState = 'done';
        if (this.onerror) {
          this.onerror({ target: this });
        }
        if (this.transaction) {
          this.transaction._triggerError(error);
        }
      } else {
        this.result = result;
        this.readyState = 'done';
        if (this.onsuccess) {
          this.onsuccess({ target: this });
        }
        // Complete transaction after successful operation
        if (this.transaction) {
          setTimeout(() => {
            this.transaction!._complete();
          }, 0);
        }
      }
    }, 0);
  }
}

class MockIDBObjectStore {
  name: string;
  keyPath: string;
  autoIncrement: boolean;
  private transaction?: MockIDBTransaction;
  private dbKey: string;

  constructor(name: string, options: { keyPath?: string; autoIncrement?: boolean } = {}, dbKey: string = 'default') {
    this.name = name;
    this.keyPath = options.keyPath || 'id';
    this.autoIncrement = options.autoIncrement || false;
    this.dbKey = dbKey;
  }

  private get data(): Map<any, any> {
    const dbStorage = globalDatabaseStorage.get(this.dbKey);
    if (!dbStorage) {
      const newStorage = new Map();
      globalDatabaseStorage.set(this.dbKey, newStorage);
      return newStorage;
    }
    return dbStorage;
  }

  setTransaction(transaction: MockIDBTransaction): void {
    this.transaction = transaction;
  }

  add(value: any, key?: any): MockIDBRequest {
    const id = key || value[this.keyPath];
    if (this.data.has(id)) {
      return new MockIDBRequest(undefined, new Error('Key already exists'), this.transaction);
    }
    this.data.set(id, value);
    return new MockIDBRequest(value, undefined, this.transaction);
  }

  put(value: any, key?: any): MockIDBRequest {
    const id = key || value[this.keyPath];
    this.data.set(id, value);
    return new MockIDBRequest(value, undefined, this.transaction);
  }

  get(key: any): MockIDBRequest {
    return new MockIDBRequest(this.data.get(key), undefined, this.transaction);
  }

  delete(key: any): MockIDBRequest {
    const existed = this.data.has(key);
    this.data.delete(key);
    return new MockIDBRequest(existed, undefined, this.transaction);
  }

  getAll(): MockIDBRequest {
    return new MockIDBRequest(Array.from(this.data.values()), undefined, this.transaction);
  }

  clear(): MockIDBRequest {
    this.data.clear();
    return new MockIDBRequest(undefined, undefined, this.transaction);
  }

  count(): MockIDBRequest {
    return new MockIDBRequest(this.data.size, undefined, this.transaction);
  }
}

class MockIDBTransaction {
  objectStoreNames: string[];
  mode: string;
  database: MockIDBDatabase;
  stores: Map<string, MockIDBObjectStore> = new Map();
  oncomplete: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onabort: ((event: any) => void) | null = null;
  error: any = null;
  private _completed = false;
  private _aborted = false;

  constructor(storeNames: string[], mode: string, db: MockIDBDatabase) {
    this.objectStoreNames = storeNames;
    this.mode = mode;
    this.database = db;
    
    // For upgrade transactions with '*', don't pre-populate stores
    // They will be created dynamically when accessed
    if (!(storeNames.length === 1 && storeNames[0] === '*')) {
      // Crear stores para esta transacción
      const dbKey = `${db.name}_v${db.version}`;
      storeNames.forEach(name => {
        if (db.stores.has(name)) {
          this.stores.set(name, db.stores.get(name)!);
        } else {
          // Create store if it doesn't exist
          const newStore = new MockIDBObjectStore(name, { keyPath: 'id' }, dbKey);
          this.stores.set(name, newStore);
          db.stores.set(name, newStore);
        }
      });
    }
  }

  objectStore(name: string): MockIDBObjectStore {
    let store = this.stores.get(name);
    if (!store) {
      // During upgrade transactions, we might need to access newly created stores
      if (this.mode === 'versionchange') {
        // Try to get the store from the database
        const dbStore = this.database?.stores.get(name);
        if (dbStore) {
          this.stores.set(name, dbStore);
          store = dbStore;
        }
      }
      if (!store) {
        throw new Error(`Object store '${name}' not found`);
      }
    }
    store.transaction = this;
    return store;
  }

  abort(): void {
    if (this._completed || this._aborted) return;
    this._aborted = true;
    if (this.onabort) {
      setTimeout(() => {
        this.onabort!({ target: this });
      }, 0);
    }
  }

  _complete(): void {
    if (this._completed || this._aborted) return;
    this._completed = true;
    if (this.oncomplete) {
      setTimeout(() => {
        this.oncomplete!({ target: this });
      }, 0);
    }
  }

  _triggerError(error: any): void {
    if (this._completed || this._aborted) return;
    this.error = error;
    if (this.onerror) {
      setTimeout(() => {
        this.onerror!({ target: this });
      }, 0);
    }
  }
}

class MockIDBDatabase {
  name: string;
  version: number;
  objectStoreNames: string[] & { contains: (name: string) => boolean } = Object.assign([], {
    contains: function(name: string) {
      return this.includes(name);
    }
  });
  stores: Map<string, MockIDBObjectStore> = new Map();
  onversionchange: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;

  constructor(name: string, version: number) {
    this.name = name;
    this.version = version;
  }

  createObjectStore(name: string, options?: { keyPath?: string; autoIncrement?: boolean }): MockIDBObjectStore {
    const dbKey = `${this.name}_v${this.version}`;
    const store = new MockIDBObjectStore(name, options, dbKey);
    this.stores.set(name, store);
    this.objectStoreNames.push(name);
    console.log(`Object store ${name} created with indexes.`);
    return store;
  }

  deleteObjectStore(name: string): void {
    this.stores.delete(name);
    this.objectStoreNames = this.objectStoreNames.filter(n => n !== name);
  }

  transaction(storeNames: string | string[], mode: string = 'readonly'): MockIDBTransaction {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    return new MockIDBTransaction(names, mode, this);
  }

  close(): void {
    if (this.onclose) {
      this.onclose({ target: this });
    }
  }
}

class MockIDBOpenDBRequest extends MockIDBRequest {
  onupgradeneeded: ((event: any) => void) | null = null;
  onblocked: ((event: any) => void) | null = null;
  transaction: MockIDBTransaction | null = null;

  constructor(name: string, version?: number) {
    // Get or create database from factory
    const dbKey = `${name}_v${version || 1}`;
    let db = mockFactory.databases.get(dbKey);
    if (!db) {
      db = new MockIDBDatabase(name, version || 1);
      mockFactory.databases.set(dbKey, db);
    }
    super(db);

    // Simular upgrade si es necesario
    setTimeout(() => {
      if (this.onupgradeneeded) {
        // Create a mock transaction for the upgrade with all possible store names
        // We'll use a special upgrade transaction that can create stores dynamically
        this.transaction = new MockIDBTransaction(['*'], 'versionchange', db);
        
        this.onupgradeneeded({
          target: this,
          oldVersion: 0,
          newVersion: version || 1,
          transaction: this.transaction
        });
      }
      
      // Después del upgrade, llamar onsuccess
      setTimeout(() => {
        if (this.onsuccess) {
          this.onsuccess({ target: this });
        }
      }, 0);
    }, 0);
  }
}

// Global storage for all mock databases to ensure data persistence
const globalDatabaseStorage = new Map<string, Map<string, any>>();

class MockIDBFactory {
  databases: Map<string, MockIDBDatabase> = new Map();

  open(name: string, version?: number): MockIDBOpenDBRequest {
    // Use existing database if it exists, otherwise create new one
    const dbKey = `${name}_v${version || 1}`;
    if (!globalDatabaseStorage.has(dbKey)) {
      globalDatabaseStorage.set(dbKey, new Map());
    }
    return new MockIDBOpenDBRequest(name, version);
  }

  deleteDatabase(name: string): MockIDBRequest {
    this.databases.delete(name);
    return new MockIDBRequest(undefined);
  }

  databases(): Promise<{ name: string; version: number }[]> {
    return Promise.resolve(
      Array.from(this.databases.entries()).map(([name, db]) => ({
        name,
        version: db.version
      }))
    );
  }
}

// Global factory instance
const mockFactory = new MockIDBFactory();

// Mock Emitter class for testing
class MockEmitter {
  private events: { [key: string]: Function[] } = {};

  on(event: string, callback: Function): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  off(event: string, callback?: Function): void {
    if (!this.events[event]) return;
    if (callback) {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    } else {
      delete this.events[event];
    }
  }

  emit(event: string, data?: any): void {
    if (!this.events[event]) return;
    this.events[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for '${event}':`, error);
      }
    });
  }

  removeAllListeners(): void {
    this.events = {};
  }

  listenerCount(event: string): number {
    return this.events[event] ? this.events[event].length : 0;
  }

  hasListeners(event: string): boolean {
    return this.listenerCount(event) > 0;
  }
}

// Configurar mocks globales
beforeAll(() => {
  // Mock IndexedDB
  (globalThis as any).indexedDB = mockFactory;
  (globalThis as any).IDBRequest = MockIDBRequest;
  (globalThis as any).IDBObjectStore = MockIDBObjectStore;
  (globalThis as any).IDBTransaction = MockIDBTransaction;
  (globalThis as any).IDBDatabase = MockIDBDatabase;
  (globalThis as any).IDBOpenDBRequest = MockIDBOpenDBRequest;

  // Mock DOM APIs necesarias
  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag === 'a') {
        return {
          href: '',
          download: '',
          click: () => {}
        };
      }
      return {};
    }
  };

  (globalThis as any).URL = {
    createObjectURL: (blob: any) => 'blob:mock-url',
    revokeObjectURL: (url: string) => {}
  };

  (globalThis as any).Blob = class MockBlob {
    constructor(public parts: any[], public options: any = {}) {}
  };

  (globalThis as any).FileReader = class MockFileReader {
    result: any = null;
    onload: ((event: any) => void) | null = null;
    onerror: ((event: any) => void) | null = null;

    readAsText(file: any): void {
      setTimeout(() => {
        this.result = file.content || '{}';
        if (this.onload) {
          this.onload({ target: this });
        }
      }, 0);
    }
  };

  // Mock the global emitter instance
  const mockEmitterInstance = new MockEmitter();
  
  // Mock the emitter module
  const originalRequire = (globalThis as any).require;
  (globalThis as any).require = function(id: string) {
    if (id.includes('Emitter') || id.includes('emitter')) {
      return {
        emitter: mockEmitterInstance,
        Emitter: MockEmitter,
        default: MockEmitter
      };
    }
    return originalRequire ? originalRequire(id) : {};
  };
});

// Limpiar después de cada test
afterEach(() => {
  // Limpiar todas las bases de datos mock
  (globalThis as any).indexedDB = new MockIDBFactory();
});

// Utilidades para tests
export const createMockFile = (content: string, name: string = 'test.json'): File => {
  return {
    name,
    size: content.length,
    type: 'application/json',
    content // Propiedad personalizada para el mock
  } as any;
};

export const waitForAsync = (ms: number = 10): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const createTestData = (count: number = 5): any[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Test Item ${i + 1}`,
    value: Math.random() * 100,
    created: new Date().toISOString()
  }));
};

export { MockIDBFactory, MockIDBRequest, MockIDBObjectStore, MockIDBTransaction, MockIDBDatabase, MockIDBOpenDBRequest };