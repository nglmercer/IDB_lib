// Main IndexedDBManager - imports from modular files

import { Emitter, emitter } from './Emitter.js';
import { SchemaManager } from './schema/SchemaManager.js';
import { StoreProxy } from './proxy/StoreProxy.js';
import { DatabaseOperations } from './database/DatabaseOperations.js';
import { BatchOperations } from './database/BatchOperations.js';
import { SearchEngine } from './database/SearchEngine.js';
import { TransactionManager } from './database/TransactionManager.js';
import {
  validateAnyDatabaseConfig,
  createTimestamp
} from '../utils/helpers.js';
import type {
  DatabaseConfig,
  DatabaseItem,
  DatabaseIndex,
  EmitEventData,
  EmitEvents,
  SearchOptions,
  SearchResult,
  IndexedDBManagerOptions,
  EventCallback,
  FilterCriteria,
  SearchTextOptions,
  DatabaseStats,
  CreateDatabaseItem,
  DatabaseSchema
} from '../types/index.js';
import type { StorageAdapter } from '../adapters/types.js';
import { MemoryAdapter } from '../adapters/memory.js';

// Re-export for convenience
export { SchemaManager, StoreProxy };
export { DatabaseOperations, BatchOperations, SearchEngine, TransactionManager };

export class IndexedDBManager {
  private dbConfig: DatabaseConfig;
  private schemaManager: SchemaManager = new SchemaManager();
  public emitterInstance: Emitter;
  private db: any | null;
  private defaultIndexes: DatabaseIndex[];
  private storeProxies: Map<string, StoreProxy> = new Map();
  private adapter: StorageAdapter;
  private isNodeEnvironment: boolean;

  // Modular components
  private databaseOperations: DatabaseOperations;
  private batchOperations: BatchOperations;
  private searchEngine: SearchEngine;
  private transactionManager: TransactionManager;

  constructor(
    dbConfig: DatabaseConfig | { defaultDatabase: DatabaseConfig } | DatabaseSchema, 
    options?: IndexedDBManagerOptions & { adapter?: StorageAdapter }
  ) {
    this.isNodeEnvironment = typeof window === 'undefined';
    this.adapter = options?.adapter || new MemoryAdapter();

    if ('stores' in dbConfig) {
      this.schemaManager.setSchema(dbConfig);
      this.dbConfig = {
        name: dbConfig.name,
        version: dbConfig.version,
        store: dbConfig.stores[0]?.name || 'default'
      };
    } else {
      const actualConfig = 'defaultDatabase' in dbConfig ? dbConfig.defaultDatabase : dbConfig;
      
      if (!validateAnyDatabaseConfig(actualConfig)) {
        throw new Error('Invalid database configuration provided');
      }
      
      this.dbConfig = actualConfig;
    }
    
    this.emitterInstance = emitter;
    this.db = null;
    this.defaultIndexes = [];
    
    // Initialize emitEvent bound to this instance
    const emitEvent = (event: EmitEvents, data: DatabaseItem | number | null) => {
      this.emitEvent(event, data);
    };

    // Initialize modular components
    this.transactionManager = new TransactionManager({
      db: this.db,
      dbConfig: this.dbConfig,
      adapter: this.adapter,
      isNodeEnvironment: this.isNodeEnvironment,
      schemaManager: this.schemaManager,
      defaultIndexes: this.defaultIndexes
    });

    this.databaseOperations = new DatabaseOperations({
      db: this.db,
      dbConfig: this.dbConfig,
      adapter: this.adapter,
      isNodeEnvironment: this.isNodeEnvironment,
      emitEvent,
      executeTransaction: this.transactionManager.executeTransaction.bind(this.transactionManager)
    });

    this.batchOperations = new BatchOperations({
      db: this.db,
      adapter: this.adapter,
      isNodeEnvironment: this.isNodeEnvironment,
      emitEvent,
      executeTransaction: this.transactionManager.executeTransaction.bind(this.transactionManager)
    });

    this.searchEngine = new SearchEngine({
      getAllDataFromStore: this.databaseOperations.getAllDataFromStore.bind(this.databaseOperations)
    });

    if (options?.autoInit) {
      this.openDatabase().catch(error => {
        this.emitterInstance.emit('error', error);
      });
    }
  }

  private syncModules(): void {
    const emitEvent = (event: EmitEvents, data: DatabaseItem | number | null) => {
      this.emitEvent(event, data);
    };

    this.transactionManager.updateContext({
      db: this.db,
      dbConfig: this.dbConfig,
      adapter: this.adapter,
      isNodeEnvironment: this.isNodeEnvironment,
      schemaManager: this.schemaManager,
      defaultIndexes: this.defaultIndexes
    });

    this.databaseOperations.updateContext({
      db: this.db,
      dbConfig: this.dbConfig,
      adapter: this.adapter,
      isNodeEnvironment: this.isNodeEnvironment,
      emitEvent,
      executeTransaction: this.transactionManager.executeTransaction.bind(this.transactionManager)
    });

    this.batchOperations.updateContext({
      db: this.db,
      adapter: this.adapter,
      isNodeEnvironment: this.isNodeEnvironment,
      emitEvent,
      executeTransaction: this.transactionManager.executeTransaction.bind(this.transactionManager)
    });

    this.searchEngine.updateContext({
      getAllDataFromStore: this.databaseOperations.getAllDataFromStore.bind(this.databaseOperations)
    });
  }

  setAdapter(adapter: StorageAdapter): void {
    this.adapter = adapter;
    this.isNodeEnvironment = false; // MemoryAdapter works in all environments
    this.syncModules();
  }

  static async initializeWithSchema(schema: DatabaseSchema, options?: IndexedDBManagerOptions): Promise<IndexedDBManager> {
    const manager = new IndexedDBManager(schema, { ...options, autoInit: false });
    await manager.openDatabase();
    return manager;
  }

  async registerSchema(schema: DatabaseSchema): Promise<void> {
    this.schemaManager.setSchema(schema);
    
    if (schema.name === this.dbConfig.name) {
      this.close();
      this.dbConfig = {
        name: schema.name,
        version: schema.version,
        store: schema.stores[0]?.name || 'default'
      };
      await this.openDatabase();
    }
  }

  store(storeName: string): StoreProxy {
    const currentSchema = this.schemaManager.getSchema();
    if (currentSchema && !this.schemaManager.validateStore(currentSchema.name, storeName)) {
      throw new Error(`Store '${storeName}' not found in schema '${currentSchema.name}'`);
    }

    const proxyKey = `${storeName}-${Date.now()}`;
    const proxy = new StoreProxy(this, storeName);
    this.storeProxies.set(proxyKey, proxy);
    
    this.cleanupOldProxies(storeName);
    
    return proxy;
  }

  private cleanupOldProxies(storeName: string): void {
    const storeProxies = Array.from(this.storeProxies.entries())
      .filter(([key]) => key.startsWith(storeName))
      .sort(([a], [b]) => b.localeCompare(a));
    
    if (storeProxies.length > 10) {
      const toDelete = storeProxies.slice(10);
      toDelete.forEach(([key]) => this.storeProxies.delete(key));
    }
  }

  getSchemaInfo(): { current: DatabaseSchema | null, registered: string[] } {
    return {
      current: this.schemaManager.getSchema(),
      registered: this.schemaManager.getRegisteredSchemas()
    };
  }

  setSchema(schema: DatabaseSchema): void {
    this.schemaManager.setSchema(schema);
    this.dbConfig = {
      name: schema.name,
      version: schema.version,
      store: schema.stores[0]?.name || 'default'
    };
  }

  setEmitterInstance(emitterInstance: Emitter): void {
    this.emitterInstance = emitterInstance;
  }

  refreshEmitterInstance(): void {
    this.emitterInstance = emitter;
  }

  setDefaultIndexes(indexes: DatabaseIndex[]): void {
    this.defaultIndexes = indexes;
  }

  async setDatabase(config: DatabaseConfig): Promise<void> {
    if (!validateAnyDatabaseConfig(config)) {
      throw new Error('Invalid database configuration provided');
    }
    
    this.close();
    this.dbConfig = config;
    this.syncModules();
    await this.openDatabase();
  }

  getCurrentDatabase(): DatabaseConfig {
    return this.dbConfig;
  }

  async getAll(): Promise<DatabaseItem[]> {
    return this.getAllData();
  }

  async addMany(items: Partial<DatabaseItem>[]): Promise<boolean> {
    return this.batchOperations.addManyToStore(this.dbConfig.store, items);
  }

  on(event: EmitEvents, callback: EventCallback): void;
  on(event: string, callback: EventCallback): void;
  on(event: string, callback: EventCallback): void {
    this.emitterInstance.on(event, callback);
  }

  off(event: EmitEvents, callback: EventCallback): void;
  off(event: string, callback: EventCallback): void;
  off(event: string, callback: EventCallback): void {
    this.emitterInstance.off(event, callback as EventCallback<unknown>);
  }

  async add(data: Partial<CreateDatabaseItem>): Promise<DatabaseItem> {
    return this.saveData(data);
  }

  async updateMany(items: DatabaseItem[]): Promise<boolean> {
    return this.batchOperations.updateManyInStore(this.dbConfig.store, items);
  }

  async count(): Promise<number> {
    return this.databaseOperations.countInStore(this.dbConfig.store);
  }

  async deleteMany(ids: (string | number)[]): Promise<boolean> {
    return this.batchOperations.deleteManyFromStore(this.dbConfig.store, ids);
  }

  async saveDataToStore(storeName: string, data: Partial<DatabaseItem>): Promise<DatabaseItem> {
    return this.databaseOperations.saveDataToStore(storeName, data);
  }

  async getDataByIdFromStore(storeName: string, id: string | number): Promise<DatabaseItem | null> {
    return this.databaseOperations.getDataByIdFromStore(storeName, id);
  }

  async updateDataByIdInStore(
    storeName: string,
    id: string | number,
    updatedData: Partial<DatabaseItem>
  ): Promise<DatabaseItem | null> {
    return this.databaseOperations.updateDataByIdInStore(storeName, id, updatedData);
  }

  async deleteDataFromStore(storeName: string, id: string | number): Promise<string | number> {
    return this.databaseOperations.deleteDataFromStore(storeName, id);
  }

  async getAllDataFromStore(storeName: string): Promise<DatabaseItem[]> {
    return this.databaseOperations.getAllDataFromStore(storeName);
  }

  async clearStore(storeName: string): Promise<void> {
    return this.databaseOperations.clearStore(storeName);
  }

  async countInStore(storeName: string): Promise<number> {
    return this.databaseOperations.countInStore(storeName);
  }

  async searchDataInStore(storeName: string, query: Partial<DatabaseItem>, options: SearchOptions = {}): Promise<SearchResult> {
    return this.searchEngine.searchDataInStore(storeName, query, options);
  }

  async filterInStore(storeName: string, criteria: FilterCriteria): Promise<DatabaseItem[]> {
    return this.searchEngine.filterInStore(storeName, criteria);
  }

  async addManyToStore(storeName: string, items: Partial<DatabaseItem>[]): Promise<boolean> {
    return this.batchOperations.addManyToStore(storeName, items);
  }

  async updateManyInStore(storeName: string, items: DatabaseItem[]): Promise<boolean> {
    return this.batchOperations.updateManyInStore(storeName, items);
  }

  async deleteManyFromStore(storeName: string, ids: (string | number)[]): Promise<boolean> {
    return this.batchOperations.deleteManyFromStore(storeName, ids);
  }

  async getManyFromStore(storeName: string, ids: (string | number)[]): Promise<DatabaseItem[]> {
    return this.databaseOperations.getManyFromStore(storeName, ids);
  }

  async getStatsForStore(storeName: string): Promise<DatabaseStats> {
    return this.databaseOperations.getStatsForStore(storeName);
  }

  private async idExistsInStore(storeName: string, id: string | number): Promise<boolean> {
    return this.databaseOperations.idExistsInStore(storeName, id);
  }

  async idExists(id: string | number): Promise<boolean> {
    return this.idExistsInStore(this.dbConfig.store, id);
  }

  async updateDataById(id: string | number, updatedData: Partial<DatabaseItem>): Promise<DatabaseItem | null> {
    return this.databaseOperations.updateDataByIdInStore(this.dbConfig.store, id, updatedData);
  }

  async getDataById(id: string | number): Promise<DatabaseItem | null> {
    return this.databaseOperations.getDataByIdFromStore(this.dbConfig.store, id);
  }

  async saveData(data: Partial<CreateDatabaseItem>): Promise<DatabaseItem> {
    return this.databaseOperations.saveDataToStore(this.dbConfig.store, data);
  }

  async deleteData(id: string | number): Promise<string | number> {
    return this.databaseOperations.deleteDataFromStore(this.dbConfig.store, id);
  }

  async getAllData(): Promise<DatabaseItem[]> {
    return this.databaseOperations.getAllDataFromStore(this.dbConfig.store);
  }

  async searchData(query: Partial<DatabaseItem>, options: SearchOptions = {}): Promise<SearchResult> {
    return this.searchEngine.searchDataInStore(this.dbConfig.store, query, options);
  }

  async clearDatabase(): Promise<void> {
    return this.databaseOperations.clearStore(this.dbConfig.store);
  }

  async get(id: string | number): Promise<DatabaseItem | null> {
    return this.getDataById(id);
  }

  async update(item: DatabaseItem): Promise<DatabaseItem> {
    const result = await this.updateDataById(item.id, item);
    if (!result) {
      throw new Error(`Item with id ${item.id} not found`);
    }
    return result!;
  }

  async delete(id: string | number): Promise<boolean> {
    try {
      await this.deleteData(id);
      return true;
    } catch {
      return false;
    }
  }

  async clear(): Promise<void> {
    await this.clearDatabase();
  }

  async search(query: string, options?: SearchTextOptions): Promise<DatabaseItem[]> {
    const allData = await this.getAllData();
    return this.searchEngine.search(allData, query, options);
  }

  async filter(criteria: FilterCriteria): Promise<DatabaseItem[]> {
    return this.searchEngine.filterInStore(this.dbConfig.store, criteria);
  }

  async getMany(ids: (string | number)[]): Promise<DatabaseItem[]> {
    return this.databaseOperations.getManyFromStore(this.dbConfig.store, ids);
  }

  async getStats(): Promise<DatabaseStats> {
    return this.databaseOperations.getStatsForStore(this.dbConfig.store);
  }

  async openDatabase(): Promise<any> {
    this.db = await this.transactionManager.openDatabase();
    this.syncModules();
    return this.db;
  }

  async executeTransaction<T>(
    storeName: string,
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => Promise<T> | T
  ): Promise<T> {
    return this.transactionManager.executeTransaction(storeName, mode, callback);
  }

  close(): void {
    this.transactionManager.close();
    this.db = null;
    this.storeProxies.clear();
  }

  private emitEvent(event: EmitEvents, data: DatabaseItem | number | null): void {
    const eventData: EmitEventData = {
      config: this.dbConfig,
      data,
      metadata: {
        timestamp: createTimestamp(),
        operation: event
      }
    }
    this.emitterInstance?.emit(event, eventData);
  }

  async debugInfo(): Promise<{
    database: string;
    version: number;
    stores: string[];
    schema: DatabaseSchema | null;
    proxies: number;
  }> {
    const db = await this.openDatabase();
    
    if (this.isNodeEnvironment) {
      return {
        database: this.dbConfig.name,
        version: this.dbConfig.version,
        stores: Array.from(db.stores.keys()),
        schema: this.schemaManager.getSchema(),
        proxies: this.storeProxies.size
      };
    }

    return {
      database: this.dbConfig.name,
      version: this.dbConfig.version,
      stores: Array.from(db.objectStoreNames),
      schema: this.schemaManager.getSchema(),
      proxies: this.storeProxies.size
    };
  }
}

export default IndexedDBManager;
