import * as fs from 'fs';
import * as path from 'path';
import type { StorageAdapter, StoreInfo, BatchItem, DatabaseInfo } from './types.js';

interface NodeDBStore {
  name: string;
  keyPath: string;
  autoIncrement: boolean;
  data: Map<any, any>;
  indexes: Map<string, any>;
}

interface NodeDatabase {
  name: string;
  version: number;
  stores: Map<string, NodeDBStore>;
  filePath: string;
}

export class NodeAdapter implements StorageAdapter {
  private databases: Map<string, NodeDatabase> = new Map();
  private dbPath: string;
  private inMemoryMode: boolean;
  private upgradeHandlers: Map<string, any> = new Map();

  constructor(dbPath: string = './data', options?: { inMemory?: boolean }) {
    this.dbPath = dbPath;
    this.inMemoryMode = options?.inMemory || false;
    
    if (!this.inMemoryMode && !fs.existsSync(this.dbPath)) {
      fs.mkdirSync(this.dbPath, { recursive: true });
    }
  }

  async openDatabase(name: string, version: number): Promise<NodeDatabase> {
    const filePath = path.join(this.dbPath, `${name}.json`);
    
    if (this.databases.has(name)) {
      const db = this.databases.get(name)!;
      return db;
    }

    let db: NodeDatabase;

    if (!this.inMemoryMode && fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      db = {
        name,
        version: data.version || version,
        stores: new Map(),
        filePath
      };

      for (const [storeName, storeData] of Object.entries(data.stores || {})) {
        const store = storeData as any;
        db.stores.set(storeName, {
          name: storeName,
          keyPath: store.keyPath || 'id',
          autoIncrement: store.autoIncrement || false,
          data: new Map(Object.entries(store.data || {})),
          indexes: new Map()
        });
      }
    } else {
      db = {
        name,
        version,
        stores: new Map(),
        filePath
      };
    }

    // Call upgrade handler if exists
    const handler = this.upgradeHandlers.get(name);
    if (handler) {
      // Note: In Node.js there's no real upgrade event, but we call the handler
      // to allow for custom initialization
      handler({ oldVersion: 0, newVersion: version });
    }

    this.databases.set(name, db);
    return db;
  }

  onUpgrade(name: string, handler: any): void {
    this.upgradeHandlers.set(name, handler);
  }

  transaction(storeName: string, mode: 'readonly' | 'readwrite'): any {
    return { storeName, mode };
  }

  createObjectStore(db: NodeDatabase, name: string, options: any): NodeDBStore {
    if (db.stores.has(name)) {
      return db.stores.get(name)!;
    }

    const store: NodeDBStore = {
      name,
      keyPath: options?.keyPath || 'id',
      autoIncrement: options?.autoIncrement || false,
      data: new Map(),
      indexes: new Map()
    };
    
    db.stores.set(name, store);
    if (!this.inMemoryMode) {
      this.saveDatabase(db);
    }
    return store;
  }

  createIndex(_db: any, storeName: string, indexName: string, keyPath: any, _options?: any): any {
    // Indexes are stored in memory only for Node adapter
    const db = this.databases.get(storeName) || _db;
    if (db && db.stores) {
      const store = db.stores.get(storeName);
      if (store) {
        store.indexes.set(indexName, { keyPath });
      }
    }
    return { name: indexName, keyPath };
  }

  deleteIndex(_db: any, storeName: string, indexName: string): void {
    const db = this.databases.get(storeName) || _db;
    if (db && db.stores) {
      const store = db.stores.get(storeName);
      if (store) {
        store.indexes.delete(indexName);
      }
    }
  }

  getObjectStoreNames(db: any): string[] {
    return Array.from(db.stores.keys());
  }

  async get(storeInfo: StoreInfo, key: any): Promise<any> {
    const store = storeInfo.db.stores.get(storeInfo.storeName);
    if (!store) return null;
    
    const keyStr = String(key);
    return store.data.get(keyStr) || null;
  }

  async getMany(storeInfo: StoreInfo, keys: any[]): Promise<any[]> {
    const store = storeInfo.db.stores.get(storeInfo.storeName);
    if (!store) return keys.map(() => null);
    
    return keys.map(key => {
      const keyStr = String(key);
      return store.data.get(keyStr) || null;
    });
  }

  async put(storeInfo: StoreInfo, value: any, key?: any): Promise<any> {
    const store = storeInfo.db.stores.get(storeInfo.storeName);
    if (!store) throw new Error(`Store ${storeInfo.storeName} not found`);
    
    const effectiveKey = key ?? value[store.keyPath];
    const keyStr = String(effectiveKey);
    store.data.set(keyStr, value);
    
    if (!this.inMemoryMode) {
      this.saveDatabase(storeInfo.db);
    }
    return effectiveKey;
  }

  async putMany(storeInfo: StoreInfo, items: BatchItem[]): Promise<any[]> {
    const store = storeInfo.db.stores.get(storeInfo.storeName);
    if (!store) throw new Error(`Store ${storeInfo.storeName} not found`);
    
    const keys: any[] = [];
    for (const item of items) {
      const effectiveKey = item.key ?? item.value[store.keyPath];
      const keyStr = String(effectiveKey);
      store.data.set(keyStr, item.value);
      keys.push(effectiveKey);
    }
    
    if (!this.inMemoryMode) {
      this.saveDatabase(storeInfo.db);
    }
    return keys;
  }

  async add(storeInfo: StoreInfo, value: any, key?: any): Promise<any> {
    const store = storeInfo.db.stores.get(storeInfo.storeName);
    if (!store) throw new Error(`Store ${storeInfo.storeName} not found`);
    
    const effectiveKey = key ?? value[store.keyPath];
    const keyStr = String(effectiveKey);
    
    if (store.data.has(keyStr)) {
      throw new Error(`Key ${effectiveKey} already exists`);
    }
    
    store.data.set(keyStr, value);
    
    if (!this.inMemoryMode) {
      this.saveDatabase(storeInfo.db);
    }
    return effectiveKey;
  }

  async delete(storeInfo: StoreInfo, key: any): Promise<any> {
    const store = storeInfo.db.stores.get(storeInfo.storeName);
    if (!store) throw new Error(`Store ${storeInfo.storeName} not found`);
    
    const keyStr = String(key);
    store.data.delete(keyStr);
    
    if (!this.inMemoryMode) {
      this.saveDatabase(storeInfo.db);
    }
    return key;
  }

  async deleteMany(storeInfo: StoreInfo, keys: any[]): Promise<void> {
    const store = storeInfo.db.stores.get(storeInfo.storeName);
    if (!store) throw new Error(`Store ${storeInfo.storeName} not found`);
    
    for (const key of keys) {
      const keyStr = String(key);
      store.data.delete(keyStr);
    }
    
    if (!this.inMemoryMode) {
      this.saveDatabase(storeInfo.db);
    }
  }

  async getAll(storeInfo: StoreInfo): Promise<any[]> {
    const store = storeInfo.db.stores.get(storeInfo.storeName);
    if (!store) return [];
    return Array.from(store.data.values());
  }

  async getAllFromIndex(storeInfo: StoreInfo, _indexName: string, _query?: any): Promise<any[]> {
    const store = storeInfo.db.stores.get(storeInfo.storeName);
    if (!store) return [];
    
    // For Node adapter, we return all values if index doesn't exist in memory
    return Array.from(store.data.values());
  }

  async clear(storeInfo: StoreInfo): Promise<void> {
    const store = storeInfo.db.stores.get(storeInfo.storeName);
    if (!store) throw new Error(`Store ${storeInfo.storeName} not found`);
    
    store.data.clear();
    
    if (!this.inMemoryMode) {
      this.saveDatabase(storeInfo.db);
    }
  }

  async count(storeInfo: StoreInfo, _query?: any): Promise<number> {
    const store = storeInfo.db.stores.get(storeInfo.storeName);
    if (!store) return 0;
    return store.data.size;
  }

  async iterate(_storeInfo: StoreInfo, callback: any, _options?: any): Promise<void> {
    const store = _storeInfo.db.stores.get(_storeInfo.storeName);
    if (!store) return;
    
    for (const value of store.data.values()) {
      const result = callback(value, null);
      if (result === false) break;
    }
  }

  async searchByIndex(storeInfo: StoreInfo, _indexName: string, _query: any, _limit?: number): Promise<any[]> {
    return this.getAll(storeInfo);
  }

  close(db: NodeDatabase): void {
    if (!this.inMemoryMode) {
      this.saveDatabase(db);
      this.databases.delete(db.name);
    }
  }

  async deleteDatabase(name: string): Promise<void> {
    const filePath = path.join(this.dbPath, `${name}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    this.databases.delete(name);
  }

  async clearAll(): Promise<void> {
    for (const [name, db] of this.databases.entries()) {
      for (const store of db.stores.values()) {
        store.data.clear();
      }
      if (!this.inMemoryMode) {
        const filePath = path.join(this.dbPath, `${name}.json`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }
    this.databases.clear();
  }

  async getDatabaseNames(): Promise<string[]> {
    if (!fs.existsSync(this.dbPath)) return [];
    
    const files = fs.readdirSync(this.dbPath);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  }

  async getDatabaseInfo(): Promise<DatabaseInfo[]> {
    const names = await this.getDatabaseNames();
    return names.map(name => {
      const filePath = path.join(this.dbPath, `${name}.json`);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return { name, version: data.version || 1 };
      }
      return { name, version: 1 };
    });
  }

  async databaseExists(name: string): Promise<boolean> {
    const names = await this.getDatabaseNames();
    return names.includes(name);
  }

  private saveDatabase(db: NodeDatabase): void {
    const data = {
      name: db.name,
      version: db.version,
      stores: {} as any
    };

    for (const [storeName, store] of db.stores.entries()) {
      data.stores[storeName] = {
        name: store.name,
        keyPath: store.keyPath,
        autoIncrement: store.autoIncrement,
        data: Object.fromEntries(store.data.entries())
      };
    }

    fs.writeFileSync(db.filePath, JSON.stringify(data, null, 2));
  }
}
