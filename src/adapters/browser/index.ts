// Modular BrowserAdapter - Main entry point

import type { 
  StorageAdapter, 
  StoreInfo, 
  TransactionMode, 
  BatchItem, 
  DatabaseInfo,
  CursorOptions 
} from '../types.js';
import { TransactionManager, createTransaction, executeRequest, executeBatchRequests } from './transaction.js';
import { CursorHelper, createCursor, iterateCursor, searchByIndex } from './cursor.js';

// Re-export types and helpers
export { TransactionManager, createTransaction, executeRequest, executeBatchRequests };
export { CursorHelper, createCursor, iterateCursor, searchByIndex };
export type { CursorOptions };

// Upgrade event handler type
export type UpgradeHandler = (event: IDBVersionChangeEvent) => void;

/**
 * Modular BrowserAdapter for IndexedDB operations
 */
export class BrowserAdapter implements StorageAdapter {
  private upgradeHandlers: Map<string, UpgradeHandler> = new Map();

  /**
   * Opens a database with optional upgrade handler
   */
  async openDatabase(name: string, version: number): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, version);

      request.onsuccess = () => resolve(request.result);

      request.onerror = () => {
        reject(new Error(`Failed to open database "${name}": ${request.error?.message || 'Unknown error'}`));
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const handler = this.upgradeHandlers.get(name);
        if (handler) handler(event);
      };
    });
  }

  /**
   * Register an upgrade handler
   */
  onUpgrade(name: string, handler: UpgradeHandler): void {
    this.upgradeHandlers.set(name, handler);
  }

  /**
   * Creates a transaction
   */
  transaction(storeName: string, mode: TransactionMode): { storeName: string; mode: TransactionMode } {
    return { storeName, mode };
  }

  /**
   * Creates or retrieves an object store
   */
  createObjectStore(db: any, name: string, options?: any): any {
    if (db.objectStoreNames.contains(name)) {
      const transaction = db.transaction([name], 'readwrite');
      return transaction.objectStore(name);
    }
    return db.createObjectStore(name, options);
  }

  /**
   * Creates an index
   */
  createIndex(db: any, storeName: string, indexName: string, keyPath: any, options?: any): any {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    return store.createIndex(indexName, keyPath, options);
  }

  /**
   * Deletes an index
   */
  deleteIndex(_db: any, storeName: string, indexName: string): void {
    const transaction = _db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    store.deleteIndex(indexName);
  }

  /**
   * Gets object store names
   */
  getObjectStoreNames(db: any): string[] {
    return Array.from(db.objectStoreNames);
  }

  /**
   * Gets a value by key
   */
  async get(store: StoreInfo, key: any): Promise<any> {
    return executeRequest(store.db, store.storeName, 'readonly', s => s.get(key));
  }

  /**
   * Gets multiple values by keys
   */
  async getMany(store: StoreInfo, keys: any[]): Promise<any[]> {
    if (keys.length === 0) return [];
    
    const operations = keys.map(key => (s: IDBObjectStore) => s.get(key));
    return executeBatchRequests(store.db, store.storeName, 'readonly', operations);
  }

  /**
   * Puts a value
   */
  async put(store: StoreInfo, value: any, key?: any): Promise<any> {
    const op = key ? (s: IDBObjectStore) => s.put(value, key) : (s: IDBObjectStore) => s.put(value);
    return executeRequest(store.db, store.storeName, 'readwrite', op);
  }

  /**
   * Puts multiple values
   */
  async putMany(store: StoreInfo, items: BatchItem[]): Promise<any[]> {
    if (items.length === 0) return [];
    
    const operations = items.map(item => 
      item.key ? (s: IDBObjectStore) => s.put(item.value, item.key) : (s: IDBObjectStore) => s.put(item.value)
    );
    return executeBatchRequests(store.db, store.storeName, 'readwrite', operations);
  }

  /**
   * Adds a value
   */
  async add(store: StoreInfo, value: any, key?: any): Promise<any> {
    const op = key ? (s: IDBObjectStore) => s.add(value, key) : (s: IDBObjectStore) => s.add(value);
    return executeRequest(store.db, store.storeName, 'readwrite', op);
  }

  /**
   * Deletes a value
   */
  async delete(store: StoreInfo, key: any): Promise<void> {
    return executeRequest(store.db, store.storeName, 'readwrite', s => s.delete(key));
  }

  /**
   * Deletes multiple values
   */
  async deleteMany(store: StoreInfo, keys: any[]): Promise<void> {
    if (keys.length === 0) return Promise.resolve();
    
    const operations = keys.map(key => (s: IDBObjectStore) => s.delete(key));
    await executeBatchRequests(store.db, store.storeName, 'readwrite', operations);
  }

  /**
   * Gets all values
   */
  async getAll(store: StoreInfo): Promise<any[]> {
    return executeRequest(store.db, store.storeName, 'readonly', s => s.getAll());
  }

  /**
   * Gets all values from index
   */
  async getAllFromIndex(store: StoreInfo, indexName: string, query?: any): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const transaction = store.db.transaction([store.storeName], 'readonly');
      const s = transaction.objectStore(store.storeName);
      const index = s.index(indexName);
      const request = index.getAll(query);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to get from index: ${request.error?.message}`));
    });
  }

  /**
   * Clears the store
   */
  async clear(store: StoreInfo): Promise<void> {
    return executeRequest(store.db, store.storeName, 'readwrite', s => s.clear());
  }

  /**
   * Counts records
   */
  async count(store: StoreInfo, query?: any): Promise<number> {
    return executeRequest(store.db, store.storeName, 'readonly', s => s.count(query));
  }

  /**
   * Iterates using cursor
   */
  async iterate(store: StoreInfo, callback: any, options?: CursorOptions): Promise<void> {
    const helper = new CursorHelper(store.db, store.storeName, options);
    return helper.iterate(callback);
  }

  /**
   * Searches by index
   */
  async searchByIndex(store: StoreInfo, indexName: string, query: any, limit?: number): Promise<any[]> {
    return searchByIndex(store.db, store.storeName, indexName, query, limit);
  }

  /**
   * Closes database
   */
  close(db: any): void {
    db.close();
  }

  /**
   * Deletes database
   */
  async deleteDatabase(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to delete database: ${request.error?.message}`));
      request.onblocked = () => console.warn(`Deletion of "${name}" is blocked.`);
    });
  }

  /**
   * Gets database names
   */
  async getDatabaseNames(): Promise<string[]> {
    if (indexedDB.databases) {
      const dbs = await indexedDB.databases();
      return dbs.map(db => db.name).filter((name): name is string => name !== undefined);
    }
    console.warn('indexedDB.databases() not supported');
    return [];
  }

  /**
   * Gets database info
   */
  async getDatabaseInfo(): Promise<DatabaseInfo[]> {
    if (indexedDB.databases) {
      const dbs = await indexedDB.databases();
      return dbs
        .filter((db): db is { name: string; version: number } => db.name !== undefined && db.version !== undefined)
        .map(db => ({ name: db.name, version: db.version }));
    }
    return [];
  }

  /**
   * Checks if database exists
   */
  async databaseExists(name: string): Promise<boolean> {
    const names = await this.getDatabaseNames();
    return names.includes(name);
  }

  /**
   * Clears all databases
   */
  async clearAll(): Promise<void> {
    const names = await this.getDatabaseNames();
    for (const name of names) {
      await this.deleteDatabase(name);
    }
  }
}

// Default export
export default BrowserAdapter;
