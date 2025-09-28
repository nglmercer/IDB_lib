import { beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';

// Class for objectStoreNames that extends Array with contains method
class ObjectStoreNamesArray extends Array<string> {
  contains(name: string): boolean {
    return this.includes(name);
  }
}

// Mock IndexedDB para el entorno de testing
class MockIDBRequest {
  result: any = null;
  error: any = null;
  onsuccess: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  readyState: string = 'pending';
  transaction?: MockIDBTransaction;

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

class MockIDBIndex {
  name: string;
  keyPath: string | string[];
  unique: boolean;
  objectStore: MockIDBObjectStore;

  constructor(name: string, keyPath: string | string[], unique: boolean = false, objectStore: MockIDBObjectStore) {
    this.name = name;
    this.keyPath = keyPath;
    this.unique = unique;
    this.objectStore = objectStore;
  }

  get(key: any): MockIDBRequest {
    // Buscar en el store por el índice
    const allData = Array.from(this.objectStore.data.values());
    const found = allData.find(item => {
      const indexValue = Array.isArray(this.keyPath) 
        ? this.keyPath.map(path => item[path]).join('|')
        : item[this.keyPath as string];
      return indexValue === key;
    });
    return new MockIDBRequest(found, undefined, this.objectStore.transaction);
  }

  getAll(): MockIDBRequest {
    return new MockIDBRequest(Array.from(this.objectStore.data.values()), undefined, this.objectStore.transaction);
  }
}

class MockIDBObjectStore {
  name: string;
  keyPath: string;
  autoIncrement: boolean;
  transaction?: MockIDBTransaction;
  private dbKey: string;
  public indexNames: ObjectStoreNamesArray;
  private indexes: Map<string, MockIDBIndex> = new Map();

  constructor(name: string, options: { keyPath?: string; autoIncrement?: boolean } = {}, dbKey: string = 'default') {
    this.name = name;
    this.keyPath = options.keyPath || 'id';
    this.autoIncrement = options.autoIncrement || false;
    this.dbKey = dbKey;
    this.indexNames = new ObjectStoreNamesArray();
  }

  get data(): Map<any, any> {
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
    let id = key;
    if (!id) {
      if (this.autoIncrement) {
        id = Math.max(0, ...Array.from(this.data.keys()).filter(k => typeof k === 'number')) + 1;
      } else {
        id = value[this.keyPath];
      }
    }

    // Validar que el ID no existe
    if (this.data.has(id)) {
      return new MockIDBRequest(undefined, new Error('Key already exists'), this.transaction);
    }

    // Validar índices únicos
    for (const [indexName, index] of this.indexes) {
      if (index.unique) {
        const indexValue = Array.isArray(index.keyPath) 
          ? index.keyPath.map(path => value[path]).join('|')
          : value[index.keyPath as string];
        
        const existing = Array.from(this.data.values()).find(item => {
          const existingValue = Array.isArray(index.keyPath)
            ? index.keyPath.map(path => item[path]).join('|')
            : item[index.keyPath as string];
          return existingValue === indexValue;
        });

        if (existing) {
          return new MockIDBRequest(undefined, new Error(`Constraint error: Index ${indexName} unique constraint violated`), this.transaction);
        }
      }
    }

    // Asegurar que el objeto tenga el ID
    const finalValue = { ...value, [this.keyPath]: id };
    this.data.set(id, finalValue);
    return new MockIDBRequest(finalValue, undefined, this.transaction);
  }

  put(value: any, key?: any): MockIDBRequest {
    let id = key;
    if (!id) {
      if (this.autoIncrement && !value[this.keyPath]) {
        id = Math.max(0, ...Array.from(this.data.keys()).filter(k => typeof k === 'number')) + 1;
      } else {
        id = value[this.keyPath];
      }
    }

    const finalValue = { ...value, [this.keyPath]: id };
    this.data.set(id, finalValue);
    return new MockIDBRequest(finalValue, undefined, this.transaction);
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

  createIndex(name: string, keyPath: string | string[], options?: { unique?: boolean }): MockIDBIndex {
    const index = new MockIDBIndex(name, keyPath, options?.unique || false, this);
    this.indexes.set(name, index);
    this.indexNames.push(name);
    return index;
  }

  index(name: string): MockIDBIndex {
    const index = this.indexes.get(name);
    if (!index) {
      throw new Error(`Index '${name}' not found`);
    }
    return index;
  }
}

class MockIDBTransaction {
  objectStoreNames: string[];
  mode: string;
  db: MockIDBDatabase;
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
    this.db = db;
    
    // Para transacciones de upgrade con '*', no pre-poblar stores
    if (!(storeNames.length === 1 && storeNames[0] === '*')) {
      const dbKey = `${db.name}_v${db.version}`;
      storeNames.forEach(name => {
        if (db.stores.has(name)) {
          const store = db.stores.get(name)!;
          store.setTransaction(this);
          this.stores.set(name, store);
        } else {
          const newStore = new MockIDBObjectStore(name, { keyPath: 'id' }, dbKey);
          newStore.setTransaction(this);
          this.stores.set(name, newStore);
          db.stores.set(name, newStore);
        }
      });
    }
  }

  objectStore(name: string): MockIDBObjectStore {
    let store = this.stores.get(name);
    if (!store) {
      // Durante transacciones de upgrade, podríamos necesitar acceder a stores recién creados
      if (this.mode === 'versionchange') {
        const dbStore = this.db?.stores.get(name);
        if (dbStore) {
          dbStore.setTransaction(this);
          this.stores.set(name, dbStore);
          store = dbStore;
        }
      }
      if (!store) {
        throw new Error(`Object store '${name}' not found`);
      }
    }
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
  objectStoreNames: ObjectStoreNamesArray = new ObjectStoreNamesArray();
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
    console.log(`Object store ${name} created.`);
    return store;
  }

  deleteObjectStore(name: string): void {
    this.stores.delete(name);
    const index = this.objectStoreNames.indexOf(name);
    if (index > -1) {
      this.objectStoreNames.splice(index, 1);
    }
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

  constructor(name: string, version?: number) {
    const dbKey = `${name}_v${version || 1}`;
    let db = mockFactory.databases.get(dbKey);
    
    if (!db) {
      db = new MockIDBDatabase(name, version || 1);
      mockFactory.databases.set(dbKey, db);
    }
    
    super(db);

    setTimeout(() => {
      if (this.onupgradeneeded) {
        this.transaction = new MockIDBTransaction(['*'], 'versionchange', db);
        
        this.onupgradeneeded({
          target: this,
          oldVersion: 0,
          newVersion: version || 1,
          transaction: this.transaction
        });
      }
      
      setTimeout(() => {
        if (this.onsuccess) {
          this.onsuccess({ target: this });
        }
      }, 0);
    }, 0);
  }
}

const globalDatabaseStorage = new Map<string, Map<string, any>>();

class MockIDBFactory {
  databases: Map<string, MockIDBDatabase> = new Map();

  open(name: string, version?: number): MockIDBOpenDBRequest {
    const dbKey = `${name}_v${version || 1}`;
    if (!globalDatabaseStorage.has(dbKey)) {
      globalDatabaseStorage.set(dbKey, new Map());
    }
    return new MockIDBOpenDBRequest(name, version);
  }

  deleteDatabase(name: string): MockIDBRequest {
    // Limpiar todas las versiones de la base de datos
    for (const [key] of this.databases) {
      if (key.startsWith(`${name}_v`)) {
        this.databases.delete(key);
        globalDatabaseStorage.delete(key);
      }
    }
    return new MockIDBRequest(undefined);
  }

  getDatabases(): Promise<{ name: string; version: number }[]> {
    return Promise.resolve(
      Array.from(this.databases.entries()).map(([key, db]) => ({
        name: db.name,
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
  
  // Mock dinámico para las importaciones del emitter
  const originalImport = (globalThis as any).import;
  (globalThis as any).import = function(specifier: string) {
    if (specifier.includes('Emitter') || specifier.includes('emitter')) {
      return Promise.resolve({
        emitter: mockEmitterInstance,
        Emitter: MockEmitter,
        default: MockEmitter
      });
    }
    return originalImport ? originalImport(specifier) : Promise.resolve({});
  };

  // Mock también require para compatibilidad
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
afterEach(async () => {
  // Cierra todas las bases de datos abiertas para liberar bloqueos.
  // Esto es importante para que deleteDatabase funcione correctamente.
  const dbs = await mockFactory.getDatabases();
  for (const dbInfo of dbs) {
    // No hay un método "closeAll" en el mock, pero la eliminación es la forma más segura de limpiar.
    await new Promise(resolve => {
        const req = mockFactory.deleteDatabase(dbInfo.name);
        req.onsuccess = resolve;
        req.onerror = resolve; // Continuar incluso si hay un error
    });
  }

  // Limpia el almacenamiento de datos global.
  globalDatabaseStorage.clear();

  // Limpia el registro de bases de datos en la factory.
  // Esto asegura que el siguiente test empiece con una factory "virgen".
  mockFactory.databases.clear();
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

export { 
  MockIDBFactory, 
  MockIDBRequest, 
  MockIDBObjectStore, 
  MockIDBTransaction, 
  MockIDBDatabase, 
  MockIDBOpenDBRequest,
  MockEmitter,
  mockFactory
};