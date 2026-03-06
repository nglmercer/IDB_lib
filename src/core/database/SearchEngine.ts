/**
 * SearchEngine - Handles search and filter operations
 */

import type { DatabaseItem, SearchOptions, SearchResult, FilterCriteria, SearchTextOptions } from '../../types/index.js';

export interface SearchEngineOptions {
  getAllDataFromStore: (storeName: string) => Promise<DatabaseItem[]>;
}

export class SearchEngine {
  private getAllDataFromStore: (storeName: string) => Promise<DatabaseItem[]>;

  constructor(options: SearchEngineOptions) {
    this.getAllDataFromStore = options.getAllDataFromStore;
  }

  updateContext(options: Partial<SearchEngineOptions>): void {
    if (options.getAllDataFromStore !== undefined) {
      this.getAllDataFromStore = options.getAllDataFromStore;
    }
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

  async search(allData: DatabaseItem[], query: string, options?: SearchTextOptions): Promise<DatabaseItem[]> {
    const searchFields = options?.fields || ['name', 'title', 'description'];

    return allData.filter(item => {
      return searchFields.some(field => {
        const value = item[field];
        return typeof value === 'string' &&
               value.toLowerCase().includes(query.toLowerCase());
      });
    });
  }
}

export default SearchEngine;
