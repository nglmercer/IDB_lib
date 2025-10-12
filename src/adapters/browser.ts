import type { StorageAdapter } from './types.js';

export class BrowserAdapter implements StorageAdapter {
  async openDatabase(name: string, version: number): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, version);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      // onupgradeneeded is handled by the IndexedDBManager, which will call
      // createObjectStore on the adapter.
      request.onupgradeneeded = () => { /* intentionally empty */ };
    });
  }

  transaction(storeName: string, mode: 'readonly' | 'readwrite'): any {
    // This is a placeholder as transactions are created per-operation.
    return { storeName, mode };
  }

  createObjectStore(db: IDBDatabase, name: string, options: any): IDBObjectStore {
    if (db.objectStoreNames.contains(name)) {
      const transaction = db.transaction([name], 'readwrite');
      return transaction.objectStore(name);
    }
    return db.createObjectStore(name, options);
  }

  private _executeRequest<T>(
    db: IDBDatabase,
    storeName: string,
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([storeName], mode);
        const store = transaction.objectStore(storeName);
        const request = operation(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  async get(storeInfo: { db: IDBDatabase; storeName: string }, key: any): Promise<any> {
    const { db, storeName } = storeInfo;
    return this._executeRequest(db, storeName, 'readonly', (store) => store.get(key));
  }

  async put(storeInfo: { db: IDBDatabase; storeName: string }, value: any): Promise<any> {
    const { db, storeName } = storeInfo;
    return this._executeRequest(db, storeName, 'readwrite', (store) => store.put(value));
  }

  async delete(storeInfo: { db: IDBDatabase; storeName: string }, key: any): Promise<void> {
    const { db, storeName } = storeInfo;
    return this._executeRequest(db, storeName, 'readwrite', (store) => store.delete(key));
  }

  async getAll(storeInfo: { db: IDBDatabase; storeName: string }): Promise<any[]> {
    const { db, storeName } = storeInfo;
    return this._executeRequest(db, storeName, 'readonly', (store) => store.getAll());
  }

  async clear(storeInfo: { db: IDBDatabase; storeName: string }): Promise<void> {
    const { db, storeName } = storeInfo;
    return this._executeRequest(db, storeName, 'readwrite', (store) => store.clear());
  }

  async count(storeInfo: { db: IDBDatabase; storeName: string }): Promise<number> {
    const { db, storeName } = storeInfo;
    return this._executeRequest(db, storeName, 'readonly', (store) => store.count());
  }

  close(db: IDBDatabase): void {
    db.close();
  }

  async deleteDatabase(name: string): Promise<void> {
     return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => {
          console.warn(`Deletion of database ${name} is blocked.`);
          // Resolve anyway as the block will eventually clear, but the operation is requested.
          resolve(); 
        };
     });
  }

  async clearAll(): Promise<void> {
    console.warn('clearAll is not implemented for BrowserAdapter due to IndexedDB limitations.');
    if (indexedDB.databases) {
      const dbs = await indexedDB.databases();
      for (const dbInfo of dbs) {
        if(dbInfo.name) {
          await this.deleteDatabase(dbInfo.name);
        }
      }
    } else {
       console.warn('indexedDB.databases() is not supported in this browser. Cannot clear all databases automatically.');
    }
  }
}