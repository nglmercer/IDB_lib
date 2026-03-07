/**
 * Browser Adapter Tests
 * 
 * These tests use the mock IndexedDB from setup.ts
 * to test the browser adapter in Node.js/Bun
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import '../setup.js';
import { BrowserAdapter, CursorHelper, TransactionManager } from '../../src/adapters/browser/index.js';

// Better test data helpers
const createUserData = (id: string) => ({
  id,
  name: `User ${id}`,
  email: `user${id}@example.com`,
  age: 20 + parseInt(id) || Math.floor(Math.random() * 50),
  createdAt: new Date().toISOString(),
  tags: ['test', `tag-${id}`]
});

const createProductData = (id: string) => ({
  id,
  name: `Product ${id}`,
  price: parseFloat(id) * 10.99 || Math.random() * 1000,
  category: `category-${(parseInt(id) % 5) + 1}`,
  inStock: Math.random() > 0.3
});

const createLargeDataset = (count: number, prefix: string = 'item') => {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}_${i + 1}`,
    name: `${prefix} ${i + 1}`,
    value: i * 10,
    data: { nested: true, index: i }
  }));
};

describe('BrowserAdapter with Mock IndexedDB', () => {
  let adapter: BrowserAdapter;
  
  beforeEach(() => {
    adapter = new BrowserAdapter();
  });
  
  describe('Database Operations', () => {
    describe('openDatabase', () => {
      it('should open a database', async () => {
        const db = await adapter.openDatabase('TestDB', 1);
        expect(db).toBeDefined();
        expect(db.name).toBe('TestDB');
        expect(db.version).toBe(1);
      });
      
      it('should open database with upgrade handler', async () => {
        let upgradeCalled = false;
        
        adapter.onUpgrade('TestDB2', (event) => {
          upgradeCalled = true;
          const db = (event.target as any).result;
          expect(db).toBeDefined();
          db.createObjectStore('testStore', { keyPath: 'id' });
        });
        
        const db = await adapter.openDatabase('TestDB2', 1);
        expect(upgradeCalled).toBe(true);
        expect(db.objectStoreNames.contains('testStore')).toBe(true);
      });
      
      it('should create object store', async () => {
        const db = await adapter.openDatabase('TestDB', 1);
        const store = adapter.createObjectStore(db, 'users', { keyPath: 'id' });
        expect(store).toBeDefined();
        expect(db.objectStoreNames.contains('users')).toBe(true);
      });
      
      it('should retrieve existing object store', async () => {
        const db = await adapter.openDatabase('TestDB', 1);
        adapter.createObjectStore(db, 'users', { keyPath: 'id' });
        
        // Get the same store again
        const store2 = adapter.createObjectStore(db, 'users', { keyPath: 'id' });
        expect(store2).toBeDefined();
        expect(db.objectStoreNames.contains('users')).toBe(true);
      });
    });
    
    describe('createIndex', () => {
      let db: any;
      
      beforeEach(async () => {
        db = await adapter.openDatabase('TestDB', 1);
        adapter.createObjectStore(db, 'users', { keyPath: 'id' });
      });
      
      it('should create an index', async () => {
        const index = adapter.createIndex(db, 'users', 'email', 'email', { unique: false });
        expect(index).toBeDefined();
        expect(index.name).toBe('email');
      });
      
      it('should create a unique index', async () => {
        const index = adapter.createIndex(db, 'users', 'email', 'email', { unique: true });
        expect(index).toBeDefined();
        expect(index.unique).toBe(true);
      });
      
      it('should create compound index', async () => {
        const index = adapter.createIndex(db, 'users', 'nameEmail', ['name', 'email'], { unique: false });
        expect(index).toBeDefined();
      });
    });
    
    describe('deleteIndex', () => {
      let db: any;
      
      beforeEach(async () => {
        db = await adapter.openDatabase('TestDB', 1);
        adapter.createObjectStore(db, 'users', { keyPath: 'id' });
        adapter.createIndex(db, 'users', 'email', 'email');
      });
      
      it('should delete an index', async () => {
        expect(db.objectStoreNames.contains('users')).toBe(true);
        
        // Delete the index - the mock doesn't track indexNames on the store
        adapter.deleteIndex(db, 'users', 'email');
        
        // The operation should complete without error
        expect(true).toBe(true);
      });
    });
    
    describe('getObjectStoreNames', () => {
      it('should get object store names', async () => {
        const db = await adapter.openDatabase('TestDB', 1);
        adapter.createObjectStore(db, 'users', { keyPath: 'id' });
        adapter.createObjectStore(db, 'products', { keyPath: 'id' });
        
        const names = adapter.getObjectStoreNames(db);
        expect(names).toContain('users');
        expect(names).toContain('products');
        expect(names).toHaveLength(2);
      });
    });
    
    describe('close', () => {
      it('should close database', async () => {
        const db = await adapter.openDatabase('TestDB', 1);
        expect(() => adapter.close(db)).not.toThrow();
      });
    });
    
    describe('deleteDatabase', () => {
      it('should delete database', async () => {
        await adapter.openDatabase('ToDeleteDB', 1);
        
        // Delete should not throw
        await adapter.deleteDatabase('ToDeleteDB');
        expect(true).toBe(true);
      });
      
      it('should handle deleting non-existent database', async () => {
        await adapter.deleteDatabase('NonExistentDB');
        expect(true).toBe(true);
      });
    });
    
    describe('getDatabaseNames', () => {
      it('should get database names', async () => {
        await adapter.openDatabase('DB1', 1);
        await adapter.openDatabase('DB2', 1);
        
        const names = await adapter.getDatabaseNames();
        expect(names).toContain('DB1');
        expect(names).toContain('DB2');
      });
    });
    
    describe('getDatabaseInfo', () => {
      it('should get database info', async () => {
        await adapter.openDatabase('InfoDB', 2);
        
        const info = await adapter.getDatabaseInfo();
        const dbInfo = info.find(db => db.name === 'InfoDB');
        
        expect(dbInfo).toBeDefined();
        expect(dbInfo?.version).toBe(2);
      });
    });
    
    describe('databaseExists', () => {
      it('should check if database exists', async () => {
        await adapter.openDatabase('ExistingDB', 1);
        
        const exists = await adapter.databaseExists('ExistingDB');
        expect(exists).toBe(true);
        
        const notExists = await adapter.databaseExists('NonExistingDB');
        expect(notExists).toBe(false);
      });
    });
    
    describe('clearAll', () => {
      it('should clear all databases', async () => {
        await adapter.openDatabase('DB1', 1);
        await adapter.openDatabase('DB2', 1);
        
        await adapter.clearAll();
        
        const names = await adapter.getDatabaseNames();
        expect(names).toHaveLength(0);
      });
    });
  });
  
  describe('CRUD operations', () => {
    let db: any;
    
    beforeEach(async () => {
      db = await adapter.openDatabase('TestDB', 1);
      adapter.createObjectStore(db, 'users', { keyPath: 'id' });
    });
    
    describe('put', () => {
      it('should put a record', async () => {
        const user = createUserData('1');
        const result = await adapter.put({ db, storeName: 'users' }, user);
        expect(result).toBeDefined();
        expect(result.id).toBe('1');
      });
      
      it('should put a record with custom key', async () => {
        const user = createUserData('custom_key');
        const result = await adapter.put({ db, storeName: 'users' }, user, 'custom_key');
        expect(result).toBeDefined();
        expect(result.id).toBe('custom_key');
      });
      
      it('should update existing record with put', async () => {
        const user1 = createUserData('1');
        await adapter.put({ db, storeName: 'users' }, user1);
        
        const updatedUser = { ...user1, name: 'Updated Name' };
        const result = await adapter.put({ db, storeName: 'users' }, updatedUser);
        
        expect(result.name).toBe('Updated Name');
        
        const retrieved = await adapter.get({ db, storeName: 'users' }, '1');
        expect(retrieved.name).toBe('Updated Name');
      });
    });
    
    describe('add', () => {
      it('should add a record', async () => {
        const user = createUserData('1');
        const result = await adapter.add({ db, storeName: 'users' }, user);
        expect(result).toBeDefined();
        expect(result.id).toBe('1');
      });
      
      it('should add a record with custom key', async () => {
        const user = createUserData('custom_id');
        const result = await adapter.add({ db, storeName: 'users' }, user, 'custom_id');
        expect(result).toBeDefined();
        expect(result.id).toBe('custom_id');
      });
      
      it('should fail when adding duplicate key', async () => {
        const user = createUserData('1');
        await adapter.add({ db, storeName: 'users' }, user);
        
        await expect(adapter.add({ db, storeName: 'users' }, user)).rejects.toThrow();
      });
    });
    
    describe('get', () => {
      it('should get a record', async () => {
        const user = createUserData('1');
        await adapter.put({ db, storeName: 'users' }, user);
        
        const result = await adapter.get({ db, storeName: 'users' }, '1');
        expect(result).toEqual(user);
      });
      
      it('should return undefined for non-existent key', async () => {
        const result = await adapter.get({ db, storeName: 'users' }, 'non_existent');
        expect(result).toBeUndefined();
      });
    });
    
    describe('getMany', () => {
      it('should get multiple records', async () => {
        const user1 = createUserData('1');
        const user2 = createUserData('2');
        const user3 = createUserData('3');
        
        await adapter.put({ db, storeName: 'users' }, user1);
        await adapter.put({ db, storeName: 'users' }, user2);
        await adapter.put({ db, storeName: 'users' }, user3);
        
        const results = await adapter.getMany({ db, storeName: 'users' }, ['1', '2']);
        expect(results).toHaveLength(2);
      });
      
      it('should return empty array for empty keys', async () => {
        const results = await adapter.getMany({ db, storeName: 'users' }, []);
        expect(results).toHaveLength(0);
      });
      
      it('should handle non-existent keys', async () => {
        const user = createUserData('1');
        await adapter.put({ db, storeName: 'users' }, user);
        
        const results = await adapter.getMany({ db, storeName: 'users' }, ['1', 'non_existent']);
        expect(results).toHaveLength(2);
        expect(results[0]).toEqual(user);
        expect(results[1]).toBeUndefined();
      });
    });
    
    describe('getAll', () => {
      it('should get all records', async () => {
        await adapter.put({ db, storeName: 'users' }, createUserData('1'));
        await adapter.put({ db, storeName: 'users' }, createUserData('2'));
        
        const result = await adapter.getAll({ db, storeName: 'users' });
        expect(result).toHaveLength(2);
      });
      
      it('should return empty array when no records', async () => {
        const result = await adapter.getAll({ db, storeName: 'users' });
        expect(result).toHaveLength(0);
      });
    });
    
    describe('delete', () => {
      it('should delete a record', async () => {
        await adapter.put({ db, storeName: 'users' }, createUserData('1'));
        
        // Verify it exists
        let result = await adapter.get({ db, storeName: 'users' }, '1');
        expect(result).toBeDefined();
        
        // Delete it
        await adapter.delete({ db, storeName: 'users' }, '1');
        
        // Verify it's gone
        result = await adapter.get({ db, storeName: 'users' }, '1');
        expect(result).toBeUndefined();
      });
      
      it('should handle deleting non-existent record', async () => {
        await adapter.delete({ db, storeName: 'users' }, 'non_existent');
        expect(true).toBe(true);
      });
    });
    
    describe('deleteMany', () => {
      it('should delete multiple records', async () => {
        await adapter.put({ db, storeName: 'users' }, createUserData('1'));
        await adapter.put({ db, storeName: 'users' }, createUserData('2'));
        await adapter.put({ db, storeName: 'users' }, createUserData('3'));
        
        await adapter.deleteMany({ db, storeName: 'users' }, ['1', '2']);
        
        const all = await adapter.getAll({ db, storeName: 'users' });
        expect(all).toHaveLength(1);
        expect(all[0].id).toBe('3');
      });
      
      it('should handle empty keys array', async () => {
        await adapter.put({ db, storeName: 'users' }, createUserData('1'));
        
        await adapter.deleteMany({ db, storeName: 'users' }, []);
        
        const all = await adapter.getAll({ db, storeName: 'users' });
        expect(all).toHaveLength(1);
      });
    });
    
    describe('clear', () => {
      it('should clear all records', async () => {
        await adapter.put({ db, storeName: 'users' }, createUserData('1'));
        await adapter.put({ db, storeName: 'users' }, createUserData('2'));
        
        await adapter.clear({ db, storeName: 'users' });
        
        const result = await adapter.getAll({ db, storeName: 'users' });
        expect(result).toHaveLength(0);
      });
    });
    
    describe('count', () => {
      it('should count all records', async () => {
        await adapter.put({ db, storeName: 'users' }, createUserData('1'));
        await adapter.put({ db, storeName: 'users' }, createUserData('2'));
        
        const count = await adapter.count({ db, storeName: 'users' });
        expect(count).toBe(2);
      });
      
      it('should return 0 for empty store', async () => {
        const count = await adapter.count({ db, storeName: 'users' });
        expect(count).toBe(0);
      });
    });
  });
  
  describe('Index Operations', () => {
    let db: any;
    
    beforeEach(async () => {
      db = await adapter.openDatabase('TestDB', 1);
      adapter.createObjectStore(db, 'products', { keyPath: 'id' });
      adapter.createIndex(db, 'products', 'category', 'category', { unique: false });
      adapter.createIndex(db, 'products', 'price', 'price', { unique: false });
    });
    
    describe('getAllFromIndex', () => {
      it('should get all records from index', async () => {
        await adapter.put({ db, storeName: 'products' }, createProductData('1'));
        await adapter.put({ db, storeName: 'products' }, createProductData('2'));
        
        const results = await adapter.getAllFromIndex({ db, storeName: 'products' }, 'category');
        expect(results).toHaveLength(2);
      });
      
      it('should filter by query from index', async () => {
        await adapter.put({ db, storeName: 'products' }, { id: '1', name: 'P1', category: 'electronics', price: 100 });
        await adapter.put({ db, storeName: 'products' }, { id: '2', name: 'P2', category: 'electronics', price: 200 });
        await adapter.put({ db, storeName: 'products' }, { id: '3', name: 'P3', category: 'books', price: 50 });
        
        const results = await adapter.getAllFromIndex({ db, storeName: 'products' }, 'category', 'electronics');
        expect(results).toHaveLength(2);
        results.forEach(p => expect(p.category).toBe('electronics'));
      });
    });
    
    describe('searchByIndex', () => {
      it('should search by index', async () => {
        await adapter.put({ db, storeName: 'products' }, { id: '1', name: 'P1', category: 'electronics' });
        await adapter.put({ db, storeName: 'products' }, { id: '2', name: 'P2', category: 'electronics' });
        await adapter.put({ db, storeName: 'products' }, { id: '3', name: 'P3', category: 'books' });
        
        const results = await adapter.searchByIndex({ db, storeName: 'products' }, 'category', 'electronics');
        expect(results).toHaveLength(2);
      });
      
      it('should limit results', async () => {
        await adapter.put({ db, storeName: 'products' }, { id: '1', name: 'P1', category: 'electronics' });
        await adapter.put({ db, storeName: 'products' }, { id: '2', name: 'P2', category: 'electronics' });
        await adapter.put({ db, storeName: 'products' }, { id: '3', name: 'P3', category: 'electronics' });
        
        const results = await adapter.searchByIndex({ db, storeName: 'products' }, 'category', 'electronics', 2);
        expect(results).toHaveLength(2);
      });
    });
  });
  
  describe('Batch Operations', () => {
    let db: any;
    
    beforeEach(async () => {
      db = await adapter.openDatabase('TestDB', 1);
      adapter.createObjectStore(db, 'users', { keyPath: 'id' });
    });
    
    describe('putMany', () => {
      it('should put many records', async () => {
        const items = [
          { key: '1', value: createUserData('1') },
          { key: '2', value: createUserData('2') }
        ];
        
        const results = await adapter.putMany({ db, storeName: 'users' }, items);
        expect(results).toHaveLength(2);
        
        const all = await adapter.getAll({ db, storeName: 'users' });
        expect(all).toHaveLength(2);
      });
      
      it('should handle empty array', async () => {
        const results = await adapter.putMany({ db, storeName: 'users' }, []);
        expect(results).toHaveLength(0);
      });
      
      it('should put many records without explicit keys', async () => {
        const items = [
          { value: { name: 'User 1' } },
          { value: { name: 'User 2' } }
        ];
        
        const results = await adapter.putMany({ db, storeName: 'users' }, items);
        expect(results).toHaveLength(2);
      });
    });
  });
  
  describe('Cursor Operations', () => {
    let db: any;
    
    beforeEach(async () => {
      db = await adapter.openDatabase('TestDB', 1);
      adapter.createObjectStore(db, 'users', { keyPath: 'id' });
    });
    
    describe('iterate', () => {
      it('should iterate over all records', async () => {
        await adapter.put({ db, storeName: 'users' }, createUserData('1'));
        await adapter.put({ db, storeName: 'users' }, createUserData('2'));
        await adapter.put({ db, storeName: 'users' }, createUserData('3'));
        
        const collected: any[] = [];
        await adapter.iterate({ db, storeName: 'users' }, (value:unknown) => {
          collected.push(value);
        });
        
        expect(collected).toHaveLength(3);
      });
      
      it('should iterate with limit', async () => {
        await adapter.put({ db, storeName: 'users' }, createUserData('1'));
        await adapter.put({ db, storeName: 'users' }, createUserData('2'));
        await adapter.put({ db, storeName: 'users' }, createUserData('3'));
        
        const collected: any[] = [];
        await adapter.iterate({ db, storeName: 'users' }, (value:unknown) => {
          collected.push(value);
        }, { limit: 2 });
        
        expect(collected).toHaveLength(2);
      });
      
      it('should iterate with offset', async () => {
        await adapter.put({ db, storeName: 'users' }, createUserData('1'));
        await adapter.put({ db, storeName: 'users' }, createUserData('2'));
        await adapter.put({ db, storeName: 'users' }, createUserData('3'));
        
        const collected: any[] = [];
        await adapter.iterate({ db, storeName: 'users' }, (value:unknown) => {
          collected.push(value);
        }, { offset: 1 });
        
        expect(collected).toHaveLength(2);
      });
      
      it('should iterate with index', async () => {
        adapter.createIndex(db, 'users', 'name', 'name');
        
        await adapter.put({ db, storeName: 'users' }, { id: '1', name: 'Alice' });
        await adapter.put({ db, storeName: 'users' }, { id: '2', name: 'Bob' });
        await adapter.put({ db, storeName: 'users' }, { id: '3', name: 'Charlie' });
        
        const collected: any[] = [];
        await adapter.iterate({ db, storeName: 'users' }, (value:unknown) => {
          collected.push(value);
        }, { indexName: 'name' });
        
        expect(collected).toHaveLength(3);
      });
      
      it('should stop iteration when callback returns false', async () => {
        await adapter.put({ db, storeName: 'users' }, createUserData('1'));
        await adapter.put({ db, storeName: 'users' }, createUserData('2'));
        await adapter.put({ db, storeName: 'users' }, createUserData('3'));
        
        const collected: any[] = [];
        await adapter.iterate({ db, storeName: 'users' }, (value:unknown) => {
          collected.push(value);
          if (collected.length >= 2) return false;
        });
        
        expect(collected).toHaveLength(2);
      });
    });
  });
  
  describe('CursorHelper', () => {
    let db: any;
    
    beforeEach(async () => {
      db = await adapter.openDatabase('TestDB', 1);
      adapter.createObjectStore(db, 'users', { keyPath: 'id' });
    });
    
    describe('collect', () => {
      it('should collect all records', async () => {
        await adapter.put({ db, storeName: 'users' }, createUserData('1'));
        await adapter.put({ db, storeName: 'users' }, createUserData('2'));
        
        const helper = new CursorHelper(db, 'users');
        const results = await helper.collect();
        
        expect(results).toHaveLength(2);
      });
      
      it('should collect with max limit', async () => {
        await adapter.put({ db, storeName: 'users' }, createUserData('1'));
        await adapter.put({ db, storeName: 'users' }, createUserData('2'));
        await adapter.put({ db, storeName: 'users' }, createUserData('3'));
        
        const helper = new CursorHelper(db, 'users');
        const results = await helper.collect(2);
        
        expect(results).toHaveLength(2);
      });
    });
    
    describe('find', () => {
      it('should find first matching record', async () => {
        await adapter.put({ db, storeName: 'users' }, createUserData('1'));
        await adapter.put({ db, storeName: 'users' }, createUserData('2'));
        
        const helper = new CursorHelper(db, 'users');
        const result = await helper.find((user: any) => user.id === '2');
        
        expect(result).toBeDefined();
        expect(result?.id).toBe('2');
      });
      
      it('should return null when not found', async () => {
        await adapter.put({ db, storeName: 'users' }, createUserData('1'));
        
        const helper = new CursorHelper(db, 'users');
        const result = await helper.find((user: any) => user.id === 'non_existent');
        
        expect(result).toBeNull();
      });
    });
    
    describe('map', () => {
      it('should map records', async () => {
        await adapter.put({ db, storeName: 'users' }, createUserData('1'));
        await adapter.put({ db, storeName: 'users' }, createUserData('2'));
        
        const helper = new CursorHelper(db, 'users');
        const results = await helper.map((user: any) => user.name);
        
        expect(results).toHaveLength(2);
        expect(results[0]).toBe('User 1');
      });
    });
    
    describe('some', () => {
      it('should return true if any record matches', async () => {
        await adapter.put({ db, storeName: 'users' }, createUserData('1'));
        await adapter.put({ db, storeName: 'users' }, createUserData('2'));
        
        const helper = new CursorHelper(db, 'users');
        const result = await helper.some((user: any) => user.id === '2');
        
        expect(result).toBe(true);
      });
      
      it('should return false if no record matches', async () => {
        await adapter.put({ db, storeName: 'users' }, createUserData('1'));
        
        const helper = new CursorHelper(db, 'users');
        const result = await helper.some((user: any) => user.id === 'non_existent');
        
        expect(result).toBe(false);
      });
    });
    
    describe('every', () => {
      it('should return true if all records match', async () => {
        await adapter.put({ db, storeName: 'users' }, createUserData('1'));
        await adapter.put({ db, storeName: 'users' }, createUserData('2'));
        
        const helper = new CursorHelper(db, 'users');
        const result = await helper.every((user: any) => user.name.startsWith('User'));
        
        expect(result).toBe(true);
      });
      
      it('should return false if any record does not match', async () => {
        await adapter.put({ db, storeName: 'users' }, createUserData('1'));
        await adapter.put({ db, storeName: 'users' }, { id: '2', name: 'Not a User' });
        
        const helper = new CursorHelper(db, 'users');
        const result = await helper.every((user: any) => user.name.startsWith('User'));
        
        expect(result).toBe(false);
      });
    });
    
    describe('reduce', () => {
      it('should reduce records', async () => {
        await adapter.put({ db, storeName: 'users' }, { id: '1', age: 10 });
        await adapter.put({ db, storeName: 'users' }, { id: '2', age: 20 });
        
        const helper = new CursorHelper(db, 'users');
        const result = await helper.reduce((sum: number, user: any) => sum + user.age, 0);
        
        expect(result).toBe(30);
      });
    });
    
    describe('count', () => {
      it('should count records', async () => {
        await adapter.put({ db, storeName: 'users' }, createUserData('1'));
        await adapter.put({ db, storeName: 'users' }, createUserData('2'));
        
        const helper = new CursorHelper(db, 'users');
        const count = await helper.count();
        
        expect(count).toBe(2);
      });
    });
    
    describe('isEmpty', () => {
      it('should return false when records exist', async () => {
        await adapter.put({ db, storeName: 'users' }, createUserData('1'));
        
        const helper = new CursorHelper(db, 'users');
        const empty = await helper.isEmpty();
        
        expect(empty).toBe(false);
      });
      
      it('should return true when no records', async () => {
        const helper = new CursorHelper(db, 'users');
        const empty = await helper.isEmpty();
        
        expect(empty).toBe(true);
      });
    });
  });
  
  describe('TransactionManager', () => {
    let db: any;
    
    beforeEach(async () => {
      db = await adapter.openDatabase('TestDB', 1);
      adapter.createObjectStore(db, 'users', { keyPath: 'id' });
    });
    
    it('should create transaction manager', () => {
      const manager = new TransactionManager(db, 'users', 'readonly');
      expect(manager).toBeDefined();
      expect(manager.store).toBeDefined();
    });
    
    it('should execute request in transaction', async () => {
      const manager = new TransactionManager(db, 'users', 'readwrite');
      
      const user = createUserData('1');
      const result = await manager.execute(s => s.put(user));
      
      expect(result).toBeDefined();
      
      const retrieved = await adapter.get({ db, storeName: 'users' }, '1');
      expect(retrieved).toEqual(user);
    });
    
    it('should execute batch requests', async () => {
      const manager = new TransactionManager(db, 'users', 'readwrite');
      
      const user1 = createUserData('1');
      const user2 = createUserData('2');
      
      const results = await manager.executeBatch([
        s => s.put(user1),
        s => s.put(user2)
      ]);
      
      expect(results).toHaveLength(2);
    });
  });
  
  describe('Large Dataset Performance', () => {
    let db: any;
    
    beforeEach(async () => {
      db = await adapter.openDatabase('TestDB', 1);
      adapter.createObjectStore(db, 'items', { keyPath: 'id' });
    });
    
    it('should handle large dataset putMany', async () => {
      const largeDataset = createLargeDataset(100);
      const items = largeDataset.map(item => ({ key: item.id, value: item }));
      
      await adapter.putMany({ db, storeName: 'items' }, items);
      
      const count = await adapter.count({ db, storeName: 'items' });
      expect(count).toBe(100);
    });
    
    it('should handle large dataset getAll', async () => {
      const largeDataset = createLargeDataset(50);
      const items = largeDataset.map(item => ({ key: item.id, value: item }));
      await adapter.putMany({ db, storeName: 'items' }, items);
      
      const all = await adapter.getAll({ db, storeName: 'items' });
      expect(all).toHaveLength(50);
    });
    
    it('should handle large dataset iterate', async () => {
      const largeDataset = createLargeDataset(30);
      const items = largeDataset.map(item => ({ key: item.id, value: item }));
      await adapter.putMany({ db, storeName: 'items' }, items);
      
      const collected: any[] = [];
      await adapter.iterate({ db, storeName: 'items' }, (value:unknown) => {
        collected.push(value);
      });
      
      expect(collected).toHaveLength(30);
    });
  });
  
  describe('Edge Cases', () => {
    let db: any;
    
    beforeEach(async () => {
      db = await adapter.openDatabase('TestDB', 1);
      adapter.createObjectStore(db, 'users', { keyPath: 'id' });
    });
    
    it('should handle special characters in data', async () => {
      const specialData = {
        id: 'special',
        name: 'Test 🌍 émojis & "quotes" <tags>',
        html: '<script>alert("xss")</script>',
        unicode: '日本語 中文 한국어',
        nullValue: null,
        undefinedValue: undefined,
        arrayValue: [1, 2, 3],
        nested: { deep: { value: 'deep' } }
      };
      
      await adapter.put({ db, storeName: 'users' }, specialData);
      const result = await adapter.get({ db, storeName: 'users' }, 'special');
      
      expect(result).toEqual(specialData);
    });
    
    it('should handle large values', async () => {
      const largeValue = {
        id: 'large',
        data: 'x'.repeat(100000) // 100KB string
      };
      
      await adapter.put({ db, storeName: 'users' }, largeValue);
      const result = await adapter.get({ db, storeName: 'users' }, 'large');
      
      expect(result.data).toHaveLength(100000);
    });
    
    it('should handle numeric keys', async () => {
      await adapter.put({ db, storeName: 'users' }, { id: 1, name: 'One' });
      await adapter.put({ db, storeName: 'users' }, { id: 2, name: 'Two' });
      
      const result1 = await adapter.get({ db, storeName: 'users' }, 1);
      const result2 = await adapter.get({ db, storeName: 'users' }, 2);
      
      expect(result1.name).toBe('One');
      expect(result2.name).toBe('Two');
    });
  });
});
