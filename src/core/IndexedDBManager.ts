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

/**
 * Proxy para operaciones específicas de un store
 */
export class StoreProxy {
  constructor(
    private manager: IndexedDBManager,
    private storeName: string
  ) {}

  async add(data: Partial<DatabaseItem>): Promise<DatabaseItem> {
    return this.manager.saveDataToStore(this.storeName, data);
  }

  async get(id: string | number): Promise<DatabaseItem | null> {
    return this.manager.getDataByIdFromStore(this.storeName, id);
  }

  async update(item: DatabaseItem): Promise<DatabaseItem | null> {
    const result = await this.manager.updateDataByIdInStore(this.storeName, item.id, item);
    return result;
  }

  async delete(id: string | number): Promise<boolean> {
    try {
      await this.manager.deleteDataFromStore(this.storeName, id);
      return true;
    } catch {
      return false;
    }
  }

  async getAll(): Promise<DatabaseItem[]> {
    return this.manager.getAllDataFromStore(this.storeName);
  }

  async clear(): Promise<void> {
    return this.manager.clearStore(this.storeName);
  }

  async count(): Promise<number> {
    return this.manager.countInStore(this.storeName);
  }

  async search(query: Partial<DatabaseItem>, options: SearchOptions = {}): Promise<SearchResult> {
    return this.manager.searchDataInStore(this.storeName, query, options);
  }

  async filter(criteria: FilterCriteria): Promise<DatabaseItem[]> {
    return this.manager.filterInStore(this.storeName, criteria);
  }

  async addMany(items: Partial<DatabaseItem>[]): Promise<boolean> {
    return this.manager.addManyToStore(this.storeName, items);
  }

  async updateMany(items: DatabaseItem[]): Promise<boolean> {
    return this.manager.updateManyInStore(this.storeName, items);
  }

  async deleteMany(ids: (string | number)[]): Promise<boolean> {
    return this.manager.deleteManyFromStore(this.storeName, ids);
  }

  async getMany(ids: (string | number)[]): Promise<DatabaseItem[]> {
    return this.manager.getManyFromStore(this.storeName, ids);
  }

  async getStats(): Promise<DatabaseStats> {
    return this.manager.getStatsForStore(this.storeName);
  }
}

/**
 * Gestor principal de IndexedDB con funcionalidades avanzadas y soporte multi-store
 */
export class IndexedDBManager {
  private dbConfig: DatabaseConfig;
  private dbSchema: DatabaseSchema | null = null;
  public emitterInstance: Emitter;
  private db: IDBDatabase | null;
  private defaultIndexes: DatabaseIndex[];
  private storeProxies: Map<string, StoreProxy> = new Map();

  constructor(
    dbConfig: DatabaseConfig | { defaultDatabase: DatabaseConfig } | DatabaseSchema, 
    options?: IndexedDBManagerOptions
  ) {
    // Handle different configuration types
    if ('stores' in dbConfig) {
      this.dbSchema = dbConfig;
      this.dbConfig = {
        name: dbConfig.name,
        version: dbConfig.version,
        store: dbConfig.stores[0]?.name || 'default'
      };
    } else {
      // Handle both direct DatabaseConfig and options object with defaultDatabase
      const actualConfig = 'defaultDatabase' in dbConfig ? dbConfig.defaultDatabase : dbConfig;
      
      if (!validateAnyDatabaseConfig(actualConfig)) {
        throw new Error('Invalid database configuration provided');
      }
      
      this.dbConfig = actualConfig;
    }
    
    // Inicializar el emitter (usar mock en tests)
    this.emitterInstance = emitter;
    this.db = null;
    this.defaultIndexes = [];
    
    if (options?.autoInit) {
      this.openDatabase().catch(error => {
        this.emitterInstance.emit('error', error);
      });
    }
  }

  /**
   * Inicializa la base de datos con un esquema completo
   */
  static async initializeWithSchema(schema: DatabaseSchema, options?: IndexedDBManagerOptions): Promise<IndexedDBManager> {
    const manager = new IndexedDBManager(schema, { ...options, autoInit: false });
    await manager.openDatabase();
    return manager;
  }

  /**
   * Obtiene un proxy para operaciones específicas de un store
   */
  store(storeName: string): StoreProxy {
    if (!this.storeProxies.has(storeName)) {
      this.storeProxies.set(storeName, new StoreProxy(this, storeName));
    }
    return this.storeProxies.get(storeName)!;
  }

  /**
   * Configura un esquema completo de base de datos
   */
  setSchema(schema: DatabaseSchema): void {
    this.dbSchema = schema;
    this.dbConfig = {
      name: schema.name,
      version: schema.version,
      store: schema.stores[0]?.name || 'default'
    };
  }

  // ==========================================
  // MÉTODOS EXISTENTES (RETROCOMPATIBILIDAD)
  // ==========================================

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

  // ==========================================
  // MÉTODOS MULTI-STORE (NUEVOS)
  // ==========================================

  async saveDataToStore(storeName: string, data: Partial<DatabaseItem>): Promise<DatabaseItem> {
    if (typeof data !== "object" || data === null) {
      return Promise.reject(new Error("Invalid data: must be an object."));
    }

    const hasExplicitId = isValidId(data.id);
    let targetId: string | number;
    let isUpdate = false;

    if (hasExplicitId) {
      targetId = normalizeId(data.id as string | number);
      isUpdate = await this.idExistsInStore(storeName, targetId);
    } else {
      // Use timestamp-based ID for better concurrency handling
      targetId = Date.now() + Math.floor(Math.random() * 1000);
      isUpdate = false;
    }
    
    const newData: DatabaseItem = { ...data, id: targetId } as DatabaseItem;
    const actionType: EmitEvents = isUpdate ? "update" : "add";

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
    
    // If query is empty, return all data
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
    
    // Filter data based on query criteria
    let filteredData = allData.filter(item => {
      return Object.entries(query).every(([key, value]) => {
        if (value === undefined || value === null) return true;
        if (typeof value === 'string') {
          const fieldValue = String(item[key] || '');
          
          // Check if this looks like a domain search (contains dots)
          const isDomainSearch = value.includes('.');
          
          // Check if this looks like a partial search (short strings that don't match common exact values)
          const commonExactValues = ['active', 'inactive', 'pending', 'draft', 'published', 'archived'];
          const isLikelyExactValue = commonExactValues.includes(value.toLowerCase());
          
          if (isDomainSearch && !isLikelyExactValue) {
            // Partial matching for domain searches like 'test.com'
            return fieldValue.toLowerCase().includes(value.toLowerCase());
          } else {
            // Exact matching for status values and other exact criteria
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
  // en la clase IndexedDBManager

  async addManyToStore(storeName: string, items: Partial<DatabaseItem>[]): Promise<boolean> {
    const itemsToEmit: { actionType: EmitEvents, data: DatabaseItem }[] = [];

    return this.executeTransaction(storeName, "readwrite", async (store) => {
      // Get all existing data within the transaction
      const allDataInStore = await new Promise<DatabaseItem[]>((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      const existingIds = new Set(allDataInStore.map(d => d.id));
      const itemsToAdd: DatabaseItem[] = [];

      // Process all items and assign IDs within the transaction scope
      for (const item of items) {
        let targetId: string | number;
        let isUpdate = false;

        if (isValidId(item.id)) {
          targetId = normalizeId(item.id as string | number);
          isUpdate = existingIds.has(targetId);
        } else {
          // Generate unique ID considering existing data and items already processed in this batch
          const currentDataForIdGen = [...allDataInStore, ...itemsToAdd];
          targetId = generateNextId(currentDataForIdGen);
        }

        const newData = { ...item, id: targetId } as DatabaseItem;
        itemsToAdd.push(newData);

        const actionType: EmitEvents = isUpdate ? "update" : "add";
        itemsToEmit.push({ actionType, data: newData });
      }

      // Execute all put operations
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
    const itemsToEmit = [...items]; // Copy items for event emission

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
    const idsToEmit = ids.map(normalizeId); // Copy normalized IDs for event emission

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

  // ==========================================
  // MÉTODOS EXISTENTES (MANTENIDOS PARA COMPATIBILIDAD)
  // ==========================================

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

  // ==========================================
  // MÉTODOS DE INFRAESTRUCTURA
  // ==========================================

  async openDatabase(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise<IDBDatabase>((resolve, reject) => {
      if (!this.dbSchema && !validateAnyDatabaseConfig(this.dbConfig)) {
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
          if (this.dbSchema) {
            // Crear stores basado en el schema
            this.dbSchema.stores.forEach(storeConfig => {
              if (!db.objectStoreNames.contains(storeConfig.name)) {
                const objectStore = db.createObjectStore(storeConfig.name, {
                  keyPath: storeConfig.keyPath || "id",
                  autoIncrement: storeConfig.autoIncrement || false,
                });

                // Crear índices para este store
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
            // Modo de compatibilidad - crear store único
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
        return reject(new Error(errorMsg));
      }

      let transaction: IDBTransaction;
      try {
        transaction = db.transaction(storeName, mode);
      } catch (error) {
        return reject(error);
      }

      // -- Lógica de Sincronización --
      let callbackResult: T | undefined;
      let callbackError: any;
      let isCallbackDone = false;
      let isTransactionDone = false;

      // Esta función se llamará cuando cada parte (callback, transacción) termine.
      // Solo resolverá la promesa principal cuando AMBAS hayan terminado.
      const checkCompletion = () => {
        if (isCallbackDone && isTransactionDone) {
          if (callbackError) {
            reject(callbackError);
          } else {
            resolve(callbackResult as T);
          }
        }
      };
      // -----------------------------

      transaction.oncomplete = () => {
        isTransactionDone = true;
        checkCompletion(); // La transacción terminó, veamos si el callback también lo hizo.
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };

      transaction.onabort = () => {
        reject(transaction.error || new Error("Transaction aborted"));
      };

      try {
        // Ejecutamos el callback y nos aseguramos de que sea una promesa
        Promise.resolve(callback(transaction.objectStore(storeName)))
          .then(result => {
            callbackResult = result;
            isCallbackDone = true;
            checkCompletion(); // El callback terminó, veamos si la transacción también lo hizo.
          })
          .catch(err => {
            callbackError = err;
            isCallbackDone = true;
            // Si el callback falla, no esperamos a la transacción, la abortamos.
            // El manejador onabort/onerror se encargará de rechazar la promesa principal.
            if (transaction.abort) {
              transaction.abort();
            } else {
              // Si no hay abort, rechazamos directamente.
               checkCompletion();
            }
          });
      } catch (error) {
        // Error síncrono en el callback
        reject(error);
        if (transaction.abort) {
          transaction.abort();
        }
      }
    });
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
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
}
