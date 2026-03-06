// Cursor helper module

import type { CursorOptions } from '../types.js';

/**
 * Callback for cursor iteration
 */
export type CursorCallback<T = any> = (value: T, cursor: IDBCursor) => boolean | void;

/**
 * Cursor iteration options
 */
export interface ExtendedCursorOptions extends CursorOptions {
  indexName?: string;
  query?: any;
}

/**
 * Cursor helper class for iteration operations
 */
export class CursorHelper {
  private db: IDBDatabase;
  private storeName: string;
  private options: ExtendedCursorOptions;

  constructor(db: IDBDatabase, storeName: string, options: ExtendedCursorOptions = {}) {
    this.db = db;
    this.storeName = storeName;
    this.options = options;
  }

  /**
   * Iterate over all records using a cursor
   */
  async iterate<T = any>(callback: CursorCallback<T>): Promise<void> {
    const { indexName, query, direction = 'next', limit, offset } = this.options;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      let request: IDBRequest<IDBCursorWithValue | null>;
      
      if (indexName) {
        const index = store.index(indexName);
        request = index.openCursor(query, direction);
      } else {
        request = store.openCursor(query, direction);
      }
      
      let index = 0;
      let skipped = 0;

      request.onsuccess = () => {
        const cursor = request.result;
        
        if (!cursor) {
          resolve();
          return;
        }

        // Handle offset
        if (offset && skipped < offset) {
          skipped++;
          cursor.continue();
          return;
        }

        const shouldContinue = callback(cursor.value as T, cursor);
        
        if (shouldContinue === false) {
          resolve();
          return;
        }

        // Handle limit
        if (limit && index >= limit - 1) {
          resolve();
          return;
        }

        index++;
        cursor.continue();
      };

      request.onerror = () => reject(new Error(`Cursor iteration failed: ${request.error?.message}`));
    });
  }

  /**
   * Collect all records from cursor iteration
   */
  async collect<T = any>(maxLimit?: number): Promise<T[]> {
    const results: T[] = [];
    
    await this.iterate<T>((value) => {
      results.push(value);
      
      if (maxLimit && results.length >= maxLimit) {
        return false;
      }
      return undefined;
    });
    
    return results;
  }

  /**
   * Find first matching record
   */
  async find<T = any>(predicate: (value: T) => boolean): Promise<T | null> {
    let result: T | null = null;
    
    await this.iterate<T>((value) => {
      if (predicate(value)) {
        result = value;
        return false;
      }
      return undefined;
    });
    
    return result;
  }

  /**
   * Map cursor values to another array
   */
  async map<T = any, R = any>(transform: (value: T) => R): Promise<R[]> {
    const results: R[] = [];
    
    await this.iterate<T>((value) => {
      results.push(transform(value));
      return undefined;
    });
    
    return results;
  }

  /**
   * Check if any record matches predicate
   */
  async some<T = any>(predicate: (value: T) => boolean): Promise<boolean> {
    let found = false;
    
    await this.iterate<T>((value) => {
      if (predicate(value)) {
        found = true;
        return false;
      }
      return undefined;
    });
    
    return found;
  }

  /**
   * Check if all records match predicate
   */
  async every<T = any>(predicate: (value: T) => boolean): Promise<boolean> {
    let allMatch = true;
    
    await this.iterate<T>((value) => {
      if (!predicate(value)) {
        allMatch = false;
        return false;
      }
      return undefined;
    });
    
    return allMatch;
  }

  /**
   * Reduce cursor values
   */
  async reduce<T = any, R = any>(
    reducer: (accumulator: R, value: T) => R, 
    initialValue: R
  ): Promise<R> {
    let accumulator = initialValue;
    
    await this.iterate<T>((value: T) => {
      accumulator = reducer(accumulator, value);
    });
    
    return accumulator;
  }

  /**
   * Count records
   */
  async count(): Promise<number> {
    let count = 0;
    
    await this.iterate(() => {
      count++;
    });
    
    return count;
  }

  /**
   * Check if empty
   */
  async isEmpty(): Promise<boolean> {
    let hasRecords = false;
    
    await this.iterate(() => {
      hasRecords = true;
      return false;
    });
    
    return !hasRecords;
  }
}

/**
 * Create a cursor helper
 */
export function createCursor(
  db: IDBDatabase,
  storeName: string,
  options: ExtendedCursorOptions = {}
): CursorHelper {
  return new CursorHelper(db, storeName, options);
}

/**
 * Simple cursor iteration function
 */
export async function iterateCursor<T = any>(
  db: IDBDatabase,
  storeName: string,
  callback: CursorCallback<T>,
  options: ExtendedCursorOptions = {}
): Promise<void> {
  const helper = new CursorHelper(db, storeName, options);
  return helper.iterate(callback);
}

/**
 * Search by index with cursor
 */
export async function searchByIndex(
  db: IDBDatabase,
  storeName: string,
  indexName: string,
  query: any,
  limit?: number
): Promise<any[]> {
  const helper = new CursorHelper(db, storeName, { indexName, query, limit: limit ?? 0 });
  return helper.collect(limit);
}
