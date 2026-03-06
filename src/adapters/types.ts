// src/adapters/types.ts

// Default generic type for flexibility
export type T = any;

// Store information passed to adapter operations
export interface StoreInfo {
  db: any;
  storeName: string;
}

// Transaction mode type
export type TransactionMode = 'readonly' | 'readwrite';

// Database configuration
export interface DatabaseConfig {
  name: string;
  version: number;
  store?: string;
}

// Object store options
export interface ObjectStoreOptions {
  keyPath?: string | string[];
  autoIncrement?: boolean;
  indexes?: IndexDefinition[];
}

// Index definition
export interface IndexDefinition {
  name: string;
  keyPath: string | string[];
  unique?: boolean;
  multiEntry?: boolean;
}

// Cursor options
export interface CursorOptions {
  direction?: 'next' | 'nextunique' | 'prev' | 'prevunique';
  limit?: number;
  offset?: number;
}

// Batch operation item
export interface BatchItem {
  key?: any;
  value: any;
}

// Database info
export interface DatabaseInfo {
  name: string;
  version: number;
}

// Storage Adapter Interface with extensive any types
export interface StorageAdapter {
  // Database operations
  openDatabase(name: string, version: number): Promise<any>;
  close(db: any): void;
  deleteDatabase(name: string): Promise<void>;
  
  // Transaction
  transaction(storeName: string, mode: TransactionMode): any;
  
  // Object store operations
  createObjectStore(db: any, name: string, options?: any): any;
  
  // CRUD operations
  get(store: StoreInfo, key: any): Promise<any>;
  put(store: StoreInfo, value: any, key?: any): Promise<any>;
  add(store: StoreInfo, value: any, key?: any): Promise<any>;
  delete(store: StoreInfo, key: any): Promise<any>;
  
  // Bulk operations
  getAll(store: StoreInfo): Promise<any[]>;
  putMany(store: StoreInfo, items: BatchItem[]): Promise<any[]>;
  deleteMany(store: StoreInfo, keys: any[]): Promise<void>;
  getMany(store: StoreInfo, keys: any[]): Promise<any[]>;
  
  // Utility operations
  clear(store: StoreInfo): Promise<void>;
  count(store: StoreInfo, query?: any): Promise<number>;
  
  // Index operations
  createIndex(db: any, storeName: string, indexName: string, keyPath: any, options?: any): any;
  deleteIndex(db: any, storeName: string, indexName: string): void;
  getAllFromIndex(store: StoreInfo, indexName: string, query?: any): Promise<any[]>;
  
  // Cursor operations
  iterate(store: StoreInfo, callback: any, options?: CursorOptions): Promise<void>;
  searchByIndex(store: StoreInfo, indexName: string, query: any, limit?: number): Promise<any[]>;
  
  // Database info
  getDatabaseNames(): Promise<string[]>;
  getDatabaseInfo(): Promise<DatabaseInfo[]>;
  databaseExists(name: string): Promise<boolean>;
  clearAll(): Promise<void>;
  
  // Upgrade handler
  onUpgrade(name: string, handler: any): void;
  
  // Object store names
  getObjectStoreNames(db: any): string[];
}

// Legacy type alias for backward compatibility
export type Adapter = StorageAdapter;
