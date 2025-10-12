import type { StorageAdapter } from './types.js';

export class BrowserAdapter implements StorageAdapter {
  async openDatabase(name: string, version: number): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, version);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = (event) => {
        // Handle upgradeneeded if needed
      };
    });
  }

  transaction(storeName: string, mode: 'readonly' | 'readwrite'): any {
    return { storeName, mode };
  }

  createObjectStore(db: IDBDatabase, name: string, options: any): IDBObjectStore {
    if (db.objectStoreNames.contains(name)) {
      // Cannot recreate existing store, return a reference
      const transaction = db.transaction([name], 'readwrite');
      return transaction.objectStore(name);
    }
    return db.createObjectStore(name, options);
  }

  async get(storeInfo: { db: IDBDatabase; storeName: string } | IDBObjectStore, key: any): Promise<any> {
    // Handle both old signature (IDBObjectStore) and new signature (storeInfo)
    if ('objectStoreNames' in storeInfo) {
      // storeInfo is actually { db, storeName }
      const { db, storeName } = storeInfo as { db: IDBDatabase; storeName: string };
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } else {
      // storeInfo is IDBObjectStore (old signature)
      const store = storeInfo as IDBObjectStore;
      return new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
  }

  async put(storeInfo: { db: IDBDatabase; storeName: string } | IDBObjectStore, value: any): Promise<any> {
    if ('objectStoreNames' in storeInfo) {
      const { db, storeName } = storeInfo as { db: IDBDatabase; storeName: string };
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(value);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } else {
      const store = storeInfo as IDBObjectStore;
      return new Promise((resolve, reject) => {
        const request = store.put(value);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
  }

  async delete(storeInfo: { db: IDBDatabase; storeName: string } | IDBObjectStore, key: any): Promise<any> {
    if ('objectStoreNames' in storeInfo) {
      const { db, storeName } = storeInfo as { db: IDBDatabase; storeName: string };
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } else {
      const store = storeInfo as IDBObjectStore;
      return new Promise((resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
  }

  async getAll(storeInfo: { db: IDBDatabase; storeName: string } | IDBObjectStore): Promise<any[]> {
    if ('objectStoreNames' in storeInfo) {
      const { db, storeName } = storeInfo as { db: IDBDatabase; storeName: string };
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } else {
      const store = storeInfo as IDBObjectStore;
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
  }

  async clear(storeInfo: { db: IDBDatabase; storeName: string } | IDBObjectStore): Promise<void> {
    if ('objectStoreNames' in storeInfo) {
      const { db, storeName } = storeInfo as { db: IDBDatabase; storeName: string };
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } else {
      const store = storeInfo as IDBObjectStore;
      return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  async count(storeInfo: { db: IDBDatabase; storeName: string } | IDBObjectStore): Promise<number> {
    if ('objectStoreNames' in storeInfo) {
      const { db, storeName } = storeInfo as { db: IDBDatabase; storeName: string };
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } else {
      const store = storeInfo as IDBObjectStore;
      return new Promise((resolve, reject) => {
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
  }

  close(db: IDBDatabase): void {
    db.close();
  }

  deleteDatabase(name: string): void {
    indexedDB.deleteDatabase(name);
  }

  clearAll(): void {
    // Browser doesn't have a direct way to clear all databases
    // This would need to be implemented by tracking database names
    console.warn('clearAll not fully implemented for BrowserAdapter');
  }
}