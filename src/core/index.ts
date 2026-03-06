// Core module exports

// Re-export from separate modular files
export { SchemaManager } from './schema/SchemaManager.js';
export { StoreProxy } from './proxy/StoreProxy.js';
export { Emitter, emitter } from './Emitter.js';
export { IndexedDBManager } from './IndexedDBManager.js';

// Re-export database modules
export { DatabaseOperations } from './database/DatabaseOperations.js';
export { BatchOperations } from './database/BatchOperations.js';
export { SearchEngine } from './database/SearchEngine.js';
export { TransactionManager } from './database/TransactionManager.js';
