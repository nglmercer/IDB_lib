// Schema Manager - Manages database schemas

import type { DatabaseSchema } from '../../types/index.js';

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

  /**
   * Get all registered schema names
   */
  getRegisteredSchemas(): string[] {
    return Array.from(this.schemas.keys());
  }

  /**
   * Clear all schemas
   */
  clear(): void {
    this.schemas.clear();
    this.activeSchema = null;
  }

  /**
   * Remove a specific schema
   */
  removeSchema(name: string): boolean {
    return this.schemas.delete(name);
  }
}

export default SchemaManager;
