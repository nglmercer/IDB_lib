# Adapters

`idb-manager` uses a modular adapter system to support different environments.

## `BrowserAdapter`

The default adapter for web browsers. It uses the native `IndexedDB` API.

### Usage

```typescript
import { IndexedDBManager } from "idb-manager";
import { BrowserAdapter } from "idb-manager/browser";

const manager = new IndexedDBManager(config, {
  adapter: new BrowserAdapter(),
});
```

## `NodeAdapter`

An adapter for Node.js environments. It persists data as JSON files in a local directory, simulating the IndexedDB behavior.

### Usage

```typescript
import { IndexedDBManager } from "idb-manager";
import { NodeAdapter } from "idb-manager/node";

const manager = new IndexedDBManager(config, {
  adapter: new NodeAdapter("./data"),
});
```

### Options

- `dbPath`: (Optional) The directory where JSON files will be stored. Defaults to `./data`.
- `options.inMemory`: (Optional) If `true`, data will not be persisted to disk.

## `MemoryAdapter`

An in-memory adapter that does not persist data. Useful for testing or temporary storage.

### Usage

```typescript
import { IndexedDBManager } from "idb-manager";
import { MemoryAdapter } from "idb-manager"; // or from specific path if needed

const manager = new IndexedDBManager(config, {
  adapter: new MemoryAdapter(),
});
```
