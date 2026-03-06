// Re-export from modular structure for backward compatibility
export { BrowserAdapter, default } from './browser/index.js';
export { 
  TransactionManager, 
  createTransaction, 
  executeRequest, 
  executeBatchRequests 
} from './browser/transaction.js';
export { 
  CursorHelper, 
  createCursor, 
  iterateCursor, 
  searchByIndex 
} from './browser/cursor.js';
export type { CursorOptions } from './browser/index.js';
export type { UpgradeHandler } from './browser/index.js';
export type { StoreInfo } from './types.js';
