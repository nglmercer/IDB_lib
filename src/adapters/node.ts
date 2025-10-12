import * as fs from 'fs';
import * as path from 'path';
import type { StorageAdapter } from './types.js';

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
      for (const [storeName, store] of db.stores.entries()) {
        store.data.clear();
      }
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

    this.databases.set(name, db);
    return db;
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
      keyPath: options.keyPath || 'id',
      autoIncrement: options.autoIncrement || false,
      data: new Map(),
      indexes: new Map()
    };
    
    db.stores.set(name, store);
    if (!this.inMemoryMode) {
      this.saveDatabase(db);
    }
    return store;
  }

  async get(storeInfo: { db: NodeDatabase; storeName: string }, key: any): Promise<any> {
    const store = storeInfo.db.stores.get(storeInfo.storeName);
    if (!store) return null;
    
    const keyStr = String(key);
    return store.data.get(keyStr) || null;
  }

  async put(storeInfo: { db: NodeDatabase; storeName: string }, value: any): Promise<any> {
    const store = storeInfo.db.stores.get(storeInfo.storeName);
    if (!store) throw new Error(`Store ${storeInfo.storeName} not found`);
    
    const key = value[store.keyPath];
    const keyStr = String(key);
    store.data.set(keyStr, value);
    
    if (!this.inMemoryMode) {
      this.saveDatabase(storeInfo.db);
    }
    return key;
  }

  async delete(storeInfo: { db: NodeDatabase; storeName: string }, key: any): Promise<any> {
    const store = storeInfo.db.stores.get(storeInfo.storeName);
    if (!store) throw new Error(`Store ${storeInfo.storeName} not found`);
    
    const keyStr = String(key);
    store.data.delete(keyStr);
    
    if (!this.inMemoryMode) {
      this.saveDatabase(storeInfo.db);
    }
    return key;
  }

  async getAll(storeInfo: { db: NodeDatabase; storeName: string }): Promise<any[]> {
    const store = storeInfo.db.stores.get(storeInfo.storeName);
    if (!store) return [];
    return Array.from(store.data.values());
  }

  async clear(storeInfo: { db: NodeDatabase; storeName: string }): Promise<void> {
    const store = storeInfo.db.stores.get(storeInfo.storeName);
    if (!store) throw new Error(`Store ${storeInfo.storeName} not found`);
    
    store.data.clear();
    
    if (!this.inMemoryMode) {
      this.saveDatabase(storeInfo.db);
    }
  }

  async count(storeInfo: { db: NodeDatabase; storeName: string }): Promise<number> {
    const store = storeInfo.db.stores.get(storeInfo.storeName);
    if (!store) return 0;
    return store.data.size;
  }

  close(db: NodeDatabase): void {
    if (!this.inMemoryMode) {
      this.saveDatabase(db);
    }
    this.databases.delete(db.name);
  }

  deleteDatabase(name: string): void {
    const filePath = path.join(this.dbPath, `${name}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    this.databases.delete(name);
  }

  clearAll(): void {
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