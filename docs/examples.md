# Examples

Practical usage examples for `idb-manager`.

## 1. Quick Start (Browser)

```typescript
import { IndexedDBManager } from "idb-manager";

interface User {
  id: string;
  name: string;
  email: string;
}

const db = new IndexedDBManager<User>({
  name: "UsersDB",
  version: 1,
  store: "users",
});

await db.add({ name: "John Doe", email: "john@example.com" });
const allUsers = await db.getAll();
```

## 2. Multi-Store with Relationships

`idb-manager` doesn't have a formal ORM mapping for relations, but you can easily handle them manually using stores.

```typescript
const schema = {
  name: "SocialDB",
  version: 1,
  stores: [
    { name: "users" },
    {
      name: "posts",
      indexes: [{ name: "userId", keyPath: "userId", unique: false }],
    },
  ],
};

const db = new IndexedDBManager(schema);

async function getPostsWithUser(postId: string) {
  const post = await db.store("posts").get(postId);
  if (!post) return null;

  const user = await db.store("users").get(post.userId);
  return { ...post, user };
}
```

## 3. Pagination & Sorting

Use `searchData` for paginated results.

```typescript
const { items, total, page } = await db.searchData(
  { status: "active" }, // Search criteria (empty to get all)
  {
    orderBy: "createdAt",
    orderDirection: "desc",
    limit: 10,
    offset: 0, // Fetch first 10
  },
);

console.log(`Page ${page}, total count: ${total}`);
```

## 4. Schema Migrations

When you increment the version, IndexedDB triggers an upgrade. `idb-manager` handles this via `registerSchema`.

```typescript
const v1 = {
  name: "MyApp",
  version: 1,
  stores: [{ name: "settings" }],
};

const db = new IndexedDBManager(v1);

// Later in your app...
const v2 = {
  name: "MyApp",
  version: 2,
  stores: [
    { name: "settings" },
    { name: "profile" }, // New store added in v2
  ],
};

await db.registerSchema(v2); // Automatically handles the version upgrade
```

## 5. Listening to Events

Monitor database changes in real-time.

```typescript
db.on("add", (event) => {
  console.log(`New record in ${event.config.store}:`, event.data);
  console.log(`Time: ${event.metadata.timestamp}`);
});

db.on("delete", (event) => {
  console.log("Deleted record with ID:", event.data);
});
```

## 6. Advanced Filtering

Exact matching across multiple keys.

```typescript
const results = await db.filter({
  role: "editor",
  orgId: 123,
  isActive: true,
});
```

## 7. Partial Search

Search for a string across multiple properties.

```typescript
// Finds any user where name, title, or bio contains "developer"
const developers = await db.search("developer", {
  fields: ["name", "title", "bio"],
});
```

## 8. Exporting and Backup

```typescript
import { exportDataFromDatabase } from "idb-manager";

// Get a full JSON backup of a store
const backup = await db.store("users").getAll();
// Or use core utility (Browser only for download)
import { downloadJSON } from "idb-manager";
downloadJSON(backup, "users_backup.json");
```
