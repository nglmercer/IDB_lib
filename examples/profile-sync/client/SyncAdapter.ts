
import type { StorageAdapter, StoreInfo, BatchItem, CursorOptions } from "../../../src/adapters/types.js";
import { MemoryAdapter } from "../../../src/adapters/memory.js";
import { SyncClient } from "./SyncClient.js";
import type { SyncItem } from "../shared/types.js";

export class SyncAdapter implements StorageAdapter {
  private localAdapter: StorageAdapter;
  private syncClient: SyncClient;
  private dbName: string = "default";

  constructor(profileId: string, localAdapter?: StorageAdapter) {
    this.localAdapter = localAdapter || new MemoryAdapter();
    this.syncClient = new SyncClient({ profileId, url: "ws://localhost:3000" });
    this.syncClient.setUpdateLocalCallback(this.updateLocalState.bind(this));
  }

  private async updateLocalState(storeName: string, items: SyncItem[]) {
    if (this.dbName !== "default") {
        await this.localAdapter.openDatabase(this.dbName, 1);
    }
    
    const storeInfo: StoreInfo = { db: { name: this.dbName }, storeName };
    const db = await this.localAdapter.openDatabase(this.dbName, 1);
    
    // Ensure store exists locally
    if (!this.getObjectStoreNames(db).includes(storeName)) {
        this.localAdapter.createObjectStore(db, storeName);
    }

    for (const item of items) {
        if (item._deleted) {
            await this.localAdapter.delete(storeInfo, item.id);
        } else {
            await this.localAdapter.put(storeInfo, item, item.id);
        }
    }
  }

  async openDatabase(name: string, version: number): Promise<any> {
    this.dbName = name;
    const db = await this.localAdapter.openDatabase(name, version);
    const stores = this.getObjectStoreNames(db);
    for (const store of stores) {
        this.syncClient.syncFromServer(store);
    }
    return db;
  }

  close(db: any): void {
    this.syncClient.close();
    this.localAdapter.close(db);
  }

  async deleteDatabase(name: string): Promise<void> {
    return this.localAdapter.deleteDatabase(name);
  }

  transaction(storeName: string, mode: "readonly" | "readwrite"): any {
    return this.localAdapter.transaction(storeName, mode);
  }

  createObjectStore(db: any, name: string, options?: any): any {
    const store = this.localAdapter.createObjectStore(db, name, options);
    this.syncClient.syncFromServer(name);
    return store;
  }

  async get(store: StoreInfo, key: any): Promise<any> {
    return this.localAdapter.get(store, key);
  }

  async put(store: StoreInfo, value: any, key?: any): Promise<any> {
    const result = await this.localAdapter.put(store, value, key);
    this.syncClient.pushChange(store.storeName, value);
    return result;
  }

  async add(store: StoreInfo, value: any, key?: any): Promise<any> {
    return this.put(store, value, key);
  }

  async delete(store: StoreInfo, key: any): Promise<any> {
    const result = await this.localAdapter.delete(store, key);
    this.syncClient.pushChange(store.storeName, { id: key, _deleted: true });
    return result;
  }

  async getAll(store: StoreInfo): Promise<any[]> {
    return this.localAdapter.getAll(store);
  }

  async putMany(store: StoreInfo, items: BatchItem[]): Promise<any[]> {
    const results = await this.localAdapter.putMany(store, items);
    this.syncClient.pushBatch(store.storeName, items.map(i => i.value));
    return results;
  }

  async deleteMany(storeInfo: StoreInfo, keys: any[]): Promise<void> {
    await this.localAdapter.deleteMany(storeInfo, keys);
    this.syncClient.pushBatch(storeInfo.storeName, keys.map(k => ({ id: k, _deleted: true })));
  }

  async getMany(store: StoreInfo, keys: any[]): Promise<any[]> {
    return this.localAdapter.getMany(store, keys);
  }

  async clear(store: StoreInfo): Promise<void> {
    return this.localAdapter.clear(store);
  }

  async count(store: StoreInfo, query?: any): Promise<number> {
    return this.localAdapter.count(store, query);
  }

  createIndex(db: any, storeName: string, indexName: string, keyPath: any, options?: any): any {
    return this.localAdapter.createIndex(db, storeName, indexName, keyPath, options);
  }

  deleteIndex(db: any, storeName: string, indexName: string): void {
    return this.localAdapter.deleteIndex(db, storeName, indexName);
  }

  async getAllFromIndex(store: StoreInfo, indexName: string, query?: any): Promise<any[]> {
    return this.localAdapter.getAllFromIndex(store, indexName, query);
  }

  async iterate(store: StoreInfo, callback: any, options?: CursorOptions): Promise<void> {
    return this.localAdapter.iterate(store, callback, options);
  }

  async searchByIndex(store: StoreInfo, indexName: string, query: any, limit?: number): Promise<any[]> {
    return this.localAdapter.searchByIndex(store, indexName, query, limit);
  }

  async getDatabaseNames(): Promise<string[]> {
    return this.localAdapter.getDatabaseNames();
  }

  async getDatabaseInfo(): Promise<any[]> {
    return this.localAdapter.getDatabaseInfo();
  }

  async databaseExists(name: string): Promise<boolean> {
    return this.localAdapter.databaseExists(name);
  }

  async clearAll(): Promise<void> {
    return this.localAdapter.clearAll();
  }

  onUpgrade(name: string, handler: any): void {
    this.localAdapter.onUpgrade(name, handler);
  }

  getObjectStoreNames(db: any): string[] {
    return this.localAdapter.getObjectStoreNames(db);
  }

  syncFromServer(storeName: string) {
    this.syncClient.syncFromServer(storeName);
  }
  
  isOnline() { return this.syncClient.isOnline(); }
}
