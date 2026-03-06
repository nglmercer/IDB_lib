// Transaction helper module

import type { TransactionMode } from '../types.js';

/**
 * Creates and manages IndexedDB transactions
 */
export class TransactionManager {
  private _storeName: string;
  private _transaction: IDBTransaction;

  constructor(db: IDBDatabase, storeName: string, mode: TransactionMode = 'readonly') {
    this._storeName = storeName;
    this._transaction = db.transaction([storeName], mode);
  }

  get store(): IDBObjectStore {
    return this._transaction.objectStore(this._storeName);
  }

  get rawTransaction(): IDBTransaction {
    return this._transaction;
  }

  /**
   * Execute a request within the transaction
   */
  execute<T>(operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      try {
        const store = this._transaction.objectStore(this._storeName);
        const request = operation(store);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Execute multiple requests in a single transaction
   */
  executeBatch<T>(operations: Array<(store: IDBObjectStore) => IDBRequest<any>>): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      let pending = operations.length;

      if (pending === 0) {
        resolve([]);
        return;
      }

      const store = this._transaction.objectStore(this._storeName);

      operations.forEach((operation, index) => {
        try {
          const request = operation(store);
          request.onsuccess = () => {
            results[index] = request.result;
            pending--;
            if (pending === 0) {
              resolve(results);
            }
          };
          request.onerror = () => reject(request.error);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Set up transaction error handler
   */
  onError(handler: (error: Event) => void): void {
    this._transaction.onerror = handler;
  }

  /**
   * Set up transaction complete handler
   */
  onComplete(handler: () => void): void {
    this._transaction.oncomplete = handler;
  }

  /**
   * Set up transaction abort handler
   */
  onAbort(handler: (error: Event) => void): void {
    this._transaction.onabort = handler;
  }
}

/**
 * Creates a transaction helper
 */
export function createTransaction(
  db: IDBDatabase, 
  storeName: string, 
  mode: TransactionMode = 'readonly'
): TransactionManager {
  return new TransactionManager(db, storeName, mode);
}

/**
 * Execute a simple IndexedDB request
 */
export function executeRequest<T>(
  db: IDBDatabase,
  storeName: string,
  mode: TransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction([storeName], mode);
      
      transaction.onerror = () => {
        reject(new Error(`Transaction failed: ${transaction.error?.message || 'Unknown error'}`));
      };

      const store = transaction.objectStore(storeName);
      const request = operation(store);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Request failed: ${request.error?.message || 'Unknown error'}`));
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Execute multiple requests in a single transaction
 */
export function executeBatchRequests<T>(
  db: IDBDatabase,
  storeName: string,
  mode: TransactionMode,
  operations: Array<(store: IDBObjectStore) => IDBRequest<any>>
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], mode);
    const results: any[] = [];
    let pending = operations.length;

    transaction.onerror = () => {
      reject(new Error(`Transaction failed: ${transaction.error?.message}`));
    };

    if (pending === 0) {
      resolve([]);
      return;
    }

    const store = transaction.objectStore(storeName);

    operations.forEach((operation, index) => {
      try {
        const request = operation(store);
        request.onsuccess = () => {
          results[index] = request.result;
          pending--;
          if (pending === 0) {
            resolve(results);
          }
        };
        request.onerror = () => reject(new Error(`Request failed: ${request.error?.message}`));
      } catch (error) {
        reject(error);
      }
    });
  });
}
