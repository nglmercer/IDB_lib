/**
 * BatchOperations - Handles batch operations (addMany, updateMany, deleteMany)
 */

import type { DatabaseItem, EmitEvents } from '../../types/index.js';
import type { StorageAdapter } from '../../adapters/types.js';
import { isValidId, normalizeId, generateNextId } from '../../utils/helpers.js';

export interface BatchOperationsOptions {
  db: any;
  adapter: StorageAdapter;
  isNodeEnvironment: boolean;
  emitEvent: (event: EmitEvents, data: DatabaseItem | number | null) => void;
  executeTransaction: <T>(
    storeName: string,
    mode: 'readonly' | 'readwrite',
    callback: (store: IDBObjectStore) => Promise<T> | T
  ) => Promise<T>;
}

export class BatchOperations {
  private db: any;
  private adapter: StorageAdapter;
  private isNodeEnvironment: boolean;
  private emitEvent: (event: EmitEvents, data: DatabaseItem | number | null) => void;
  private executeTransaction: <T>(
    storeName: string,
    mode: 'readonly' | 'readwrite',
    callback: (store: IDBObjectStore) => Promise<T> | T
  ) => Promise<T>;

  constructor(options: BatchOperationsOptions) {
    this.db = options.db;
    this.adapter = options.adapter;
    this.isNodeEnvironment = options.isNodeEnvironment;
    this.emitEvent = options.emitEvent;
    this.executeTransaction = options.executeTransaction;
  }

  updateContext(options: Partial<BatchOperationsOptions>): void {
    if (options.db !== undefined) this.db = options.db;
    if (options.adapter !== undefined) this.adapter = options.adapter;
    if (options.isNodeEnvironment !== undefined) this.isNodeEnvironment = options.isNodeEnvironment;
    if (options.emitEvent !== undefined) this.emitEvent = options.emitEvent;
    if (options.executeTransaction !== undefined) this.executeTransaction = options.executeTransaction;
  }

  async addManyToStore(storeName: string, items: Partial<DatabaseItem>[]): Promise<boolean> {
    const itemsToEmit: { actionType: EmitEvents, data: DatabaseItem }[] = [];

    if (this.isNodeEnvironment) {
      const allDataInStore = await this.adapter.getAll({ db: this.db, storeName });
      const existingIds = new Set(allDataInStore.map((d: DatabaseItem) => d.id));

      for (const item of items) {
        const cleanItem = { ...item };
        let targetId: string | number;
        let isUpdate = false;

        if (isValidId(cleanItem.id)) {
          targetId = normalizeId(cleanItem.id as string | number);
          isUpdate = existingIds.has(targetId);
        } else {
          targetId = generateNextId([...allDataInStore, ...itemsToEmit.map(i => i.data)]);
        }

        const newData = { ...cleanItem, id: targetId } as DatabaseItem;
        await this.adapter.put({ db: this.db, storeName }, newData);

        const actionType: EmitEvents = isUpdate ? "update" : "add";
        itemsToEmit.push({ actionType, data: newData });
      }

      itemsToEmit.forEach(item => this.emitEvent(item.actionType, item.data));
      return true;
    }

    return this.executeTransaction(storeName, "readwrite", async (store) => {
      const allDataInStore = await new Promise<DatabaseItem[]>((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      const existingIds = new Set(allDataInStore.map(d => d.id));
      const itemsToAdd: DatabaseItem[] = [];

      for (const item of items) {
        const cleanItem = { ...item };
        let targetId: string | number;
        let isUpdate = false;

        if (isValidId(cleanItem.id)) {
          targetId = normalizeId(cleanItem.id as string | number);
          isUpdate = existingIds.has(targetId);
        } else {
          const currentDataForIdGen = [...allDataInStore, ...itemsToAdd];
          targetId = generateNextId(currentDataForIdGen);
        }

        const newData = { ...cleanItem, id: targetId } as DatabaseItem;
        itemsToAdd.push(newData);

        const actionType: EmitEvents = isUpdate ? "update" : "add";
        itemsToEmit.push({ actionType, data: newData });
      }

      const promises = itemsToAdd.map(item => {
        return new Promise<void>((resolve, reject) => {
          const request = store.put(item);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      });

      await Promise.all(promises);
      return true;

    }).then((success) => {
      if (success) {
        itemsToEmit.forEach(item => this.emitEvent(item.actionType, item.data));
      }
      return true;
    }).catch(err => {
      console.error('Error adding multiple items:', err);
      return false;
    });
  }

  async updateManyInStore(storeName: string, items: DatabaseItem[]): Promise<boolean> {
    const itemsToEmit = [...items];

    if (this.isNodeEnvironment) {
      for (const item of items) {
        await this.adapter.put({ db: this.db, storeName }, item);
      }
      itemsToEmit.forEach(item => this.emitEvent("update", item));
      return true;
    }

    return this.executeTransaction(storeName, "readwrite", async (store) => {
      const promises = items.map(item => {
        return new Promise<void>((resolve, reject) => {
          const request = store.put(item);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      });
      await Promise.all(promises);
      return true;

    }).then((success) => {
      if (success) {
        itemsToEmit.forEach(item => this.emitEvent("update", item));
      }
      return true;
    }).catch(err => {
      console.error('Error updating multiple items:', err);
      return false;
    });
  }

  async deleteManyFromStore(storeName: string, ids: (string | number)[]): Promise<boolean> {
    const idsToEmit = ids.map(normalizeId);

    if (this.isNodeEnvironment) {
      for (const id of idsToEmit) {
        await this.adapter.delete({ db: this.db, storeName }, id);
      }
      idsToEmit.forEach(id => this.emitEvent("delete", id as number));
      return true;
    }

    return this.executeTransaction(storeName, "readwrite", async (store) => {
      const normalizedIds = ids.map(normalizeId);
      const promises = normalizedIds.map(id => {
        return new Promise<void>((resolve, reject) => {
          const request = store.delete(id);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      });
      await Promise.all(promises);
      return true;

    }).then((success) => {
      if (success) {
        idsToEmit.forEach(id => this.emitEvent("delete", id as number));
      }
      return true;
    }).catch(err => {
      console.error('Error deleting multiple items:', err);
      return false;
    });
  }
}

export default BatchOperations;
