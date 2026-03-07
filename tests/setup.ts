import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from 'bun:test';
let globalTestId = 0;

beforeEach(() => {
  // Each test gets a unique, guaranteed-different ID
  globalTestId++;
});

function getNamespace(): string {
  return `p${process.pid}_t${globalTestId}`;
}

const databasesMap = new Map<string, MockIDBDatabase>();
const globalDatabaseStorage = new Map<string, Map<any, any>>();

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
  source?: any;

  constructor(result?: any, error?: any, transaction?: MockIDBTransaction) {
    this.transaction = transaction;
    const hasResult = arguments.length > 0;
    if (hasResult) this.result = result;
    
    // Open requests handle their own timing
    if (this.constructor.name !== 'MockIDBOpenDBRequest') {
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
}

class MockIDBKeyRange {
  lower: any;
  upper: any;
  lowerOpen: boolean;
  upperOpen: boolean;

  constructor(lower?: any, upper?: any, lowerOpen?: boolean, upperOpen?: boolean) {
    this.lower = lower;
    this.upper = upper;
    this.lowerOpen = lowerOpen || false;
    this.upperOpen = upperOpen || false;
  }

  static lowerBound(lower: any, open?: boolean): MockIDBKeyRange {
    return new MockIDBKeyRange(lower, undefined, open, false);
  }

  static upperBound(upper: any, open?: boolean): MockIDBKeyRange {
    return new MockIDBKeyRange(undefined, upper, false, open);
  }

  static bound(lower: any, upper: any, lowerOpen?: boolean, upperOpen?: boolean): MockIDBKeyRange {
    return new MockIDBKeyRange(lower, upper, lowerOpen, upperOpen);
  }

  static only(value: any): MockIDBKeyRange {
    return new MockIDBKeyRange(value, value, false, false);
  }

  contains(key: any): boolean {
    if (this.lower !== undefined) {
      const lowerComparison = this.lowerOpen ? key > this.lower : key >= this.lower;
      if (!lowerComparison) return false;
    }
    if (this.upper !== undefined) {
      const upperComparison = this.upperOpen ? key < this.upper : key <= this.upper;
      if (!upperComparison) return false;
    }
    return true;
  }
}

class MockIDBCursor {
  request: MockIDBRequest;
  data: any[];
  index: number = 0;
  direction: string;
  keyPath: string | string[];
  source: any;
  value: any = null;
  key: any = null;
  primaryKey: any = null;

  constructor(request: MockIDBRequest, data: any[], direction: string = 'next', keyPath: string | string[], source: any) {
    this.request = request;
    this.data = data;
    this.direction = direction;
    this.keyPath = keyPath;
    this.source = source;
    this._update();
  }

  _update() {
    if (this.index < this.data.length) {
      const item = this.data[this.index];
      this.value = item;
      this.primaryKey = item[this.source.objectStore?.keyPath || this.source.keyPath || 'id'];
      
      if (Array.isArray(this.keyPath)) {
        this.key = this.keyPath.map(p => item[p]).join('|');
      } else {
        this.key = item[this.keyPath as string];
      }
    } else {
      this.value = null;
      this.key = null;
      this.primaryKey = null;
    }
  }

  continue() {
    this.index++;
    setTimeout(() => {
      if (this.index < this.data.length) {
        this._update();
        this.request.result = this;
      } else {
        this.request.result = null;
      }
      if (this.request.onsuccess) {
        this.request.onsuccess({ target: this.request });
      }
    }, 0);
  }

  continuePrimaryKey() {}
  advance() {}
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

  getAll(query?: any): MockIDBRequest {
    let allData = Array.from(this.objectStore.data.values());
    
    // Filter by query if provided
    if (query !== undefined) {
      allData = allData.filter(item => {
        const indexValue = Array.isArray(this.keyPath) 
          ? this.keyPath.map(path => item[path]).join('|')
          : item[this.keyPath as string];
        return indexValue === query;
      });
    }
    
    return new MockIDBRequest(allData, undefined, this.objectStore.transaction);
  }

  count(query?: any): MockIDBRequest {
    let allData = Array.from(this.objectStore.data.values());
    
    // Filter by query if provided
    if (query !== undefined) {
      allData = allData.filter(item => {
        const indexValue = Array.isArray(this.keyPath) 
          ? this.keyPath.map(path => item[path]).join('|')
          : item[this.keyPath as string];
        return indexValue === query;
      });
    }
    
    return new MockIDBRequest(allData.length, undefined, this.objectStore.transaction);
  }

  openCursor(query?: any, direction?: string): MockIDBRequest {
    let cursorData = Array.from(this.objectStore.data.values());
    
    // Sort by index key path
    cursorData.sort((a, b) => {
      const valA = Array.isArray(this.keyPath) ? this.keyPath.map(p => a[p]).join('|') : a[this.keyPath as string];
      const valB = Array.isArray(this.keyPath) ? this.keyPath.map(p => b[p]).join('|') : b[this.keyPath as string];
      if (valA < valB) return direction?.startsWith('prev') ? 1 : -1;
      if (valA > valB) return direction?.startsWith('prev') ? -1 : 1;
      return 0;
    });

    // Filter by query if provided
    if (query !== undefined) {
      if (query instanceof MockIDBKeyRange) {
        cursorData = cursorData.filter(item => {
          const indexValue = Array.isArray(this.keyPath) 
            ? this.keyPath.map(path => item[path]).join('|')
            : item[this.keyPath as string];
          return query.contains(indexValue);
        });
      } else {
        cursorData = cursorData.filter(item => {
          const indexValue = Array.isArray(this.keyPath) 
            ? this.keyPath.map(path => item[path]).join('|')
            : item[this.keyPath as string];
          return indexValue === query;
        });
      }
    }
    
    if (cursorData.length === 0) {
      return new MockIDBRequest(null, undefined, this.objectStore.transaction);
    }

    const cursor = new MockIDBCursor(null as any, cursorData, direction || 'next', this.keyPath, this);
    const request = new MockIDBRequest(cursor, undefined, this.objectStore.transaction);
    cursor.request = request;
    return request;
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
  private nextId: number = 1;

  constructor(name: string, options: { keyPath?: string; autoIncrement?: boolean } = {}, dbKey: string = 'default') {
    this.name = name;
    this.keyPath = options.keyPath || 'id';
    this.autoIncrement = options.autoIncrement || false;
    this.dbKey = dbKey; // Already includes isolation prefix from DB or Factory
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
      if (value[this.keyPath]) {
        id = value[this.keyPath];
      } else {
        // Use the nextId counter to ensure unique IDs
        id = this.nextId++;
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
    this.data.delete(key);
    return new MockIDBRequest(undefined, undefined, this.transaction);
  }

  getAll(): MockIDBRequest {
    return new MockIDBRequest(Array.from(this.data.values()), undefined, this.transaction);
  }

  clear(): MockIDBRequest {
    this.data.clear();
    return new MockIDBRequest(undefined, undefined, this.transaction);
  }

  count(query?: any): MockIDBRequest {
    let count = this.data.size;
    
    // If query is provided, count only matching keys
    if (query !== undefined) {
      const allKeys = Array.from(this.data.keys());
      count = allKeys.filter(key => {
        if (query instanceof MockIDBKeyRange) {
          return query.contains(key);
        }
        return key === query;
      }).length;
    }
    
    return new MockIDBRequest(count, undefined, this.transaction);
  }

  openCursor(query?: any, direction?: string): MockIDBRequest {
    let cursorData = Array.from(this.data.values());
    
    // Sort by keyPath
    cursorData.sort((a, b) => {
      const valA = a[this.keyPath];
      const valB = b[this.keyPath];
      if (valA < valB) return direction?.startsWith('prev') ? 1 : -1;
      if (valA > valB) return direction?.startsWith('prev') ? -1 : 1;
      return 0;
    });

    // Filter by query if provided
    if (query !== undefined) {
      if (query instanceof MockIDBKeyRange) {
        cursorData = cursorData.filter(item => query.contains(item[this.keyPath]));
      } else {
        cursorData = cursorData.filter(item => item[this.keyPath] === query);
      }
    }
    
    if (cursorData.length === 0) {
      return new MockIDBRequest(null, undefined, this.transaction);
    }

    const cursor = new MockIDBCursor(null as any, cursorData, direction || 'next', this.keyPath, this);
    const request = new MockIDBRequest(cursor, undefined, this.transaction);
    cursor.request = request;
    return request;
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

  deleteIndex(name: string): void {
    this.indexes.delete(name);
    const indexIndex = this.indexNames.indexOf(name);
    if (indexIndex > -1) {
      this.indexNames.splice(indexIndex, 1);
    }
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
      const dbKey = `${db.fullName}_v${db.version}`;
      storeNames.forEach(name => {
        if (db.stores.has(name)) {
          const store = db.stores.get(name)!;
          store.setTransaction(this);
          this.stores.set(name, store);
        } else {
          const newStore = new MockIDBObjectStore(name, { keyPath: 'id' }, `${dbKey}_${name}`);
          newStore.setTransaction(this);
          this.stores.set(name, newStore);
          db.stores.set(name, newStore);
          if (!db.objectStoreNames.contains(name)) {
            db.objectStoreNames.push(name);
          }
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
  fullName: string;
  version: number;
  objectStoreNames: ObjectStoreNamesArray = new ObjectStoreNamesArray();
  stores: Map<string, MockIDBObjectStore> = new Map();
  onversionchange: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;

  constructor(name: string, version: number) {
    this.fullName = name;
    this.version = version;
  }

  get name(): string {
    // fullName format: {namespace}_{dbname}_v{version}
    // e.g., p12345_t1_TestDB_v1
    // We need to extract 'TestDB' from this format
    const versionIndex = this.fullName.lastIndexOf('_v');
    if (versionIndex > 0) {
      // Find the position after the namespace (format: p{pid}_t{testId}_)
      // The namespace always contains 't' followed by digits for testId
      const namespaceEndMatch = this.fullName.match(/t\d+_/);
      if (namespaceEndMatch) {
        const namespaceEndIndex = this.fullName.indexOf(namespaceEndMatch[0]) + namespaceEndMatch[0].length;
        return this.fullName.substring(namespaceEndIndex, versionIndex);
      }
    }
    return this.fullName;
  }

  createObjectStore(name: string, options?: { keyPath?: string; autoIncrement?: boolean }): MockIDBObjectStore {
    const dbKey = `${this.fullName}_v${this.version}_${name}`;
    const store = new MockIDBObjectStore(name, options, dbKey);
    this.stores.set(name, store);
    if (!this.objectStoreNames.contains(name)) {
      this.objectStoreNames.push(name);
    }
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
    const ns = getNamespace();
    const dbKey = `${ns}_${name}_v${version || 1}`;
    
    // Always create a fresh database for each test to ensure clean state
    // First, clear any existing data for this key
    const storageKeyPrefix = `${dbKey}_`;
    for (const key of Array.from(globalDatabaseStorage.keys())) {
      if (key.startsWith(storageKeyPrefix)) {
        globalDatabaseStorage.delete(key);
      }
    }
    databasesMap.delete(dbKey);
    
    // Create new database
    const db = new MockIDBDatabase(`${ns}_${name}_v${version || 1}`, version || 1);
    databasesMap.set(dbKey, db);
    
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

class MockIDBFactory {
  get databasesMap() { return databasesMap; }

  private _getNsDbKey(name: string, version?: number): string {
    const ns = getNamespace();
    return `${ns}_${name}_v${version || 1}`;
  }

  open(name: string, version?: number): MockIDBOpenDBRequest {
    const ns = getNamespace();
    const dbKey = `${ns}_${name}_v${version || 1}`;
    if (!globalDatabaseStorage.has(dbKey)) {
      globalDatabaseStorage.set(dbKey, new Map());
    }
    return new MockIDBOpenDBRequest(name, version);
  }

  deleteDatabase(name: string): MockIDBRequest {
    const ns = getNamespace();
    const prefix = `${ns}_${name}_v`;
    
    // Clear databasesMap entries
    for (const key of Array.from(databasesMap.keys())) {
      if (key.startsWith(prefix)) databasesMap.delete(key);
    }
    // Clear globalDatabaseStorage entries
    for (const key of Array.from(globalDatabaseStorage.keys())) {
      if (key.startsWith(prefix)) globalDatabaseStorage.delete(key);
    }
    return new MockIDBRequest(undefined);
  }

  getDatabases(): Promise<{ name: string; version: number }[]> {
    const ns = getNamespace();
    const prefix = `${ns}_`;
    return Promise.resolve(
      Array.from(databasesMap.values())
        .filter(db => db.fullName.startsWith(prefix))
        .map(db => ({
          name: db.name,
          version: db.version
        }))
    );
  }

  databases(): Promise<{ name?: string; version?: number }[]> {
    const ns = getNamespace();
    const prefix = `${ns}_`;
    return Promise.resolve(
      Array.from(databasesMap.values())
        .filter(db => db.fullName.startsWith(prefix))
        .map(db => ({
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
  (globalThis as any).IDBKeyRange = MockIDBKeyRange;
  (globalThis as any).IDBIndex = MockIDBIndex;
  (globalThis as any).IDBCursor = MockIDBCursor;
  (globalThis as any).IDBCursorWithValue = MockIDBCursor;

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

// Reset global state before ALL tests
beforeAll(() => {
  // Reset globalTestId to ensure consistent namespace across test runs
  globalTestId = 0;
});

// Limpiar después de cada test
afterEach(async () => {
  // Small delay to ensure async operations complete
  await new Promise(resolve => setTimeout(resolve, 0));
  
  // Get all keys from both maps
  const allDbKeys = Array.from(databasesMap.keys());
  const allStorageKeys = Array.from(globalDatabaseStorage.keys());
  
  // Clear ALL databases and storage - more aggressive cleanup
  // This ensures no data leaks between tests
  allDbKeys.forEach(key => databasesMap.delete(key));
  allStorageKeys.forEach(key => globalDatabaseStorage.delete(key));
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
  MockIDBKeyRange,
  MockIDBIndex,
  MockEmitter,
  mockFactory
};
