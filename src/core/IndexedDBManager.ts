import { Emitter, emitter } from './Emitter.js';
import {
  normalizeId,
  isValidId,
  generateNextId,
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

export class SchemaManager {
  private schemas: Map<string, DatabaseSchema> = new Map();
  private activeSchema: DatabaseSchema | null = null;

  setSchema(schema: DatabaseSchema): void {
    this.schemas.set(schema.name, schema);
    this.activeSchema = schema;
  }

  getSchema(name?: string): DatabaseSchema | null {
    if (name) {
      return this.schemas.get(name) || null;
    }
    return this.activeSchema;
  }

  getStoreConfig(schemaName: string, storeName: string) {
    const schema = this.schemas.get(schemaName);
    return schema?.stores.find(store => store.name === storeName);
  }

  validateStore(schemaName: string, storeName: string): boolean {
    const schema = this.schemas.get(schemaName);
    return schema?.stores.some(store => store.name === storeName) || false;
  }
}

export class StoreProxy {
  private _manager: IndexedDBManager;
  private _storeName: string;
  private _instanceId: string;

  constructor(
    manager: IndexedDBManager,
    storeName: string
  ) {
    this._manager = manager;
    this._storeName = storeName;
    this._instanceId = `${storeName}-${Date.now()}-${Math.random()}`;
  }

  get storeName(): string {
    return this._storeName;
  }

  get instanceId(): string {
    return this._instanceId;
  }

  async add(data: Partial<DatabaseItem>): Promise<DatabaseItem> {
    const cleanData = data;
    return this._manager.saveDataToStore(this._storeName, cleanData);
  }

  async get(id: string | number): Promise<DatabaseItem | null> {
    return this._manager.getDataByIdFromStore(this._storeName, id);
  }

  async update(item: DatabaseItem): Promise<DatabaseItem | null> {
    const cleanItem = item;
    return this._manager.updateDataByIdInStore(this._storeName, cleanItem.id!, cleanItem);
  }

  async delete(id: string | number): Promise<boolean> {
    try {
      await this._manager.deleteDataFromStore(this._storeName, id);
      return true;
    } catch {
      return false;
    }
  }

  async getAll(): Promise<DatabaseItem[]> {
    return this._manager.getAllDataFromStore(this._storeName);
  }

  async clear(): Promise<void> {
    return this._manager.clearStore(this._storeName);
  }

  async count(): Promise<number> {
    return this._manager.countInStore(this._storeName);
  }

  async search(query: Partial<DatabaseItem>, options: SearchOptions = {}): Promise<SearchResult> {
    return this._manager.searchDataInStore(this._storeName, query, options);
  }

  async filter(criteria: FilterCriteria): Promise<DatabaseItem[]> {
    return this._manager.filterInStore(this._storeName, criteria);
  }

  async addMany(items: Partial<DatabaseItem>[]): Promise<boolean> {
    const cleanItems = items.map(item => item);
    return this._manager.addManyToStore(this._storeName, cleanItems);
  }

  async updateMany(items: DatabaseItem[]): Promise<boolean> {
    const cleanItems = items.map(item => item);
    return this._manager.updateManyInStore(this._storeName, cleanItems);
  }

  async deleteMany(ids: (string | number)[]): Promise<boolean> {
    return this._manager.deleteManyFromStore(this._storeName, ids);
  }

  async getMany(ids: (string | number)[]): Promise<DatabaseItem[]> {
    return this._manager.getManyFromStore(this._storeName, ids);
  }

  async getStats(): Promise<DatabaseStats> {
    return this._manager.getStatsForStore(this._storeName);
  }
}

// IndexedDB Manager principal
export class IndexedDBManager {
  private dbConfig: DatabaseConfig;
  private schemaManager: SchemaManager = new SchemaManager();
  public emitterInstance: Emitter;
  private db: IDBDatabase | null;
  private defaultIndexes: DatabaseIndex[];
  private storeProxies: Map<string, StoreProxy> = new Map();

  constructor(
    dbConfig: DatabaseConfig | { defaultDatabase: DatabaseConfig } | DatabaseSchema, 
    options?: IndexedDBManagerOptions
  ) {
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
    
    if (options?.autoInit) {
      this.openDatabase().catch(error => {
        this.emitterInstance.emit('error', error);
      });
    }
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

  // Método para obtener información de schemas
  getSchemaInfo(): { current: DatabaseSchema | null, registered: string[] } {
    return {
      current: this.schemaManager.getSchema(),
      registered: Array.from(this.schemaManager['schemas'].keys())
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
    await this.openDatabase();
  }

  getCurrentDatabase(): DatabaseConfig {
    return this.dbConfig;
  }

  async getAll(): Promise<DatabaseItem[]> {
    return this.getAllData();
  }

  async addMany(items: Partial<DatabaseItem>[]): Promise<boolean> {
    return this.addManyToStore(this.dbConfig.store, items);
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
    return this.updateManyInStore(this.dbConfig.store, items);
  }

  async count(): Promise<number> {
    return this.countInStore(this.dbConfig.store);
  }

  async deleteMany(ids: (string | number)[]): Promise<boolean> {
    return this.deleteManyFromStore(this.dbConfig.store, ids);
  }

  async saveDataToStore(storeName: string, data: Partial<DatabaseItem>): Promise<DatabaseItem> {
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

    console.log(`Saving to store: ${storeName}, ID: ${targetId}, Action: ${actionType}`);

    return this.executeTransaction(
      storeName,
      "readwrite",
      (store: IDBObjectStore) => {
        return new Promise<DatabaseItem>((resolve, reject) => {
          const request = store.put(newData);
          request.onsuccess = () => resolve(newData);
          request.onerror = () => {
            console.error("Error in store.put:", request.error);
            reject(request.error);
          };
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

  async searchDataInStore(storeName: string, query: Partial<DatabaseItem>, options: SearchOptions = {}): Promise<SearchResult> {
    const allData = await this.getAllDataFromStore(storeName);
    
    if (Object.keys(query).length === 0) {
      let filteredData = [...allData];
      
      if (options.orderBy) {
        filteredData.sort((a, b) => {
          const aVal = a[options.orderBy!];
          const bVal = b[options.orderBy!];
          const direction = options.orderDirection === 'desc' ? -1 : 1;

          if (aVal == null && bVal == null) return 0;
          if (aVal == null) return 1 * direction;
          if (bVal == null) return -1 * direction;
          if (aVal < bVal) return -1 * direction;
          if (aVal > bVal) return 1 * direction;
          return 0;
        });
      }

      const total = filteredData.length;
      
      if (options.limit || options.offset) {
        const offset = options.offset || 0;
        const limit = options.limit || total;
        filteredData = filteredData.slice(offset, offset + limit);
      }

      const result: SearchResult<DatabaseItem> = {
        items: filteredData,
        total
      };
      
      if (options.offset && options.limit) {
        result.page = Math.floor(options.offset / options.limit) + (options.offset > 0 ? 2 : 1);
      }
      
      if (options.limit) {
        result.limit = options.limit;
      }
      
      return result;
    }
    
    let filteredData = allData.filter(item => {
      return Object.entries(query).every(([key, value]) => {
        if (value === undefined || value === null) return true;
        if (typeof value === 'string') {
          const fieldValue = String(item[key] || '');
          
          const isDomainSearch = value.includes('.');
          
          const commonExactValues = ['active', 'inactive', 'pending', 'draft', 'published', 'archived'];
          const isLikelyExactValue = commonExactValues.includes(value.toLowerCase());
          
          if (isDomainSearch && !isLikelyExactValue) {
            return fieldValue.toLowerCase().includes(value.toLowerCase());
          } else {
            return fieldValue.toLowerCase() === value.toLowerCase();
          }
        }
        return item[key] === value;
      });
    });

    if (options.orderBy) {
      filteredData.sort((a, b) => {
        const aVal = a[options.orderBy!];
        const bVal = b[options.orderBy!];
        const direction = options.orderDirection === 'desc' ? -1 : 1;

        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1 * direction;
        if (bVal == null) return -1 * direction;
        if (aVal < bVal) return -1 * direction;
        if (aVal > bVal) return 1 * direction;
        return 0;
      });
    }

    const total = filteredData.length;
    
    if (options.limit || options.offset) {
      const offset = options.offset || 0;
      const limit = options.limit || total;
      filteredData = filteredData.slice(offset, offset + limit);
    }

    const result: SearchResult<DatabaseItem> = {
      items: filteredData,
      total
    };
    
    if (options.limit) {
      if (options.offset) {
        result.page = Math.floor(options.offset / options.limit) + (options.offset > 0 ? 2 : 1);
      } else {
        result.page = 1;
      }
    }
    
    if (options.limit) {
      result.limit = options.limit;
    }
    
    return result;
  }

  async filterInStore(storeName: string, criteria: FilterCriteria): Promise<DatabaseItem[]> {
    const allData = await this.getAllDataFromStore(storeName);
    return allData.filter(item => {
      return Object.entries(criteria).every(([key, value]) => {
        if (value === undefined || value === null) return true;
        return item[key] === value;
      });
    });
  }

  async addManyToStore(storeName: string, items: Partial<DatabaseItem>[]): Promise<boolean> {
    const itemsToEmit: { actionType: EmitEvents, data: DatabaseItem }[] = [];

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

  async getStatsForStore(storeName: string): Promise<DatabaseStats> {
    const allData = await this.getAllDataFromStore(storeName);

    return {
      totalRecords: allData.length,
      storeName: storeName,
      databaseName: this.dbConfig.name,
      version: this.dbConfig.version
    };
  }

  private async idExistsInStore(storeName: string, id: string | number): Promise<boolean> {
    const normalizedId = normalizeId(id);
    
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

  async idExists(id: string | number): Promise<boolean> {
    return this.idExistsInStore(this.dbConfig.store, id);
  }

  async updateDataById(id: string | number, updatedData: Partial<DatabaseItem>): Promise<DatabaseItem | null> {
    return this.updateDataByIdInStore(this.dbConfig.store, id, updatedData);
  }

  async getDataById(id: string | number): Promise<DatabaseItem | null> {
    return this.getDataByIdFromStore(this.dbConfig.store, id);
  }

  async saveData(data: Partial<CreateDatabaseItem>): Promise<DatabaseItem> {
    return this.saveDataToStore(this.dbConfig.store, data);
  }

  async deleteData(id: string | number): Promise<string | number> {
    return this.deleteDataFromStore(this.dbConfig.store, id);
  }

  async getAllData(): Promise<DatabaseItem[]> {
    return this.getAllDataFromStore(this.dbConfig.store);
  }

  async searchData(query: Partial<DatabaseItem>, options: SearchOptions = {}): Promise<SearchResult> {
    return this.searchDataInStore(this.dbConfig.store, query, options);
  }

  async clearDatabase(): Promise<void> {
    return this.clearStore(this.dbConfig.store);
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
    const searchFields = options?.fields || ['name', 'title', 'description'];

    return allData.filter(item => {
      return searchFields.some(field => {
        const value = item[field];
        return typeof value === 'string' &&
               value.toLowerCase().includes(query.toLowerCase());
      });
    });
  }

  async filter(criteria: FilterCriteria): Promise<DatabaseItem[]> {
    return this.filterInStore(this.dbConfig.store, criteria);
  }

  async getMany(ids: (string | number)[]): Promise<DatabaseItem[]> {
    return this.getManyFromStore(this.dbConfig.store, ids);
  }

  async getStats(): Promise<DatabaseStats> {
    return this.getStatsForStore(this.dbConfig.store);
  }

  async openDatabase(): Promise<IDBDatabase> {
    if (this.db) return this.db;

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
            console.log(`Creating stores for schema: ${currentSchema.name}`);
            currentSchema.stores.forEach(storeConfig => {
              if (!db.objectStoreNames.contains(storeConfig.name)) {
                console.log(`Creating store: ${storeConfig.name}`);
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
                        console.log(`Index ${index.name} created for store ${storeConfig.name}.`);
                      }
                    } catch (indexError) {
                      console.error(`Error creating index ${index.name}:`, indexError);
                    }
                  });
                }
              } else {
                console.log(`Store ${storeConfig.name} already exists`);
              }
            });
          } else {
            if (!db.objectStoreNames.contains(this.dbConfig.store)) {
              console.log(`Creating legacy store: ${this.dbConfig.store}`);
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
                    console.log(`Index ${index.name} created for store ${this.dbConfig.store}.`);
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
          console.log(`Database ${this.dbConfig.name} opened successfully`);
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
      console.log(`Closing database ${this.dbConfig.name}`);
      this.db.close();
      this.db = null;
    }
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
    return {
      database: this.dbConfig.name,
      version: this.dbConfig.version,
      stores: Array.from(db.objectStoreNames),
      schema: this.schemaManager.getSchema(),
      proxies: this.storeProxies.size
    };
  }
}
