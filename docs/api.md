# API Reference

Detailed documentation for the `idb-manager` library.

## Table of Contents

- [IndexedDBManager<T>](#indexeddbmanagert)
- [StoreProxy<T>](#storeproxyt)
- [Multi-Store Support](#multi-store-support)
- [Event System](#event-system)
- [Search and Filtering](#search-and-filtering)
- [Types and Interfaces](#types-and-interfaces)
- [Utility Functions](#utility-functions)

---

## `IndexedDBManager<T>`

The main class for interacting with the database. `T` is an optional generic type for your data items (defaults to `DatabaseItem`).

### Constructor

```typescript
new IndexedDBManager<T>(config: DatabaseConfig | DatabaseSchema, options?: IndexedDBManagerOptions)
```

- **config**: Either a simple `DatabaseConfig` for single-store use or a `DatabaseSchema` for multi-store setups.
- **options**:
  - `adapter`: The storage adapter (`BrowserAdapter`, `NodeAdapter`, or `MemoryAdapter`).
  - `autoInit`: Automatically open database on instantiation (default: `true`).
  - `debug`: Enable internal logging.

### Instance Methods

#### Core Operations (Targeting Default Store)

| Method                  | Signature                                                        | Description                                      |
| ----------------------- | ---------------------------------------------------------------- | ------------------------------------------------ |
| `add`                   | `(data: Partial<T>) => Promise<T>`                               | Adds a new record. Generates an `id` if missing. |
| `get` / `getById`       | `(id: string \| number) => Promise<T \| null>`                   | Retrieves a record by its unique ID.             |
| `update`                | `(item: T) => Promise<T>`                                        | Updates multiple fields. Throws if not found.    |
| `updateById`            | `(id: string \| number, data: Partial<T>) => Promise<T \| null>` | Updates specific fields for a given ID.          |
| `delete` / `deleteById` | `(id: string \| number) => Promise<boolean>`                     | Deletes a record. Returns `true` if successful.  |
| `getAll`                | `() => Promise<T[]>`                                             | Fetches all records from the store.              |
| `count`                 | `() => Promise<number>`                                          | Returns the total count of documents.            |
| `clear`                 | `() => Promise<void>`                                            | Removes all records in the default store.        |
| `idExists`              | `(id: string \| number) => Promise<boolean>`                     | Checks if an ID exists.                          |

### Properties

| Property          | Type             | Description                             |
| ----------------- | ---------------- | --------------------------------------- |
| `currentStore`    | `string`         | The name of the store currently in use. |
| `currentDatabase` | `string`         | The name of the active database.        |
| `version`         | `number`         | The current database version.           |
| `config`          | `DatabaseConfig` | The full configuration object.          |

#### Batch Operations

| Method       | Signature                                         | Description                              |
| ------------ | ------------------------------------------------- | ---------------------------------------- |
| `addMany`    | `(items: Partial<T>[]) => Promise<boolean>`       | Adds multiple records at once.           |
| `updateMany` | `(items: T[]) => Promise<boolean>`                | Updates multiple records.                |
| `deleteMany` | `(ids: (string \| number)[]) => Promise<boolean>` | Deletes records for the given IDs.       |
| `getMany`    | `(ids: (string \| number)[]) => Promise<T[]>`     | Retrieves multiple records by their IDs. |

#### Database Management

| Method           | Signature                                   | Description                                                 |
| ---------------- | ------------------------------------------- | ----------------------------------------------------------- |
| `openDatabase`   | `() => Promise<any>`                        | Manually opens the DB connection.                           |
| `close`          | `() => void`                                | Closes the connection and clears proxies.                   |
| `registerSchema` | `(schema: DatabaseSchema) => Promise<void>` | Registers and migrates to a new schema.                     |
| `getStats`       | `() => Promise<DatabaseStats>`              | Returns stats (count, name, version) for the default store. |
| `debugInfo`      | `() => Promise<object>`                     | Returns diagnostic information about the current state.     |

---

## `StoreProxy<T>`

A proxy object that allows performing operations on a specific store in a multi-store environment. Obtain via `db.store('name')`.

### Methods

The `StoreProxy` has nearly identical methods to `IndexedDBManager` but scoped to the specific store:

- `add(data)`, `get(id)`, `update(item)`, `delete(id)`
- `getAll()`, `count()`, `clear()`
- `addMany(items)`, `updateMany(items)`, `deleteMany(ids)`, `getMany(ids)`
- `search(query, options)`, `filter(criteria)`
- `getStats()`

---

## Multi-Store Support

You can manage multiple stores by providing a `DatabaseSchema` in the constructor or using `registerSchema`.

```typescript
const schema = {
  name: "AppDB",
  version: 1,
  stores: [
    {
      name: "users",
      indexes: [{ name: "email", keyPath: "email", unique: true }],
    },
    { name: "posts", indexes: [{ name: "authorId", keyPath: "authorId" }] },
  ],
};

const db = new IndexedDBManager(schema);

// Accessing different stores
const users = db.store("users");
const posts = db.store("posts");

await users.add({ name: "Alice" });
await posts.add({ title: "Hello", authorId: "alice-id" });
```

---

## Event System

The library emits events for all write operations. Use `db.on(event, callback)` to listen.

### Event Names

- `add`, `update`, `delete`, `clear`, `import`, `export`

### Event Data Structure (`EmitEventData`)

```typescript
{
  config: DatabaseConfig; // The DB config where the change happened
  data: DatabaseItem | number | null; // The affected item or ID
  metadata: {
    timestamp: number | string;
    operation: string; // e.g., 'add'
    recordCount?: number;
  };
}
```

---

## Search and Filtering

### `filter(criteria: FilterCriteria)`

Filters items by exact match on multiple fields.

```typescript
const admins = await db.filter({ role: "admin", active: true });
```

### `search(query: string, options?: SearchTextOptions)`

Performs a partial string search across specified fields.

```typescript
// Searches for 'Alice' in 'name' or 'email' fields
const results = await db.search("Alice", { fields: ["name", "email"] });
```

### `searchData(query: Partial<T>, options?: SearchOptions)`

Advanced search with sorting and pagination.

```typescript
const results = await db.searchData(
  { role: "user" },
  {
    orderBy: "createdAt",
    orderDirection: "desc",
    limit: 10,
    offset: 20,
  },
);
// Returns SearchResult object { items: T[], total: number, page?: number, limit?: number }
```

---

## Types and Interfaces

### `DatabaseItem`

All items stored in the database must adhere to this base structure.

```typescript
interface DatabaseItem {
  readonly id: string | number;
  readonly createdAt?: number | string;
  readonly updatedAt?: number | string;
  [key: string]: any;
}
```

### `DatabaseSchema`

Defines the structure of the database.

```typescript
interface DatabaseSchema {
  name: string;
  version: number;
  stores: StoreSchema[];
}

interface StoreSchema {
  name: string;
  indexes?: DatabaseIndex[];
  autoIncrement?: boolean;
  keyPath?: string;
}
```

---

## Utility Functions

Exported helper functions for common tasks:

- `normalizeId(id)`: Ensures IDs are either string or number.
- `isValidId(id)`: Validates if a value can be a valid IndexedDB ID.
- `generateNextId(items)`: Generates the next numeric ID based on an array of items.
- `debounce(fn, delay)` / `throttle(fn, delay)`: Standard performance wrappers.
- `createTimestamp()`: Generates an ISO or numeric timestamp.
