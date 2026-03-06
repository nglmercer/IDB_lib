// Memory Adapter - In-memory storage for all environments (browser, node, testing)
// This adapter stores data in memory without persistence

import type { StorageAdapter, StoreInfo, BatchItem, DatabaseInfo, CursorOptions } from './types.js';

interface MemoryIndex {
  name: string;
  keyPath: string | string[];
  unique: boolean;
  data: Map<any, any[]>;
}

interface MemoryStore {
  name: string;
  keyPath: string;
  autoIncrement: boolean;
  data: Map<any, any>;
  indexes: Map<string, MemoryIndex>;
  autoIncrementCounter: number;
}

interface MemoryDatabase {
  name: string;
  version: number;
  stores: Map<string, MemoryStore>;
}

export class MemoryAdapter implements StorageAdapter {
  private databases: Map<string, MemoryDatabase> = new Map();
  private upgradeHandlers: Map<string, any> = new Map();

  async openDatabase(name: string, version: number): Promise<MemoryDatabase> {
    if (this.databases.has(name)) {
      return this.databases.get(name)!;
    }

    const db: MemoryDatabase = {
      name,
      version,
      stores: new Map()
    };

    this.databases.set(name, db);

    // Call upgrade handler
    const handler = this.upgradeHandlers.get(name);
    if (handler) {
      handler({ oldVersion: 0, newVersion: version });
    }

    return db;
  }

  close(_db: any): void {
    // In-memory database doesn't need closing
  }

  async deleteDatabase(_name: string): Promise<void> {
    // In-memory: no actual deletion needed, database stays in memory
  }

  transaction(storeName: string, mode: 'readonly' | 'readwrite'): any {
    // Return a mock transaction object
    return {
      objectStore: (_name: string) => {
        return {
          name: storeName,
          transaction: this,
          mode
        };
      }
    };
  }

  createObjectStore(db: any, name: string, options?: { keyPath?: string; autoIncrement?: boolean }): any {
    const database = db as MemoryDatabase;
    
    const store: MemoryStore = {
      name,
      keyPath: options?.keyPath || 'id',
      autoIncrement: options?.autoIncrement || false,
      data: new Map(),
      indexes: new Map(),
      autoIncrementCounter: 0
    };

    database.stores.set(name, store);
    return store;
  }

  async get(store: StoreInfo, key: any): Promise<any> {
    const db = this.databases.get(store.db.name);
    if (!db) return undefined;

    const storeData = db.stores.get(store.storeName);
    if (!storeData) return undefined;

    return storeData.data.get(key) || null;
  }

  async put(store: StoreInfo, value: any, key?: any): Promise<any> {
    const db = this.databases.get(store.db.name);
    if (!db) throw new Error('Database not found');

    const storeData = db.stores.get(store.storeName);
    if (!storeData) throw new Error('Store not found');

    let finalKey = key;

    if (storeData.autoIncrement && !finalKey) {
      finalKey = ++storeData.autoIncrementCounter;
      value = { ...value, [storeData.keyPath]: finalKey };
    } else if (!finalKey) {
      finalKey = value[storeData.keyPath];
    }

    storeData.data.set(finalKey, value);

    // Update indexes
    this.updateIndexes(storeData, value, finalKey);

    return value;
  }

  async add(store: StoreInfo, value: any, key?: any): Promise<any> {
    return this.put(store, value, key);
  }

  async delete(store: StoreInfo, key: any): Promise<void> {
    const db = this.databases.get(store.db.name);
    if (!db) return;

    const storeData = db.stores.get(store.storeName);
    if (!storeData) return;

    storeData.data.delete(key);

    // Update indexes
    this.deleteFromIndexes(storeData, key);
  }

  async getAll(store: StoreInfo): Promise<any[]> {
    const db = this.databases.get(store.db.name);
    if (!db) return [];

    const storeData = db.stores.get(store.storeName);
    if (!storeData) return [];

    return Array.from(storeData.data.values());
  }

  async putMany(store: StoreInfo, items: BatchItem[]): Promise<any[]> {
    const results: any[] = [];
    
    for (const item of items) {
      const result = await this.put(store, item.value, item.key);
      results.push(result);
    }

    return results;
  }

  async deleteMany(store: StoreInfo, keys: any[]): Promise<void> {
    for (const key of keys) {
      await this.delete(store, key);
    }
  }

  async getMany(store: StoreInfo, keys: any[]): Promise<any[]> {
    const results: any[] = [];
    
    for (const key of keys) {
      const item = await this.get(store, key);
      if (item) {
        results.push(item);
      }
    }

    return results;
  }

  async clear(store: StoreInfo): Promise<void> {
    const db = this.databases.get(store.db.name);
    if (!db) return;

    const storeData = db.stores.get(store.storeName);
    if (!storeData) return;

    storeData.data.clear();
    storeData.autoIncrementCounter = 0;

    // Clear indexes
    for (const index of storeData.indexes.values()) {
      index.data.clear();
    }
  }

  async count(store: StoreInfo, query?: any): Promise<number> {
    const db = this.databases.get(store.db.name);
    if (!db) return 0;

    const storeData = db.stores.get(store.storeName);
    if (!storeData) return 0;

    if (query === undefined) {
      return storeData.data.size;
    }

    // Count with query
    let count = 0;
    for (const value of storeData.data.values()) {
      if (this.matchesQuery(value, query)) {
        count++;
      }
    }
    return count;
  }

  createIndex(db: any, storeName: string, indexName: string, keyPath: any, options?: any): any {
    const database = db as MemoryDatabase;
    const store = database.stores.get(storeName);
    
    if (!store) throw new Error('Store not found');

    const index: MemoryIndex = {
      name: indexName,
      keyPath,
      unique: options?.unique || false,
      data: new Map()
    };

    store.indexes.set(indexName, index);

    // Rebuild index with existing data
    for (const [key, value] of store.data.entries()) {
      this.addToIndex(store, index, value, key);
    }

    return index;
  }

  deleteIndex(db: any, storeName: string, indexName: string): void {
    const database = db as MemoryDatabase;
    const store = database.stores.get(storeName);
    
    if (store) {
      store.indexes.delete(indexName);
    }
  }

  async getAllFromIndex(store: StoreInfo, indexName: string, query?: any): Promise<any[]> {
    const db = this.databases.get(store.db.name);
    if (!db) return [];

    const storeData = db.stores.get(store.storeName);
    if (!storeData) return [];

    const index = storeData.indexes.get(indexName);
    if (!index) return [];

    if (query === undefined) {
      const results: any[] = [];
      for (const values of index.data.values()) {
        results.push(...values);
      }
      return results;
    }

    const values = index.data.get(query);
    return values ? [...values] : [];
  }

  async iterate(store: StoreInfo, callback: any, options?: CursorOptions): Promise<void> {
    const allData = await this.getAll(store);
    
    let result = allData;
    
    if (options?.offset) {
      result = result.slice(options.offset);
    }
    
    if (options?.limit) {
      result = result.slice(0, options.limit);
    }

    for (const item of result) {
      await callback(item);
    }
  }

  async searchByIndex(store: StoreInfo, indexName: string, query: any, limit?: number): Promise<any[]> {
    const results = await this.getAllFromIndex(store, indexName, query);
    
    if (limit) {
      return results.slice(0, limit);
    }
    
    return results;
  }

  async getDatabaseNames(): Promise<string[]> {
    return Array.from(this.databases.keys());
  }

  async getDatabaseInfo(): Promise<DatabaseInfo[]> {
    const infos: DatabaseInfo[] = [];
    
    for (const [name, db] of this.databases.entries()) {
      infos.push({
        name,
        version: db.version
      });
    }
    
    return infos;
  }

  async databaseExists(name: string): Promise<boolean> {
    return this.databases.has(name);
  }

  async clearAll(): Promise<void> {
    this.databases.clear();
  }

  onUpgrade(name: string, handler: any): void {
    this.upgradeHandlers.set(name, handler);
  }

  getObjectStoreNames(db: any): string[] {
    const database = db as MemoryDatabase;
    return database ? Array.from(database.stores.keys()) : [];
  }

  // Helper methods
  private matchesQuery(value: any, query: any): boolean {
    if (typeof query === 'object' && query !== null) {
      return Object.entries(query).every(([key, val]) => {
        return value[key] === val;
      });
    }
    return false;
  }

  private updateIndexes(store: MemoryStore, value: any, key: any): void {
    for (const index of store.indexes.values()) {
      this.addToIndex(store, index, value, key);
    }
  }

  private addToIndex(_store: MemoryStore, index: MemoryIndex, value: any, _key: any): void {
    const indexKey = Array.isArray(index.keyPath) 
      ? index.keyPath.map(k => value[k]).join('_')
      : value[index.keyPath];

    if (indexKey === undefined) return;

    if (!index.data.has(indexKey)) {
      index.data.set(indexKey, []);
    }

    const existing = index.data.get(indexKey)!;
    const existingIndex = existing.findIndex(v => v[index.keyPath as string] === value[index.keyPath as string]);
    
    if (existingIndex >= 0) {
      existing[existingIndex] = value;
    } else {
      existing.push(value);
    }
  }

  private deleteFromIndexes(store: MemoryStore, key: any): void {
    const value = store.data.get(key);
    if (!value) return;

    for (const index of store.indexes.values()) {
      const indexKey = Array.isArray(index.keyPath) 
        ? index.keyPath.map(k => value[k]).join('_')
        : value[index.keyPath];

      if (indexKey !== undefined) {
        const existing = index.data.get(indexKey);
        if (existing) {
          const filtered = existing.filter(v => v[index.keyPath as string] !== value[index.keyPath as string]);
          if (filtered.length === 0) {
            index.data.delete(indexKey);
          } else {
            index.data.set(indexKey, filtered);
          }
        }
      }
    }
  }
}

export default MemoryAdapter;
