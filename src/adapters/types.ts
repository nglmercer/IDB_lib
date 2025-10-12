// src/adapters/types.ts
export interface StorageAdapter {
  openDatabase(name: string, version: number): Promise<any>;
  transaction(storeName: string, mode: 'readonly' | 'readwrite'): any;
  createObjectStore(db: any, name: string, options: any): any;
  get(store: any, key: any): Promise<any>;
  put(store: any, value: any): Promise<any>;
  delete(store: any, key: any): Promise<any>;
  getAll(store: any): Promise<any[]>;
  clear(store: any): Promise<void>;
  count(store: any): Promise<number>;
  close(db: any): void;
}