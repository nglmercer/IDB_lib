// Store Proxy - Provides a proxy interface for store operations

import type { 
  DatabaseItem, 
  SearchOptions, 
  SearchResult, 
  FilterCriteria, 
  DatabaseStats 
} from '../../types/index.js';

// Forward declaration type
type IndexedDBManagerType = any;

export class StoreProxy<T extends DatabaseItem = DatabaseItem> {
  private _manager: IndexedDBManagerType;
  private _storeName: string;
  private _instanceId: string;

  constructor(manager: IndexedDBManagerType, storeName: string) {
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

  async add(data: Partial<T>): Promise<T> {
    return this._manager.saveDataToStore(this._storeName, data);
  }

  async get(id: string | number): Promise<T | null> {
    return this._manager.getDataByIdFromStore(this._storeName, id);
  }

  async update(item: T): Promise<T | null> {
    return this._manager.updateDataByIdInStore(this._storeName, item.id!, item);
  }

  async delete(id: string | number): Promise<boolean> {
    try {
      await this._manager.deleteDataFromStore(this._storeName, id);
      return true;
    } catch {
      return false;
    }
  }

  async getAll(): Promise<T[]> {
    return this._manager.getAllDataFromStore(this._storeName);
  }

  async clear(): Promise<void> {
    return this._manager.clearStore(this._storeName);
  }

  async count(): Promise<number> {
    return this._manager.countInStore(this._storeName);
  }

  async search(query: Partial<T>, options: SearchOptions = {}): Promise<SearchResult<T>> {
    return this._manager.searchDataInStore(this._storeName, query, options);
  }

  async filter(criteria: FilterCriteria): Promise<T[]> {
    return this._manager.filterInStore(this._storeName, criteria);
  }

  async addMany(items: Partial<T>[]): Promise<boolean> {
    return this._manager.addManyToStore(this._storeName, items);
  }

  async updateMany(items: T[]): Promise<boolean> {
    return this._manager.updateManyInStore(this._storeName, items);
  }

  async deleteMany(ids: (string | number)[]): Promise<boolean> {
    return this._manager.deleteManyFromStore(this._storeName, ids);
  }

  async getMany(ids: (string | number)[]): Promise<T[]> {
    return this._manager.getManyFromStore(this._storeName, ids);
  }

  async getStats(): Promise<DatabaseStats> {
    return this._manager.getStatsForStore(this._storeName);
  }
}

export default StoreProxy;
