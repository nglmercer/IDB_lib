## 🏗️ Arquitectura Multi-Store (Schema-Based)

### Inicialización con Schema

La librería soporta trabajar con múltiples stores usando un schema de base de datos:

```typescript
import { IndexedDBManager, DatabaseSchema } from 'idb-manager';

// Definir schema con múltiples stores
const appSchema: DatabaseSchema = {
  name: 'MyMultiStoreApp',
  version: 1,
  stores: [
    {
      name: 'users',
      keyPath: 'id',
      autoIncrement: false,
      indexes: [
        { name: 'email', keyPath: 'email', unique: true },
        { name: 'status', keyPath: 'status', unique: false },
        { name: 'createdAt', keyPath: 'createdAt', unique: false }
      ]
    },
    {
      name: 'posts',
      keyPath: 'id',
      autoIncrement: false,
      indexes: [
        { name: 'userId', keyPath: 'userId', unique: false },
        { name: 'category', keyPath: 'category', unique: false },
        { name: 'publishedAt', keyPath: 'publishedAt', unique: false }
      ]
    },
    {
      name: 'comments',
      keyPath: 'id',
      autoIncrement: false,
      indexes: [
        { name: 'postId', keyPath: 'postId', unique: false },
        { name: 'userId', keyPath: 'userId', unique: false },
        { name: 'createdAt', keyPath: 'createdAt', unique: false }
      ]
    }
  ]
};

// Inicializar con schema
const manager = await IndexedDBManager.initializeWithSchema(appSchema);
```

### Sistema de Store Proxy

Cada store se maneja a través de un proxy que proporciona una API completa:

```typescript
// Obtener proxy de un store específico
const usersStore = manager.store('users');
const postsStore = manager.store('posts');
const commentsStore = manager.store('comments');

// Cada store tiene su propia API completa
const newUser = await usersStore.add({
  name: 'John Doe',
  email: 'john@example.com',
  status: 'active',
  createdAt: new Date().toISOString()
});

const newPost = await postsStore.add({
  title: 'Mi primer post',
  content: 'Contenido del post...',
  userId: newUser.id,
  category: 'tech',
  publishedAt: new Date().toISOString()
});
```

## 📋 API Completa de Store Proxy

### Operaciones CRUD por Store

```typescript
const usersStore = manager.store('users');

// Crear
const user = await usersStore.add(userData);

// Leer
const user = await usersStore.get(userId);
const allUsers = await usersStore.getAll();

// Actualizar
const updatedUser = await usersStore.update(userObject);

// Eliminar
const success = await usersStore.delete(userId);

// Limpiar store completo
await usersStore.clear();

// Contar elementos en el store
const count = await usersStore.count();
```

### Operaciones en Lote por Store

```typescript
const usersStore = manager.store('users');

// Agregar múltiples elementos
const users = [
  { name: 'User 1', email: 'user1@test.com', status: 'active' },
  { name: 'User 2', email: 'user2@test.com', status: 'active' },
  { name: 'User 3', email: 'user3@test.com', status: 'inactive' }
];
const success = await usersStore.addMany(users);

// Actualizar múltiples elementos
const updatedUsers = users.map(user => ({ ...user, status: 'premium' }));
const updateSuccess = await usersStore.updateMany(updatedUsers);

// Eliminar múltiples elementos
const deleteSuccess = await usersStore.deleteMany([1, 2, 3]);

// Obtener múltiples elementos
const multipleUsers = await usersStore.getMany([1, 2, 3]);
```

### Búsqueda y Filtrado Avanzado por Store

```typescript
const usersStore = manager.store('users');
const postsStore = manager.store('posts');

// Búsqueda avanzada con opciones
const searchResult = await usersStore.search(
  { status: 'active' }, // Query
  {
    limit: 10,
    offset: 0,
    orderBy: 'createdAt',
    orderDirection: 'desc'
  }
);

console.log(searchResult.items);     // Array de resultados
console.log(searchResult.total);     // Total de elementos que coinciden
console.log(searchResult.page);      // Página actual
console.log(searchResult.limit);     // Límite por página

// Filtrado simple por criterios
const activeUsers = await usersStore.filter({ status: 'active' });
const techPosts = await postsStore.filter({ category: 'tech' });
```

### Estadísticas por Store

```typescript
const usersStore = manager.store('users');

const stats = await usersStore.getStats();
console.log(stats.totalRecords);  // Número total de registros
console.log(stats.storeName);     // Nombre del store
console.log(stats.databaseName);  // Nombre de la base de datos
console.log(stats.version);       // Versión de la base de datos
```

## 🔧 Métodos de Configuración Avanzada

### Gestión de Schema

```typescript
// Establecer un nuevo schema después de la inicialización
manager.setSchema(newSchema);

// El manager mantiene compatibilidad hacia atrás
// Puedes seguir usando los métodos tradicionales que operan en el store por defecto
const user = await manager.add({ name: 'Traditional User' });
const users = await manager.getAll();
```

### Gestión de Emitter

```typescript
import { Emitter } from 'idb-manager';

// Crear un emitter personalizado
const customEmitter = new Emitter();
manager.setEmitterInstance(customEmitter);

// Refrescar instancia de emitter
manager.refreshEmitterInstance();

// Acceder al emitter actual
const currentEmitter = manager.emitterInstance;
```

## 🎯 Escenarios de Uso Realistas

### Blog Multi-Store

```typescript
// 1. Inicializar con schema completo
const blogSchema: DatabaseSchema = {
  name: 'BlogApp',
  version: 1,
  stores: [
    {
      name: 'users',
      keyPath: 'id',
      autoIncrement: false,
      indexes: [
        { name: 'email', keyPath: 'email', unique: true },
        { name: 'status', keyPath: 'status', unique: false }
      ]
    },
    {
      name: 'posts',
      keyPath: 'id',
      autoIncrement: false,
      indexes: [
        { name: 'userId', keyPath: 'userId', unique: false },
        { name: 'category', keyPath: 'category', unique: false },
        { name: 'publishedAt', keyPath: 'publishedAt', unique: false }
      ]
    },
    {
      name: 'comments',
      keyPath: 'id',
      autoIncrement: false,
      indexes: [
        { name: 'postId', keyPath: 'postId', unique: false },
        { name: 'userId', keyPath: 'userId', unique: false }
      ]
    }
  ]
};

const manager = await IndexedDBManager.initializeWithSchema(blogSchema);

// 2. Trabajar con stores específicos
const usersStore = manager.store('users');
const postsStore = manager.store('posts');
const commentsStore = manager.store('comments');

// 3. Crear relaciones entre datos
const author = await usersStore.add({
  name: 'Tech Author',
  email: 'tech@example.com',
  status: 'active'
});

const post = await postsStore.add({
  title: 'Introduction to IndexedDB',
  content: 'Learn about IndexedDB...',
  userId: author.id,
  category: 'Technology'
});

const comment = await commentsStore.add({
  content: 'Great explanation!',
  postId: post.id,
  userId: author.id
});

// 4. Consultas relacionales
const authorPosts = await postsStore.filter({ userId: author.id });
const postComments = await commentsStore.filter({ postId: post.id });
```

### E-commerce Multi-Store

```typescript
// Reutilizar stores para diferentes propósitos
const customersStore = manager.store('users');      // Clientes
const productsStore = manager.store('posts');       // Productos
const ordersStore = manager.store('comments');      // Órdenes

// Crear productos
const laptop = await productsStore.add({
  name: 'Laptop Gaming',
  price: 999.99,
  category: 'Electronics',
  stock: 10
});

// Crear cliente
const customer = await customersStore.add({
  name: 'John Customer',
  email: 'john@customer.com',
  status: 'active'
});

// Crear orden
const order = await ordersStore.add({
  customerId: customer.id,
  productId: laptop.id,
  quantity: 1,
  total: 999.99,
  status: 'pending'
});
```

## ⚡ Operaciones Concurrentes

### Diferentes Stores

```typescript
// Ejecutar operaciones concurrentes en diferentes stores
const promises = [
  usersStore.add({ name: 'User 1', email: 'user1@test.com' }),
  postsStore.add({ title: 'Post 1', userId: 1, category: 'tech' }),
  commentsStore.add({ content: 'Comment 1', postId: 1, userId: 1 })
];

const results = await Promise.all(promises);
console.log('Todas las operaciones completadas:', results);
```

### Mismo Store

```typescript
// Múltiples operaciones concurrentes en el mismo store
const promises = Array.from({ length: 10 }, (_, i) =>
  usersStore.add({
    name: `User ${i + 1}`,
    email: `user${i + 1}@test.com`,
    status: 'active'
  })
);

const users = await Promise.all(promises);
console.log(`${users.length} usuarios creados concurrentemente`);
```

## 🚨 Manejo de Errores Avanzado

### Errores de Índices Únicos

```typescript
try {
  // Primer usuario
  await usersStore.add({
    name: 'User 1',
    email: 'duplicate@test.com',
    status: 'active'
  });

  // Segundo usuario con email duplicado (fallará)
  await usersStore.add({
    name: 'User 2',
    email: 'duplicate@test.com', // Error: email debe ser único
    status: 'active'
  });
} catch (error) {
  console.error('Error por restricción de índice único:', error);
}
```

### Stores Inexistentes

```typescript
try {
  const nonExistentStore = manager.store('nonexistent');
  await nonExistentStore.getAll();
} catch (error) {
  console.error('Error: Store no existe:', error.message);
  // Error: Store 'nonexistent' not found. Available stores: [users, posts, comments]
}
```

## 📊 Referencia Completa de Métodos de Store Proxy

| Método | Descripción | Retorna |
|--------|-------------|----------|
| `add(data)` | Agrega un elemento al store | `Promise<DatabaseItem>` |
| `get(id)` | Obtiene elemento por ID | `Promise<DatabaseItem \| null>` |
| `update(item)` | Actualiza elemento completo | `Promise<DatabaseItem \| null>` |
| `delete(id)` | Elimina elemento por ID | `Promise<boolean>` |
| `getAll()` | Obtiene todos los elementos | `Promise<DatabaseItem[]>` |
| `clear()` | Limpia el store completo | `Promise<void>` |
| `count()` | Cuenta elementos en el store | `Promise<number>` |
| `search(query, options)` | Búsqueda avanzada con paginación | `Promise<SearchResult>` |
| `filter(criteria)` | Filtra por criterios específicos | `Promise<DatabaseItem[]>` |
| `addMany(items)` | Agrega múltiples elementos | `Promise<boolean>` |
| `updateMany(items)` | Actualiza múltiples elementos | `Promise<boolean>` |
| `deleteMany(ids)` | Elimina múltiples elementos | `Promise<boolean>` |
| `getMany(ids)` | Obtiene múltiples elementos por IDs | `Promise<DatabaseItem[]>` |
| `getStats()` | Obtiene estadísticas del store | `Promise<DatabaseStats>` |

## 🔄 Compatibilidad Hacia Atrás

La librería mantiene compatibilidad completa con el modo single-store:

```typescript
// Modo tradicional (single-store) - sigue funcionando
const user = await manager.add({ name: 'Traditional User' });
const users = await manager.getAll();
const searchResults = await manager.search('Traditional');

// Modo multi-store - nueva funcionalidad
const usersStore = manager.store('users');
const user2 = await usersStore.add({ name: 'Multi-store User' });
```

## 🎛️ Métodos de Configuración No Documentados

| Método | Descripción | Parámetros | Retorna |
|--------|-------------|------------|---------|
| `setSchema(schema)` | Establece un nuevo schema | `DatabaseSchema` | `void` |
| `setEmitterInstance(emitter)` | Establece instancia de emitter personalizada | `Emitter` | `void` |
| `refreshEmitterInstance()` | Refresca la instancia del emitter | - | `void` |
| `initializeWithSchema(schema, options?)` | Método estático para inicializar con schema | `DatabaseSchema, IndexedDBManagerOptions?` | `Promise<IndexedDBManager>` |