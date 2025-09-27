import { Emitter, emitter } from './Emitter.js';
import {
  normalizeId,
  isValidId,
  generateNextId,
  validateDatabaseConfig,
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
  DatabaseStats
} from '../types/index.js';

/**
 * Gestor principal de IndexedDB con funcionalidades avanzadas
 */
export class IndexedDBManager {
  private dbConfig: DatabaseConfig;
  public emitterInstance: Emitter;
  private db: IDBDatabase | null;
  private defaultIndexes: DatabaseIndex[];

  constructor(dbConfig: DatabaseConfig | { defaultDatabase: DatabaseConfig }, options?: IndexedDBManagerOptions) {
    // Handle both direct DatabaseConfig and options object with defaultDatabase
    const actualConfig = 'defaultDatabase' in dbConfig ? dbConfig.defaultDatabase : dbConfig;
    
    if (!validateDatabaseConfig(actualConfig)) {
      throw new Error('Invalid database configuration provided');
    }
    
    this.dbConfig = actualConfig;
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
   * Set the emitter instance (for testing)
   */
  setEmitterInstance(emitterInstance: Emitter): void {
    this.emitterInstance = emitterInstance;
  }

  /**
   * Refresh emitter instance from global mock if available
   */
  refreshEmitterInstance(): void {
    this.emitterInstance = emitter;//(globalThis as any).__mockEmitter || 
  }

  /**
   * Configura índices por defecto para el object store
   */
  setDefaultIndexes(indexes: DatabaseIndex[]): void {
    this.defaultIndexes = indexes;
  }

  /**
   * Establece una nueva configuración de base de datos
   */
  async setDatabase(config: DatabaseConfig): Promise<void> {
    if (!validateDatabaseConfig(config)) {
      throw new Error('Invalid database configuration provided');
    }
    
    // Cerrar conexión actual si existe
    this.close();
    
    // Actualizar configuración
    this.dbConfig = config;
    
    // Abrir nueva conexión
    await this.openDatabase();
  }

  /**
   * Obtiene la configuración actual de la base de datos
   */
  getCurrentDatabase(): DatabaseConfig {
    return this.dbConfig;
  }

  /**
   * Obtiene todos los datos de la base de datos
   */
  async getAll(): Promise<DatabaseItem[]> {
    return this.getAllData();
  }

  /**
   * Agrega múltiples elementos a la base de datos
   */
  async addMany(items: Partial<DatabaseItem>[]): Promise<boolean> {
    try {
      for (const item of items) {
        await this.saveData(item);
      }
      return true;
    } catch (error) {
      console.error('Error adding multiple items:', error);
      return false;
    }
  }

  /**
   * Escucha eventos del emisor
   */
  on(event: EmitEvents, callback: EventCallback): void;
  on(event: string, callback: EventCallback): void;
  on(event: string, callback: EventCallback): void {
    this.emitterInstance.on(event, callback);
  }

  /**
   * Deja de escuchar eventos del emisor
   */
  off(event: EmitEvents, callback: EventCallback): void;
  off(event: string, callback: EventCallback): void;
  off(event: string, callback: EventCallback): void {
    this.emitterInstance.off(event, callback as EventCallback<unknown>);
  }

  /**
   * Agrega un elemento a la base de datos (alias para saveData)
   */
  async add(data: Partial<DatabaseItem>): Promise<DatabaseItem> {
    return this.saveData(data);
  }

  /**
   * Actualiza múltiples elementos en la base de datos
   */
  async updateMany(items: DatabaseItem[]): Promise<boolean> {
    try {
      for (const item of items) {
        await this.updateDataById(item.id, item);
      }
      return true;
    } catch (error) {
      console.error('Error updating multiple items:', error);
      return false;
    }
  }

  /**
   * Cuenta el número total de elementos en la base de datos
   */
  async count(): Promise<number> {
    return this.executeTransaction(
      this.dbConfig.store,
      "readonly",
      (store: IDBObjectStore) => {
        return new Promise<number>((resolve, reject) => {
          const request = store.count();
          
          request.onsuccess = () => {
            resolve(request.result);
          };
          
          request.onerror = () => reject(request.error);
        });
      }
    );
  }

  /**
   * Elimina múltiples elementos por sus IDs
   */
  async deleteMany(ids: (string | number)[]): Promise<boolean> {
    try {
      for (const id of ids) {
        await this.deleteData(id);
      }
      return true;
    } catch (error) {
      console.error('Error deleting multiple items:', error);
      return false;
    }
  }

  /**
   * Verifica si un ID existe en la base de datos
   */
  private async idExists(id: string | number): Promise<boolean> {
    const normalizedId = normalizeId(id);
    
    return this.executeTransaction(
      this.dbConfig.store,
      "readonly",
      (store: IDBObjectStore) => {
        return new Promise<boolean>((resolve, reject) => {
          const request = store.get(normalizedId);
          
          request.onsuccess = () => {
            resolve(request.result !== undefined);
          };
          
          request.onerror = () => reject(request.error);
        });
      }
    );
  }

  /**
   * Actualiza un elemento por su ID
   */
  async updateDataById(
    id: string | number,
    updatedData: Partial<DatabaseItem>
  ): Promise<DatabaseItem | null> {
    if (!isValidId(id)) {
      throw new Error("Invalid ID provided for update");
    }

    const normalizedId = normalizeId(id);
    const exists = await this.idExists(normalizedId);
    
    if (!exists) {
      return null; // El elemento no existe, no se puede actualizar
    }

    return this.executeTransaction(
      this.dbConfig.store,
      "readwrite",
      (store: IDBObjectStore) => {
        return new Promise<DatabaseItem | null>((resolve, reject) => {
          const getRequest = store.get(normalizedId);

          getRequest.onsuccess = () => {
            if (getRequest.result) {
              const newData: DatabaseItem = {
                ...getRequest.result,
                ...updatedData,
                id: normalizedId, // Mantener el ID original normalizado
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

  /**
   * Obtiene un elemento por su ID
   */
  async getDataById(id: string | number): Promise<DatabaseItem | null> {
    if (!isValidId(id)) {
      return null;
    }

    const normalizedId = normalizeId(id);
    
    return this.executeTransaction(
      this.dbConfig.store,
      "readonly",
      (store: IDBObjectStore) => {
        return new Promise<DatabaseItem | null>((resolve, reject) => {
          const request = store.get(normalizedId);

          request.onsuccess = () => {
            resolve(request.result || null);
          };

          request.onerror = () => reject(request.error);
        });
      }
    );
  }

  /**
   * Guarda datos en la base de datos
   */
  async saveData(data: Partial<DatabaseItem>): Promise<DatabaseItem> {
    if (typeof data !== "object" || data === null) {
      return Promise.reject(new Error("Invalid data: must be an object."));
    }

    let targetId: string | number;
    let isUpdate = false;

    // Verificar si se proporcionó un ID explícito
    const hasExplicitId = isValidId(data.id);
    if (hasExplicitId) {
      targetId = normalizeId(data.id as string | number);
      isUpdate = await this.idExists(targetId);
    } else {
      // Generar nuevo ID
      const allData = await this.getAllData();
      targetId = generateNextId(allData);
      isUpdate = false;
    }
    
    const newData: DatabaseItem = { ...data, id: targetId } as DatabaseItem;
    const actionType: EmitEvents = isUpdate ? "update" : "add";

    return this.executeTransaction(
      this.dbConfig.store,
      "readwrite",
      (store: IDBObjectStore) => {
        return new Promise<DatabaseItem>((resolve, reject) => {
          const request = store.put(newData);

          request.onsuccess = () => {
            resolve(newData);
          };

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

  /**
   * Elimina un elemento por su ID
   */
  async deleteData(id: string | number): Promise<string | number> {
    if (!isValidId(id)) {
      throw new Error("Invalid ID provided for deletion");
    }

    const keyId = normalizeId(id);

    return this.executeTransaction(
      this.dbConfig.store,
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

  /**
   * Abre la conexión a la base de datos
   */
  async openDatabase(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise<IDBDatabase>((resolve, reject) => {
      if (!validateDatabaseConfig(this.dbConfig)) {
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
          if (!db.objectStoreNames.contains(this.dbConfig.store)) {
            // Crear nuevo object store
            const objectStore = db.createObjectStore(this.dbConfig.store, {
              keyPath: "id",
              autoIncrement: false,
            });

            // Añadir índices al nuevo store
            this.defaultIndexes.forEach((index) => {
              try {
                if (!objectStore.indexNames.contains(index.name)) {
                  objectStore.createIndex(index.name, index.keyPath, {
                    unique: index.unique,
                  });
                  console.log(`Index ${index.name} created for new store ${this.dbConfig.store}.`);
                }
              } catch (indexError) {
                console.error(`Error creating index ${index.name}:`, indexError);
              }
            });
            
            console.log(`Object store ${this.dbConfig.store} created with indexes.`);
          } else {
            // Store existe, verificar y añadir índices faltantes
            const objectStore = transaction.objectStore(this.dbConfig.store);
            this.defaultIndexes.forEach((index) => {
              try {
                if (!objectStore.indexNames.contains(index.name)) {
                  objectStore.createIndex(index.name, index.keyPath, {
                    unique: index.unique,
                  });
                  console.log(`Index ${index.name} created for existing store ${this.dbConfig.store}.`);
                }
              } catch (indexError) {
                console.error(`Error creating index ${index.name}:`, indexError);
              }
            });
          }
        } catch (upgradeError) {
          console.error('Error during database upgrade:', upgradeError);
          // No rechazamos aquí, dejamos que el evento onerror maneje el error
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

  /**
   * Ejecuta una transacción de forma segura
   */
  async executeTransaction<T>(
    storeName: string,
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => T | Promise<T>
  ): Promise<T> {
    try {
      if (!this.db) {
        await this.openDatabase();
        if (!this.db) {
          throw new Error('Database not open. Call openDatabase() first.');
        }
      }
      const db = this.db;

      return new Promise<T>((resolve, reject) => {
        if (!db || !db.objectStoreNames.contains(storeName)) {
          console.error(`DB not open or store ${storeName} not found`);
          console.error(`Available stores:`, db ? Array.from(db.objectStoreNames) : 'No DB');
          return reject(
            new Error(`DB not open or store ${storeName} not found`)
          );
        }

        const transaction = db.transaction([storeName], mode);
        const store = transaction.objectStore(storeName);
        let result: T;
        let hasResult = false;

        transaction.oncomplete = () => {
          if (hasResult) {
            resolve(result);
          } else {
            reject(new Error('Transaction completed but no result was set'));
          }
        };
          
        transaction.onerror = () => {
          console.error("IDB Transaction Error:", transaction.error);
          reject(transaction.error);
        };
        
        transaction.onabort = () => {
          console.warn("IDB Transaction Aborted:", transaction.error);
          reject(transaction.error || new Error("Transaction aborted"));
        };

        try {
          const callbackResult = callback(store);

          if (callbackResult instanceof Promise) {
            callbackResult
              .then((res) => {
                result = res;
                hasResult = true;
                // Para promesas, esperamos a que la transacción se complete
                // Si la transacción ya se completó, resolvemos inmediatamente
                  resolve(result);

              })
              .catch((err) => {
                console.error(
                  "Error inside transaction callback promise:",
                  err
                );
                if (!transaction.error) {
                  transaction.abort();
                }
                reject(err);
              });
          } else {
            result = callbackResult;
            hasResult = true;
            // Para resultados síncronos, resolvemos inmediatamente
            resolve(result);
            return;
          }
        } catch (error) {
          console.error("Error inside transaction callback sync:", error);
          if (!transaction.error) {
            transaction.abort();
          }
          reject(error);
        }
      });
    } catch (dbOpenError) {
      console.error("Failed to open DB for transaction:", dbOpenError);
      return Promise.reject(dbOpenError);
    }
  }

  /**
   * Obtiene todos los datos del store
   */
  async getAllData(): Promise<DatabaseItem[]> {
    return this.executeTransaction(
      this.dbConfig.store,
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

  /**
   * Busca datos con opciones avanzadas
   */
  async searchData(query: Partial<DatabaseItem>, options: SearchOptions = {}): Promise<SearchResult> {
    const allData = await this.getAllData();
    
    // Filtrar datos según la query
    let filteredData = allData.filter(item => {
      return Object.entries(query).every(([key, value]) => {
        if (typeof value === 'string') {
          return String(item[key]).toLowerCase().includes(value.toLowerCase());
        }
        return item[key] === value;
      });
    });

    // Ordenamiento
    if (options.orderBy) {
      filteredData.sort((a, b) => {
        const aVal = a[options.orderBy!];
        const bVal = b[options.orderBy!];
        const direction = options.orderDirection === 'desc' ? -1 : 1;

        // Manejar valores null/undefined
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1 * direction;
        if (bVal == null) return -1 * direction;

        // Comparación segura de valores
        if (aVal < bVal) return -1 * direction;
        if (aVal > bVal) return 1 * direction;
        return 0;
      });
    }

    const total = filteredData.length;
    
    // Paginación
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
      result.page = Math.floor(options.offset / options.limit) + 1;
    }
    
    if (options.limit) {
      result.limit = options.limit;
    }
    
    return result;
  }

  /**
   * Limpia toda la base de datos
   */
  async clearDatabase(): Promise<void> {
    return this.executeTransaction(
      this.dbConfig.store,
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

  /**
   * Cierra la conexión a la base de datos
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Emite un evento con metadatos
   */
  private emitEvent(event: EmitEvents, data: DatabaseItem | number | null): void {
    const eventData: EmitEventData = {
      config: this.dbConfig,
      data,
      metadata: {
        timestamp: createTimestamp(),
        operation: event
      }
    }
    //(globalThis as any).__mockEmitter ||  only test
    this.emitterInstance?.emit(event, eventData);
  }

  /**
   * Obtiene un elemento por su ID
   */
  async get(id: string | number): Promise<DatabaseItem | null> {
    return this.executeTransaction(
      this.dbConfig.store,
      'readonly',
      async (store) => {
        const request = store.get(id);
        return new Promise<DatabaseItem | null>((resolve, reject) => {
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error);
        });
      }
    );
  }

  /**
   * Actualiza un elemento existente
   */
  async update(item: DatabaseItem): Promise<DatabaseItem> {
    const result = await this.executeTransaction(
      this.dbConfig.store,
      'readwrite',
      async (store) => {
        const request = store.put(item);
        return new Promise<DatabaseItem>((resolve, reject) => {
          request.onsuccess = () => resolve(item);
          request.onerror = () => reject(request.error);
        });
      }
    );
    
    this.emitEvent('update', result);
    return result;
  }

  /**
   * Elimina un elemento por su ID
   */
  async delete(id: string | number): Promise<boolean> {
    const result = await this.executeTransaction(
      this.dbConfig.store,
      'readwrite',
      async (store) => {
        const request = store.delete(id);
        return new Promise<boolean>((resolve, reject) => {
          request.onsuccess = () => resolve(true);
          request.onerror = () => reject(request.error);
        });
      }
    );
    
    this.emitEvent('delete', null);
    return result;
  }

  /**
   * Limpia todos los datos del store
   */
  async clear(): Promise<void> {
    await this.clearDatabase();
  }

  /**
   * Busca elementos por texto
   */
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

  /**
   * Filtra elementos por criterios
   */
  async filter(criteria: FilterCriteria): Promise<DatabaseItem[]> {
    const allData = await this.getAllData();

    return allData.filter(item => {
      return Object.entries(criteria).every(([key, value]) => {
        return item[key] === value;
      });
    });
  }

  /**
   * Obtiene múltiples elementos por sus IDs
   */
  async getMany(ids: (string | number)[]): Promise<DatabaseItem[]> {
    const results: DatabaseItem[] = [];
    
    for (const id of ids) {
      const item = await this.get(id);
      if (item) {
        results.push(item);
      }
    }
    
    return results;
  }

  /**
   * Obtiene estadísticas de la base de datos
   */
  async getStats(): Promise<DatabaseStats> {
    const allData = await this.getAllData();

    return {
      totalRecords: allData.length,
      storeName: this.dbConfig.store,
      databaseName: this.dbConfig.name,
      version: this.dbConfig.version
    };
  }
}
