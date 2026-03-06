/**
 * IDB_lib Node.js Example
 * 
 * This example demonstrates how to use IDB_lib in a Node.js environment
 * using the NodeAdapter for file-based storage.
 * 
 * Run with: bun run examples/node/index.ts
 */

import { IndexedDBManager } from 'idb-manager';
import { NodeAdapter } from 'idb-manager/node';
import type { DatabaseItem } from 'idb-manager';

// Define a type for our data
interface User extends DatabaseItem {
  name: string;
  email: string;
  age: number;
  createdAt: string;
}

// Create a NodeAdapter instance
// By default, data is stored in './data' directory as JSON files
const nodeAdapter = new NodeAdapter('./data');

// Or use in-memory mode (data won't be persisted)
// const nodeAdapter = new NodeAdapter('./data', { inMemory: true });

// Create database configuration
const dbConfig = {
  name: 'UsersDB',
  version: 1,
  store: 'users'
};

// Create IndexedDBManager with the NodeAdapter
const db = new IndexedDBManager<User>(dbConfig, {
  adapter: nodeAdapter
});

// Example functions
async function runExamples() {
  console.log('\n=== IDB_lib Node.js Example ===\n');

  // Open the database
  await db.openDatabase();
  console.log('✓ Database opened successfully');

  // Clear any existing data
  await db.clear();
  console.log('✓ Cleared existing data');

  // === CREATE: Add new users ===
  console.log('\n--- CREATE Operations ---');

  const user1: Partial<User> = {
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
    createdAt: new Date().toISOString()
  };

  const user2: Partial<User> = {
    name: 'Jane Smith',
    email: 'jane@example.com',
    age: 25,
    createdAt: new Date().toISOString()
  };

  const user3: Partial<User> = {
    name: 'Bob Wilson',
    email: 'bob@example.com',
    age: 35,
    createdAt: new Date().toISOString()
  };

  // Add single user
  const result1 = await db.add(user1);
  console.log(`✓ Added user 1:`, result1);

  // Add multiple users
  const added = await db.addMany([user2, user3]);
  console.log(`✓ Added users 2-3: ${added ? 'Success' : 'Failed'}`);

  // === READ: Fetch data ===
  console.log('\n--- READ Operations ---');

  // Get all users
  const allUsers = await db.getAll();
  console.log(`✓ All users: ${JSON.stringify(allUsers, null, 2)}`);

  // Get user by ID
  const userById = await db.get(result1.id!);
  console.log(`✓ User by ID ${result1.id}:`, userById);

  // Count total users
  const count = await db.count();
  console.log(`✓ Total users: ${count}`);

  // Check if user exists
  const exists = await db.idExists(result1.id!);
  console.log(`✓ User ${result1.id} exists: ${exists}`);

  // === UPDATE: Modify data ===
  console.log('\n--- UPDATE Operations ---');

  // Update user
  const updatedUser = await db.update({
    ...userById!,
    age: 31,
    name: 'John Doe Jr.'
  } as User);
  console.log(`✓ Updated user:`, updatedUser);

  // === DELETE: Remove data ===
  console.log('\n--- DELETE Operations ---');

  // Delete single user
  const deleted = await db.delete(result1.id!);
  console.log(`✓ Deleted user with ID ${result1.id}: ${deleted ? 'Success' : 'Failed'}`);

  // Check count after deletion
  const countAfterDelete = await db.count();
  console.log(`✓ Users remaining: ${countAfterDelete}`);

  // === BATCH Operations ===
  console.log('\n--- BATCH Operations ---');

  // Create batch users
  const batchUsers: Partial<User>[] = Array.from({ length: 10 }, (_, i) => ({
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    age: 20 + (i % 10),
    createdAt: new Date().toISOString()
  }));

  // Batch add
  await db.addMany(batchUsers);
  console.log(`✓ Batch added ${batchUsers.length} users`);

  // Get all after batch
  const allUsersAfterBatch = await db.getAll();
  
  // Batch delete
  const idsToDelete = allUsersAfterBatch.slice(0, 3).map(u => u.id!);
  await db.deleteMany(idsToDelete);
  console.log(`✓ Batch deleted ${idsToDelete.length} users`);

  // Get count after batch delete
  const countAfterBatchDelete = await db.count();
  console.log(`✓ Users after batch delete: ${countAfterBatchDelete}`);

  // Clear all
  await db.clear();
  console.log('✓ Cleared all users');

  // === SEARCH Operations ===
  console.log('\n--- SEARCH Operations ---');

  // Re-add some users for searching
  const searchUsers: Partial<User>[] = [
    { name: 'Alice Brown', email: 'alice@example.com', age: 28, createdAt: new Date().toISOString() },
    { name: 'Charlie Davis', email: 'charlie@example.com', age: 32, createdAt: new Date().toISOString() },
    { name: 'Diana Evans', email: 'diana@example.com', age: 28, createdAt: new Date().toISOString() },
    { name: 'Edward Foster', email: 'edward@example.com', age: 45, createdAt: new Date().toISOString() },
    { name: 'Fiona Garcia', email: 'fiona@example.com', age: 28, createdAt: new Date().toISOString() }
  ];

  await db.addMany(searchUsers);
  console.log(`✓ Added ${searchUsers.length} users for searching`);

  // Search using filter
  const searchResults = await db.filter({
    field: 'age',
    operator: '===',
    value: 28
  });
  console.log(`✓ Users aged 28: ${searchResults.length}`);
  console.log(`  Names: ${searchResults.map(u => u.name).join(', ')}`);

  // Search using text search
  const textSearchResults = await db.search('Alice');
  console.log(`✓ Text search for 'Alice': ${textSearchResults.map(u => u.name).join(', ')}`);

  // === EVENTS ===
  console.log('\n--- EVENTS ---');

  // Listen for events
  db.on('add', (data) => {
    console.log(`  [Event] User added:`, data);
  });
  db.on('addMany', (data) => {
    console.log(`  [Event] Users added:`, data);
  });
  db.on('update', (data) => {
    console.log(`  [Event] User updated:`, data);
  });
  db.on('updateMany', (data) => {
    console.log(`  [Event] Users updated:`, data);
  });
  db.on('delete', (id) => {
    console.log(`  [Event] User deleted:`, id);
  });
  db.on('deleteMany', (data) => {
    console.log(`  [Event] Users deleted:`, data);
  });

  // Trigger an event
  await db.add({
    name: 'Event Test User',
    email: 'event@example.com',
    age: 99,
    createdAt: new Date().toISOString()
  });

  // === DATABASE Info ===
  console.log('\n--- DATABASE Info ---');

  const dbInfo = await nodeAdapter.getDatabaseInfo();
  console.log(`✓ Database info: ${JSON.stringify(dbInfo, null, 2)}`);

  // === CLOSE ===
  db.close();
  console.log('\n✓ Database closed successfully');

  console.log('\n=== Example Complete ===\n');
}

// Run the examples
runExamples().catch(console.error);
