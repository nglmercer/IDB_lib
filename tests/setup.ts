import { beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';

// Mock IndexedDB para el entorno de testing
class MockIDBRequest {
  result: any;
  error: any;
  onsuccess: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  readyState: string = 'pending';

  constructor(result?: any) {
    this.result = result;
    // Simular operación asíncrona
    setTimeout(() => {
      this.readyState = 'done';
      if (this.onsuccess) {
        this.onsuccess({ target: this });
      }
    }, 0);
  }
}

class MockIDBObjectStore {
  name: string;
  keyPath: string;
  data: Map<any, any> = new Map();

  constructor(name: string, keyPath: string = 'id') {
    this.name = name;
    this.keyPath = keyPath;
  }

  add(value: any, key?: any): MockIDBRequest {
    const id = key || value[this.keyPath];
    if (this.data.has(id)) {
      const request = new MockIDBRequest();
      request.error = new Error('Key already exists');
      setTimeout(() => {
        if (request.onerror) {
          request.onerror({ target: request });
        }
      }, 0);
      return request;
    }
    this.data.set(id, value);
    return new MockIDBRequest(value);
  }

  put(value: any, key?: any): MockIDBRequest {
    const id = key || value[this.keyPath];
    this.data.set(id, value);
    return new MockIDBRequest(value);
  }

  get(key: any): MockIDBRequest {
    return new MockIDBRequest(this.data.get(key));
  }

  delete(key: any): MockIDBRequest {
    const existed = this.data.has(key);
    this.data.delete(key);
    return new MockIDBRequest(existed);
  }

  getAll(): MockIDBRequest {
    return new MockIDBRequest(Array.from(this.data.values()));
  }

  clear(): MockIDBRequest {
    this.data.clear();
    return new MockIDBRequest(undefined);
  }

  count(): MockIDBRequest {
    return new MockIDBRequest(this.data.size);
  }
}

class MockIDBTransaction {
  objectStoreNames: string[];
  mode: string;
  stores: Map<string, MockIDBObjectStore> = new Map();
  oncomplete: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onabort: ((event: any) => void) | null = null;

  constructor(storeNames: string[], mode: string, db: MockIDBDatabase) {
    this.objectStoreNames = storeNames;
    this.mode = mode;
    
    // Crear stores para esta transacción
    storeNames.forEach(name => {
      if (db.stores.has(name)) {
        this.stores.set(name, db.stores.get(name)!);
      }
    });

    // Simular completado de transacción
    setTimeout(() => {
      if (this.oncomplete) {
        this.oncomplete({ target: this });
      }
    }, 0);
  }

  objectStore(name: string): MockIDBObjectStore {
    const store = this.stores.get(name);
    if (!store) {
      throw new Error(`Object store '${name}' not found`);
    }
    return store;
  }

  abort(): void {
    if (this.onabort) {
      this.onabort({ target: this });
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
    const store = new MockIDBObjectStore(name, options?.keyPath || 'id');
    this.stores.set(name, store);
    this.objectStoreNames.push(name);
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

  constructor(name: string, version?: number) {
    const db = new MockIDBDatabase(name, version || 1);
    super(db);

    // Simular upgrade si es necesario
    setTimeout(() => {
      if (this.onupgradeneeded) {
        this.onupgradeneeded({
          target: this,
          oldVersion: 0,
          newVersion: version || 1
        });
      }
    }, 0);
  }
}

class MockIDBFactory {
  databases: Map<string, MockIDBDatabase> = new Map();

  open(name: string, version?: number): MockIDBOpenDBRequest {
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

// Configurar mocks globales
beforeAll(() => {
  // Mock IndexedDB
  (globalThis as any).indexedDB = new MockIDBFactory();
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