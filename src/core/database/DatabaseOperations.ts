/**
 * DatabaseOperations - Handles all CRUD operations for IndexedDB
 */

import type { DatabaseItem, DatabaseConfig, EmitEvents, CreateDatabaseItem } from '../../types/index.js';
import type { StorageAdapter } from '../../adapters/types.js';
import { normalizeId, isValidId } from '../../utils/helpers.js';

export interface DatabaseOperationsOptions {
  db: any;
  dbConfig: DatabaseConfig;
  adapter: StorageAdapter;
  isNodeEnvironment: boolean;
  emitEvent: (event: EmitEvents, data: DatabaseItem | number | null) => void;
  executeTransaction: <T>(
    storeName: string,
    mode: 'readonly' | 'readwrite',
    callback: (store: IDBObjectStore) => Promise<T> | T
  ) => Promise<T>;
}

export class DatabaseOperations {
  private db: any;
  private dbConfig: DatabaseConfig;
  private adapter: StorageAdapter;
  private isNodeEnvironment: boolean;
  private emitEvent: (event: EmitEvents, data: DatabaseItem | number | null) => void;
  private executeTransaction: <T>(
    storeName: string,
    mode: 'readonly' | 'readwrite',
    callback: (store: IDBObjectStore) => Promise<T> | T
  ) => Promise<T>;

  constructor(options: DatabaseOperationsOptions) {
    this.db = options.db;
    this.dbConfig = options.dbConfig;
    this.adapter = options.adapter;
    this.isNodeEnvironment = options.isNodeEnvironment;
    this.emitEvent = options.emitEvent;
    this.executeTransaction = options.executeTransaction;
  }

  updateContext(options: Partial<DatabaseOperationsOptions>): void {
    if (options.db !== undefined) this.db = options.db;
    if (options.dbConfig !== undefined) this.dbConfig = options.dbConfig;
    if (options.adapter !== undefined) this.adapter = options.adapter;
    if (options.isNodeEnvironment !== undefined) this.isNodeEnvironment = options.isNodeEnvironment;
    if (options.emitEvent !== undefined) this.emitEvent = options.emitEvent;
    if (options.executeTransaction !== undefined) this.executeTransaction = options.executeTransaction;
  }

  async saveDataToStore(storeName: string, data: Partial<CreateDatabaseItem>): Promise<DatabaseItem> {
    if (typeof data !== "object" || data === null) {
      return Promise.reject(new Error("Invalid data: must be an object."));
    }

    const cleanData = { ...data };
    
    const hasExplicitId = isValidId(cleanData.id);
    let targetId: string | number;
    let isUpdate = false;

    if (hasExplicitId) {
      targetId = normalizeId(cleanData.id as string | number);
      isUpdate = await this.idExistsInStore(storeName, targetId);
    } else {
      targetId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      isUpdate = false;
    }
    
    const newData: DatabaseItem = { ...cleanData, id: targetId } as DatabaseItem;
    const actionType: EmitEvents = isUpdate ? "update" : "add";

    if (this.isNodeEnvironment) {
      await this.adapter.put({ db: this.db, storeName }, newData);
      this.emitEvent(actionType, newData);
      return newData;
    }

    return this.executeTransaction(
      storeName,
      "readwrite",
      (store: IDBObjectStore) => {
        return new Promise<DatabaseItem>((resolve, reject) => {
          const request = store.put(newData);
          request.onsuccess = () => resolve(newData);
          request.onerror = () => reject(request.error);
        });
      }
    ).then((savedData) => {
      this.emitEvent(actionType, savedData);
      return savedData;
    });
  }

  async getDataByIdFromStore(storeName: string, id: string | number): Promise<DatabaseItem | null> {
    if (!isValidId(id)) {
      return null;
    }

    const normalizedId = normalizeId(id);
    
    if (this.isNodeEnvironment) {
      return this.adapter.get({ db: this.db, storeName }, normalizedId);
    }

    return this.executeTransaction(
      storeName,
      "readonly",
      (store: IDBObjectStore) => {
        return new Promise<DatabaseItem | null>((resolve, reject) => {
          const request = store.get(normalizedId);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error);
        });
      }
    );
  }

  async updateDataByIdInStore(
    storeName: string,
    id: string | number,
    updatedData: Partial<DatabaseItem>
  ): Promise<DatabaseItem | null> {
    if (!isValidId(id)) {
      throw new Error("Invalid ID provided for update");
    }

    const normalizedId = normalizeId(id);
    const exists = await this.idExistsInStore(storeName, normalizedId);
    
    if (!exists) {
      return null;
    }

    if (this.isNodeEnvironment) {
      const existing = await this.adapter.get({ db: this.db, storeName }, normalizedId);
      if (existing) {
        const newData: DatabaseItem = { ...existing, ...updatedData, id: normalizedId };
        await this.adapter.put({ db: this.db, storeName }, newData);
        this.emitEvent("update", newData);
        return newData;
      }
      return null;
    }

    return this.executeTransaction(
      storeName,
      "readwrite",
      (store: IDBObjectStore) => {
        return new Promise<DatabaseItem | null>((resolve, reject) => {
          const getRequest = store.get(normalizedId);

          getRequest.onsuccess = () => {
            if (getRequest.result) {
              const newData: DatabaseItem = {
                ...getRequest.result,
                ...updatedData,
                id: normalizedId,
              };
              
              const putRequest = store.put(newData);
              putRequest.onsuccess = () => {
                this.emitEvent("update", newData);
                resolve(newData);
              };
              putRequest.onerror = () => reject(putRequest.error);
            } else {
              resolve(null);
            }
          };
          getRequest.onerror = () => reject(getRequest.error);
        });
      }
    );
  }

  async deleteDataFromStore(storeName: string, id: string | number): Promise<string | number> {
    if (!isValidId(id)) {
      throw new Error("Invalid ID provided for deletion");
    }

    const keyId = normalizeId(id);

    if (this.isNodeEnvironment) {
      await this.adapter.delete({ db: this.db, storeName }, keyId);
      this.emitEvent("delete", keyId as number);
      return keyId;
    }

    return this.executeTransaction(
      storeName,
      "readwrite",
      (store: IDBObjectStore) => {
        return new Promise<string | number>((resolve, reject) => {
          const request = store.delete(keyId);
          request.onsuccess = () => resolve(keyId);
          request.onerror = () => reject(request.error);
        });
      }
    ).then((deletedId) => {
      this.emitEvent("delete", deletedId as number);
      return deletedId;
    });
  }

  async getAllDataFromStore(storeName: string): Promise<DatabaseItem[]> {
    if (this.isNodeEnvironment) {
      return this.adapter.getAll({ db: this.db, storeName });
    }

    return this.executeTransaction(
      storeName,
      "readonly",
      (store: IDBObjectStore) => {
        return new Promise<DatabaseItem[]>((resolve, reject) => {
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      }
    );
  }

  async clearStore(storeName: string): Promise<void> {
    if (this.isNodeEnvironment) {
      await this.adapter.clear({ db: this.db, storeName });
      this.emitEvent("clear", null);
      return;
    }

    return this.executeTransaction(
      storeName,
      "readwrite",
      (store: IDBObjectStore) => {
        return new Promise<void>((resolve, reject) => {
          const request = store.clear();
          request.onsuccess = () => {
            this.emitEvent("clear", null);
            resolve();
          };
          request.onerror = () => reject(request.error);
        });
      }
    );
  }

  async countInStore(storeName: string): Promise<number> {
    if (this.isNodeEnvironment) {
      return this.adapter.count({ db: this.db, storeName });
    }

    return this.executeTransaction(
      storeName,
      "readonly",
      (store: IDBObjectStore) => {
        return new Promise<number>((resolve, reject) => {
          const request = store.count();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      }
    );
  }

  async getManyFromStore(storeName: string, ids: (string | number)[]): Promise<DatabaseItem[]> {
    const results: DatabaseItem[] = [];
    
    for (const id of ids) {
      const item = await this.getDataByIdFromStore(storeName, id);
      if (item) {
        results.push(item);
      }
    }
    
    return results;
  }

  async getStatsForStore(storeName: string): Promise<{ totalRecords: number; storeName: string; databaseName: string; version: number }> {
    const allData = await this.getAllDataFromStore(storeName);

    return {
      totalRecords: allData.length,
      storeName: storeName,
      databaseName: this.dbConfig.name,
      version: this.dbConfig.version
    };
  }

  async idExistsInStore(storeName: string, id: string | number): Promise<boolean> {
    const normalizedId = normalizeId(id);
    
    if (this.isNodeEnvironment) {
      const item = await this.adapter.get({ db: this.db, storeName }, normalizedId);
      return item !== null && item !== undefined;
    }

    return this.executeTransaction(
      storeName,
      "readonly",
      (store: IDBObjectStore) => {
        return new Promise<boolean>((resolve, reject) => {
          const request = store.get(normalizedId);
          request.onsuccess = () => resolve(request.result !== undefined);
          request.onerror = () => reject(request.error);
        });
      }
    );
  }
}

export default DatabaseOperations;
