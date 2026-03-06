/**
 * TransactionManager - Handles IndexedDB transactions and database operations
 */

import type { DatabaseConfig, DatabaseSchema, DatabaseIndex } from '../../types/index.js';
import type { StorageAdapter } from '../../adapters/types.js';
import { validateAnyDatabaseConfig } from '../../utils/helpers.js';

export interface TransactionManagerOptions {
  db: any;
  dbConfig: DatabaseConfig;
  adapter: StorageAdapter;
  isNodeEnvironment: boolean;
  schemaManager: {
    getSchema: () => DatabaseSchema | null;
  };
  defaultIndexes: DatabaseIndex[];
}

export class TransactionManager {
  private db: any;
  private dbConfig: DatabaseConfig;
  private adapter: StorageAdapter;
  private isNodeEnvironment: boolean;
  private schemaManager: {
    getSchema: () => DatabaseSchema | null;
  };
  private defaultIndexes: DatabaseIndex[];

  constructor(options: TransactionManagerOptions) {
    this.db = options.db;
    this.dbConfig = options.dbConfig;
    this.adapter = options.adapter;
    this.isNodeEnvironment = options.isNodeEnvironment;
    this.schemaManager = options.schemaManager;
    this.defaultIndexes = options.defaultIndexes;
  }

  updateContext(options: Partial<TransactionManagerOptions>): void {
    if (options.db !== undefined) this.db = options.db;
    if (options.dbConfig !== undefined) this.dbConfig = options.dbConfig;
    if (options.adapter !== undefined) this.adapter = options.adapter;
    if (options.isNodeEnvironment !== undefined) this.isNodeEnvironment = options.isNodeEnvironment;
    if (options.schemaManager !== undefined) this.schemaManager = options.schemaManager;
    if (options.defaultIndexes !== undefined) this.defaultIndexes = options.defaultIndexes;
  }

  getDb(): any {
    return this.db;
  }

  async openDatabase(): Promise<any> {
    if (this.db) return this.db;

    if (this.isNodeEnvironment) {
      this.db = await this.adapter.openDatabase(this.dbConfig.name, this.dbConfig.version);
      
      const currentSchema = this.schemaManager.getSchema();
      if (currentSchema) {
        currentSchema.stores.forEach(storeConfig => {
          if (!this.db.stores.has(storeConfig.name)) {
            this.adapter.createObjectStore(this.db, storeConfig.name, {
              keyPath: storeConfig.keyPath || "id",
              autoIncrement: storeConfig.autoIncrement || false,
            });
          }
        });
      } else {
        if (!this.db.stores.has(this.dbConfig.store)) {
          this.adapter.createObjectStore(this.db, this.dbConfig.store, {
            keyPath: "id",
            autoIncrement: false,
          });
        }
      }
      
      return this.db;
    }

    return new Promise<IDBDatabase>((resolve, reject) => {
      const currentSchema = this.schemaManager.getSchema();
      
      if (!currentSchema && !validateAnyDatabaseConfig(this.dbConfig)) {
        reject(new Error('Invalid database configuration'));
        return;
      }

      const request = indexedDB.open(this.dbConfig.name, this.dbConfig.version);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = (event.target as IDBOpenDBRequest).transaction;
        
        if (!transaction) {
          console.error('No transaction available during upgrade');
          return;
        }

        try {
          if (currentSchema) {
            currentSchema.stores.forEach(storeConfig => {
              if (!db.objectStoreNames.contains(storeConfig.name)) {
                const objectStore = db.createObjectStore(storeConfig.name, {
                  keyPath: storeConfig.keyPath || "id",
                  autoIncrement: storeConfig.autoIncrement || false,
                });

                if (storeConfig.indexes) {
                  storeConfig.indexes.forEach((index) => {
                    try {
                      if (!objectStore.indexNames.contains(index.name)) {
                        objectStore.createIndex(index.name, index.keyPath, {
                          unique: index.unique,
                        });
                      }
                    } catch (indexError) {
                      console.error(`Error creating index ${index.name}:`, indexError);
                    }
                  });
                }
              }
            });
          } else {
            if (!db.objectStoreNames.contains(this.dbConfig.store)) {
              const objectStore = db.createObjectStore(this.dbConfig.store, {
                keyPath: "id",
                autoIncrement: false,
              });

              this.defaultIndexes.forEach((index) => {
                try {
                  if (!objectStore.indexNames.contains(index.name)) {
                    objectStore.createIndex(index.name, index.keyPath, {
                      unique: index.unique,
                    });
                  }
                } catch (indexError) {
                  console.error(`Error creating index ${index.name}:`, indexError);
                }
              });
            }
          }
        } catch (upgradeError) {
          console.error('Error during database upgrade:', upgradeError);
        }
      };

      request.onsuccess = () => {
        try {
          this.db = request.result;
          resolve(this.db);
        } catch (successError) {
          console.error('Error in onsuccess handler:', successError);
          reject(successError);
        }
      };
      
      request.onerror = () => {
        try {
          const error = request.error || new Error('Unknown database error');
          console.error('Database opening failed:', error);
          if (this.db) {
            this.db.close();
            this.db = null;
          }
          reject(error);
        } catch (errorHandlingError) {
          console.error('Error in onerror handler:', errorHandlingError);
          reject(errorHandlingError);
        }
      };
      
      request.onblocked = () => {
        console.warn(`Database ${this.dbConfig.name} is blocked. Close other connections.`);
      };
    });
  }

  async executeTransaction<T>(
    storeName: string,
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => Promise<T> | T
  ): Promise<T> {
    const db = await this.openDatabase();

    return new Promise<T>((resolve, reject) => {
      if (!db.objectStoreNames.contains(storeName)) {
        const availableStores = Array.from(db.objectStoreNames);
        const errorMsg = `Store '${storeName}' not found. Available stores: [${availableStores.join(', ')}]`;
        console.error(errorMsg);
        return reject(new Error(errorMsg));
      }

      let transaction: IDBTransaction;
      try {
        transaction = db.transaction(storeName, mode);
      } catch (error) {
        console.error(`Error creating transaction for store ${storeName}:`, error);
        return reject(error);
      }
      
      let callbackResult: T | undefined;
      let callbackError: any;
      let isCallbackDone = false;
      let isTransactionDone = false;
      
      const checkCompletion = () => {
        if (isCallbackDone && isTransactionDone) {
          if (callbackError) {
            reject(callbackError);
          } else {
            resolve(callbackResult as T);
          }
        }
      };

      transaction.oncomplete = () => {
        isTransactionDone = true;
        checkCompletion();
      };

      transaction.onerror = () => {
        console.error(`Transaction error for store ${storeName}:`, transaction.error);
        reject(transaction.error);
      };

      transaction.onabort = () => {
        console.error(`Transaction aborted for store ${storeName}`);
        reject(new Error('Transaction was aborted'));
      };

      try {
        Promise.resolve(callback(transaction.objectStore(storeName)))
          .then(result => {
            callbackResult = result;
            isCallbackDone = true;
            checkCompletion();
          })
          .catch(err => {
            console.error(`Callback error for store ${storeName}:`, err);
            callbackError = err;
            isCallbackDone = true;
            if (transaction.abort) {
              transaction.abort();
            } else {
               checkCompletion();
            }
          });
      } catch (error) {
        console.error(`Synchronous error in callback for store ${storeName}:`, error);
        reject(error);
        if (transaction.abort) {
          transaction.abort();
        }
      }
    });
  }

  close(): void {
    if (this.db) {
      this.adapter.close(this.db);
      this.db = null;
    }
  }
}

export default TransactionManager;
