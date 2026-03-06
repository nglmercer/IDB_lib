# idb-manager

A modern and robust library for managing IndexedDB with support for Browser and Node.js environments.

[![npm version](https://img.shields.io/npm/v/idb-manager.svg)](https://www.npmjs.com/package/idb-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Features

- 🚀 **Cross-Platform**: Works in browsers and Node.js.
- 🛠 **Modular Adapters**: Use `BrowserAdapter` for web or `NodeAdapter` for file-based storage.
- ⚡ **Type-Safe**: Written in TypeScript with full generic support.
- 📦 **Simple API**: CRUD operations, batch processing, and advanced search/filtering.
- 🔔 **Event-Driven**: Built-in event emitter for monitoring changes.
- 📁 **Export/Import**: Easy backup and restoration of your data.

## Installation

```bash
bun add idb-manager
# or
npm install idb-manager
```

## Quick Start

### Browser

```typescript
import { IndexedDBManager } from "idb-manager";

const db = new IndexedDBManager({
  name: "MyDatabase",
  version: 1,
  store: "items",
});

await db.add({ name: "Hello World" });
const items = await db.getAll();
```

### Node.js

```typescript
import { IndexedDBManager } from "idb-manager";
import { NodeAdapter } from "idb-manager/node";

const db = new IndexedDBManager(
  {
    name: "MyDatabase",
    version: 1,
    store: "items",
  },
  {
    adapter: new NodeAdapter("./data"),
  },
);

await db.add({ name: "Node.js is cool" });
```

## Documentation

For more detailed information, please refer to the following guides:

- 📖 [API Reference](docs/api.md)
- 🔌 [Adapters Guide](docs/adapters.md)
- 💡 [Examples](docs/examples.md)
- 🤝 [Contributing](docs/contributing.md)

## License

MIT © [nglmercer](https://github.com/nglmercer)
